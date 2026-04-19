import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { saveTempPresentation } from './presentation.js';

const execAsync = promisify(exec);

export interface SlidePreview {
    slide_number: number;
    image_base64: string;
}

export async function previewSlides(slideNumbers?: number[]): Promise<SlidePreview[]> {
    const pptxPath = await saveTempPresentation();
    const tmpDir = path.dirname(pptxPath);
    const baseName = path.basename(pptxPath, '.pptx');
    const pdfPath = path.join(tmpDir, `${baseName}.pdf`);

    try {
        // Convert PPTX to PDF via LibreOffice
        await execAsync(
            `soffice --headless --convert-to pdf --outdir "${tmpDir}" "${pptxPath}"`,
            { timeout: 60_000 },
        );

        // Convert PDF pages to JPEG via pdftoppm
        const jpegPrefix = path.join(tmpDir, `${baseName}_slide`);
        await execAsync(
            `pdftoppm -jpeg -r 150 "${pdfPath}" "${jpegPrefix}"`,
            { timeout: 60_000 },
        );

        // Find generated JPEG files
        const files = await fs.readdir(tmpDir);
        const jpegFiles = files
            .filter(f => f.startsWith(`${baseName}_slide-`) && f.endsWith('.jpg'))
            .sort();

        const previews: SlidePreview[] = [];

        for (let i = 0; i < jpegFiles.length; i++) {
            const slideNum = i + 1;
            if (slideNumbers && !slideNumbers.includes(slideNum)) continue;

            const jpegPath = path.join(tmpDir, jpegFiles[i]);
            const buffer = await fs.readFile(jpegPath);
            previews.push({
                slide_number: slideNum,
                image_base64: buffer.toString('base64'),
            });
        }

        return previews;
    } finally {
        // Cleanup temp files
        const files = await fs.readdir(tmpDir);
        const toDelete = files.filter(f => f.startsWith(baseName));
        await Promise.all(toDelete.map(f => fs.unlink(path.join(tmpDir, f)).catch(() => {})));
    }
}
