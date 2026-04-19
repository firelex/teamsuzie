import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import PptxGenJSModule from 'pptxgenjs';
import { config } from '../config.js';
import { createDesignSystem, type DesignSystem } from '../sandbox/context.js';

const execAsync = promisify(exec);

// pptxgenjs exports the class directly via module.exports
const PptxGenJS = PptxGenJSModule as any;

export interface PresentationState {
    pres: any;
    designSystem: DesignSystem;
    title: string;
}

let currentState: PresentationState | null = null;

export function initializePresentation(
    title: string,
    theme?: { colors?: Record<string, string>; fonts?: { header: string; body: string } },
): PresentationState {
    const pres = new PptxGenJS();
    const designSystem = createDesignSystem(theme);

    pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
    pres.layout = 'WIDE';
    pres.title = title;
    pres.author = 'PPTX Agent';

    currentState = { pres, designSystem, title };
    return currentState;
}

export function getState(): PresentationState | null {
    return currentState;
}

export function resetState(): void {
    currentState = null;
}

const ONEPT = 12700;

/**
 * PptxGenJS bugs workaround — patches the PPTX ZIP in-place:
 * 1. Removes phantom slideMaster entries from [Content_Types].xml
 * 2. Fixes double-converted shadow values (blur/offset/alpha) in slide XML
 *    PptxGenJS internally calls valToPts() twice on shadow.blur, producing values
 *    like 483870000 instead of 38100. We detect and divide out the extra factor.
 */
async function fixPptxBugs(filePath: string): Promise<void> {
    const tmpDir = path.join(path.dirname(filePath), '.fix-' + Date.now());
    try {
        await fs.mkdir(tmpDir, { recursive: true });
        await execAsync(`unzip -o -q "${filePath}" -d "${tmpDir}"`);

        let changed = false;

        // Fix 1: Remove phantom slideMaster entries from [Content_Types].xml
        const ctPath = path.join(tmpDir, '[Content_Types].xml');
        let ctContent = await fs.readFile(ctPath, 'utf-8');
        const smDir = path.join(tmpDir, 'ppt', 'slideMasters');
        const existingMasters = new Set<string>();
        try {
            for (const f of await fs.readdir(smDir)) {
                if (f.endsWith('.xml')) existingMasters.add(f);
            }
        } catch {}
        const ctOriginal = ctContent;
        ctContent = ctContent.replace(
            /<Override\s+PartName="\/ppt\/slideMasters\/(slideMaster\d+\.xml)"[^>]*\/>/g,
            (match, filename) => existingMasters.has(filename) ? match : '',
        );
        if (ctContent !== ctOriginal) {
            await fs.writeFile(ctPath, ctContent);
            changed = true;
        }

        // Fix 2: Remove orphaned notesSlide entries from [Content_Types].xml
        // replaceSlide removes slides from pres.slides but PptxGenJS still writes
        // Content_Types entries for the notes slides of removed slides.
        const notesDir = path.join(tmpDir, 'ppt', 'notesSlides');
        const existingNotes = new Set<string>();
        try {
            for (const f of await fs.readdir(notesDir)) {
                if (f.endsWith('.xml')) existingNotes.add(f);
            }
        } catch {}
        // Re-read ctContent (may have been modified by fix 1)
        ctContent = await fs.readFile(ctPath, 'utf-8');
        const ctBeforeNotes = ctContent;
        ctContent = ctContent.replace(
            /<Override\s+PartName="\/ppt\/notesSlides\/(notesSlide\d+\.xml)"[^>]*\/>/g,
            (match, filename) => existingNotes.has(filename) ? match : '',
        );
        if (ctContent !== ctBeforeNotes) {
            await fs.writeFile(ctPath, ctContent);
            changed = true;
        }

        // Fix 3: Fix shadow values in slide XML files
        // PptxGenJS double-converts: blur 3 -> valToPts(3)=38100 -> stored -> valToPts(38100)=483870000
        // Valid blurRad/dist should be < 10,000,000 (about 800pt). Anything above is double-converted.
        const slidesDir = path.join(tmpDir, 'ppt', 'slides');
        try {
            const slideFiles = (await fs.readdir(slidesDir)).filter(f => f.endsWith('.xml'));
            for (const sf of slideFiles) {
                const slidePath = path.join(slidesDir, sf);
                let xml = await fs.readFile(slidePath, 'utf-8');
                const xmlOriginal = xml;

                // Fix blurRad and dist: divide by ONEPT if unreasonably large
                xml = xml.replace(/blurRad="(\d+)"/g, (match, val) => {
                    const n = parseInt(val, 10);
                    return n > 10_000_000 ? `blurRad="${Math.round(n / ONEPT)}"` : match;
                });
                xml = xml.replace(/dist="(\d+)"/g, (match, val) => {
                    const n = parseInt(val, 10);
                    return n > 10_000_000 ? `dist="${Math.round(n / ONEPT)}"` : match;
                });
                // Fix alpha: should be 0-100000 (0-100%). Anything > 100000 is wrong.
                xml = xml.replace(/<a:alpha val="(\d+)"\/>/g, (match, val) => {
                    const n = parseInt(val, 10);
                    return n > 100_000 ? `<a:alpha val="${Math.round(n / ONEPT)}"/>` : match;
                });
                // Fix dir (angle): should be 0-21600000 (0-360 degrees in 60000ths). Anything > is wrong.
                xml = xml.replace(/dir="(\d+)"/g, (match, val) => {
                    const n = parseInt(val, 10);
                    return n > 21_600_000 ? `dir="${Math.round(n / ONEPT)}"` : match;
                });

                if (xml !== xmlOriginal) {
                    await fs.writeFile(slidePath, xml);
                    changed = true;
                }
            }
        } catch {}

        if (changed) {
            await fs.unlink(filePath);
            await execAsync(`cd "${tmpDir}" && zip -r -q "${filePath}" .`);
        }
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

/**
 * PptxGenJS mutates shadow objects in-place during writeFile() (converting
 * point values to EMUs). If writeFile() is called again (e.g. preview then
 * final save), values get double-converted. This snapshots shadow objects
 * before write and restores them after.
 */
async function safeWriteFile(pres: any, fileName: string): Promise<void> {
    // Snapshot all shadow objects
    const snapshots: Array<{ obj: any; original: any }> = [];
    for (const slide of pres.slides) {
        for (const obj of slide._slideObjects || []) {
            if (obj.options?.shadow) {
                snapshots.push({ obj: obj.options, original: { ...obj.options.shadow } });
            }
        }
    }

    await pres.writeFile({ fileName });

    // Restore shadow objects to pre-write state
    for (const { obj, original } of snapshots) {
        obj.shadow = original;
    }
}

export async function savePresentation(filename: string): Promise<{ filePath: string; slideCount: number }> {
    if (!currentState) {
        throw new Error('No presentation initialized. Call initialize_presentation first.');
    }

    await fs.mkdir(config.outputDir, { recursive: true });

    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const finalName = safeName.endsWith('.pptx') ? safeName : `${safeName}.pptx`;
    const filePath = path.join(config.outputDir, finalName);

    await safeWriteFile(currentState.pres, filePath);
    await fixPptxBugs(filePath);

    return { filePath, slideCount: currentState.pres.slides.length };
}

export async function saveTempPresentation(): Promise<string> {
    if (!currentState) {
        throw new Error('No presentation initialized.');
    }

    const tmpDir = path.join(config.outputDir, '.tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const tmpPath = path.join(tmpDir, `preview_${Date.now()}.pptx`);
    await safeWriteFile(currentState.pres, tmpPath);

    return tmpPath;
}
