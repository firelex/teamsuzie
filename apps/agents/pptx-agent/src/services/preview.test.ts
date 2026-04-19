import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import PptxGenJSModule from 'pptxgenjs';
import { initializePresentation, resetState } from './presentation.js';
import { previewSlides } from './preview.js';

const PptxGenJS = PptxGenJSModule as any;
const describePreview = process.env.PPTX_AGENT_RUN_PREVIEW_TESTS ? describe : describe.skip;

describePreview('preview service', () => {
    const tmpDir = path.join(import.meta.dirname, '../../output/.test-preview');

    beforeEach(() => {
        resetState();
        process.env.PPTX_AGENT_OUTPUT_DIR = tmpDir;
    });

    afterEach(async () => {
        resetState();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

    it('should convert a simple presentation to JPEG previews', async () => {
        const state = initializePresentation('Preview Test');
        state.pres.addSlide().addText('Slide 1', { x: 1, y: 1, w: 5, h: 1, fontSize: 24 });
        state.pres.addSlide().addText('Slide 2', { x: 1, y: 1, w: 5, h: 1, fontSize: 24 });

        const previews = await previewSlides();

        expect(previews.length).toBe(2);
        expect(previews[0].slide_number).toBe(1);
        expect(previews[1].slide_number).toBe(2);
        // Should be valid base64
        expect(previews[0].image_base64.length).toBeGreaterThan(100);
        expect(() => Buffer.from(previews[0].image_base64, 'base64')).not.toThrow();
    }, 30_000);

    it('should filter by slide numbers', async () => {
        const state = initializePresentation('Filter Test');
        state.pres.addSlide().addText('Slide 1', { x: 1, y: 1, w: 5, h: 1 });
        state.pres.addSlide().addText('Slide 2', { x: 1, y: 1, w: 5, h: 1 });
        state.pres.addSlide().addText('Slide 3', { x: 1, y: 1, w: 5, h: 1 });

        const previews = await previewSlides([1, 3]);

        expect(previews.length).toBe(2);
        expect(previews[0].slide_number).toBe(1);
        expect(previews[1].slide_number).toBe(3);
    }, 30_000);

    it('should throw without initialization', async () => {
        resetState();
        await expect(previewSlides()).rejects.toThrow('No presentation initialized');
    });
});
