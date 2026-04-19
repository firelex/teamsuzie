import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

interface DocSection {
    heading: string;
    content: string;
}

let indexedSections: DocSection[] = [];

function findPptxgenPackagePath(): string | null {
    try {
        const require = createRequire(import.meta.url);
        const mainPath = require.resolve('pptxgenjs');
        return path.dirname(mainPath);
    } catch {
        return null;
    }
}

function indexDtsFile(content: string): DocSection[] {
    const sections: DocSection[] = [];
    const lines = content.split('\n');

    let currentHeading = 'General';
    let currentLines: string[] = [];

    for (const line of lines) {
        // Detect interface/type/enum declarations as section boundaries
        const interfaceMatch = line.match(/^\s*(?:export\s+)?(?:interface|type|enum)\s+(\w+)/);
        if (interfaceMatch) {
            if (currentLines.length > 0) {
                sections.push({ heading: currentHeading, content: currentLines.join('\n') });
            }
            currentHeading = interfaceMatch[1];
            currentLines = [line];
        } else {
            currentLines.push(line);
        }
    }

    if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n') });
    }

    return sections;
}

export function initDocs(): void {
    const pkgPath = findPptxgenPackagePath();
    if (!pkgPath) {
        console.warn('[DOCS] Could not find pptxgenjs package path');
        return;
    }

    // Try types/index.d.ts first, then fall back to other locations
    const candidates = [
        path.join(pkgPath, 'types', 'index.d.ts'),
        path.join(pkgPath, '..', 'types', 'index.d.ts'),
        path.join(pkgPath, 'dist', 'pptxgenjs.d.ts'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            const content = fs.readFileSync(candidate, 'utf-8');
            indexedSections = indexDtsFile(content);
            console.log(`[DOCS] Indexed ${indexedSections.length} sections from ${candidate}`);
            return;
        }
    }

    console.warn('[DOCS] No .d.ts file found for pptxgenjs');
}

export function searchDocs(topic: string): DocSection[] {
    const keywords = topic.toLowerCase().split(/\s+/);

    const scored = indexedSections.map(section => {
        const text = (section.heading + ' ' + section.content).toLowerCase();
        let score = 0;
        for (const kw of keywords) {
            if (section.heading.toLowerCase().includes(kw)) score += 10;
            const matches = text.split(kw).length - 1;
            score += matches;
        }
        return { section, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.section);
}
