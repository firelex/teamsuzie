import vm from 'node:vm';
import { buildSandboxGlobals, type DesignSystem } from './context.js';
import { iconToBase64Png } from './icons.js';

const EXECUTION_TIMEOUT_MS = 30_000;

export interface ExecutionResult {
    success: boolean;
    slideCount: number;
    error?: string;
}

export async function executeSandboxedCode(
    code: string,
    pres: any,
    designSystem: DesignSystem,
): Promise<ExecutionResult> {
    const globals = buildSandboxGlobals(pres, designSystem);

    // Pre-resolve all icons found anywhere in the code as string literals.
    // This handles both direct calls like iconToBase64Png("FaRocket", "#FFF")
    // AND indirect usage like: const icons = ["FaRocket", "FaHeart"]; ... iconToBase64Png(icons[i], ...)
    const iconNames = extractIconNames(code);
    const colorArgs = new Set(extractColorArgs(code));
    const sizeArgs = extractSizeArgs(code);
    const resolvedIcons: Record<string, string> = {};

    // Also include all palette colors as possible icon colors
    for (const colorVal of Object.values(designSystem.colors)) {
        colorArgs.add('#' + colorVal);
    }

    // Pre-resolve all combinations of icon names × colors × sizes found in the code
    for (const name of iconNames) {
        for (const color of colorArgs) {
            for (const size of sizeArgs) {
                const key = `${name}_${color}_${size}`;
                if (resolvedIcons[key]) continue;
                try {
                    resolvedIcons[key] = await iconToBase64Png(name, color, size);
                } catch {
                    // Skip unresolvable combinations — will error at runtime if actually used
                }
            }
        }
    }

    // Synchronous iconToBase64Png that looks up pre-resolved icons
    const syncIconToBase64Png = (name: string, color: string = '#ffffff', size: number = 128): string => {
        const key = `${name}_${color}_${size}`;
        const result = resolvedIcons[key];
        if (!result) {
            throw new Error(
                `Icon "${name}" with color=${color} size=${size} was not pre-resolved. ` +
                `Available icons: ${[...new Set(iconNames)].join(', ')}`,
            );
        }
        return result;
    };

    const sandbox = {
        ...globals,
        iconToBase64Png: syncIconToBase64Png,
    };

    const context = vm.createContext(sandbox, {
        codeGeneration: { strings: false, wasm: false },
    });

    // Track slide count before execution so we can roll back on failure
    const slideCountBefore = pres.slides.length;

    try {
        const script = new vm.Script(code, {
            filename: 'slide-code.js',
        });

        script.runInContext(context, {
            timeout: EXECUTION_TIMEOUT_MS,
        });

        return {
            success: true,
            slideCount: pres.slides.length,
        };
    } catch (e) {
        const error = e as Error;

        // Roll back any slides added during the failed execution
        const slidesAdded = pres.slides.length - slideCountBefore;
        if (slidesAdded > 0) {
            pres.slides.splice(slideCountBefore, slidesAdded);
        }

        return {
            success: false,
            slideCount: pres.slides.length,
            error: error.message,
        };
    }
}

/** Extract all string literals that look like react-icons names (Fa*, Md*, Bi*, etc.) */
function extractIconNames(code: string): string[] {
    const names = new Set<string>();
    // Match any quoted string that looks like a react-icons component name
    const regex = /['"]([A-Z][a-z]{1,3}[A-Z][A-Za-z]+)['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
        const name = match[1];
        // Filter to known react-icons prefixes
        if (/^(Fa|Md|Bi|Bs|Ai|Cg|Di|Fi|Gi|Go|Gr|Hi|Im|Io|Lu|Pi|Ri|Rx|Si|Sl|Tb|Ti|Vsc|Wi)/.test(name)) {
            names.add(name);
        }
    }
    return [...names];
}

/** Extract all color string arguments (hex with #) found in the code */
function extractColorArgs(code: string): string[] {
    const colors = new Set<string>();
    colors.add('#ffffff'); // always include default
    // Match hex color strings like "#FFFFFF", "#2563EB", "#000000"
    const regex = /['"]#([0-9a-fA-F]{3,8})['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
        colors.add('#' + match[1]);
    }
    // Also match "iconToBase64Png(..., "#" + C.primary)" pattern — extract C.xxx references
    // These resolve at runtime, but we can pre-resolve common ones
    const cRefRegex = /["']#["']\s*\+\s*C\.(\w+)/g;
    while ((match = cRefRegex.exec(code)) !== null) {
        // We don't know the actual color value here, but it will be resolved at runtime
        // The sync function will be called with the actual value
    }
    return [...colors];
}

/** Extract icon size arguments found in the code */
function extractSizeArgs(code: string): number[] {
    const sizes = new Set<number>();
    sizes.add(128); // default
    sizes.add(64);  // common
    sizes.add(48);  // common
    // Match numeric literals in iconToBase64Png calls or near icon context
    const regex = /iconToBase64Png\s*\([^)]*,\s*(\d+)\s*\)/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
        sizes.add(parseInt(match[1], 10));
    }
    return [...sizes];
}
