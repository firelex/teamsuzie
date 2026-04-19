import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initializePresentation, getState, resetState, savePresentation } from './presentation.js';

describe('presentation service', () => {
    beforeEach(() => {
        resetState();
    });

    afterEach(() => {
        resetState();
    });

    it('should initialize a presentation with default theme', () => {
        const state = initializePresentation('Test Deck');
        expect(state).toBeDefined();
        expect(state.title).toBe('Test Deck');
        expect(state.designSystem.colors.primary).toBe('2563EB');
        expect(state.designSystem.fonts.header).toBe('Helvetica Neue');
        expect(state.pres).toBeDefined();
    });

    it('should initialize with custom theme overrides', () => {
        const state = initializePresentation('Custom Deck', {
            colors: { primary: 'FF0000', accent: '00FF00' },
            fonts: { header: 'Arial', body: 'Georgia' },
        });
        expect(state.designSystem.colors.primary).toBe('FF0000');
        expect(state.designSystem.colors.accent).toBe('00FF00');
        expect(state.designSystem.colors.dark).toBe('111827'); // default preserved
        expect(state.designSystem.fonts.header).toBe('Arial');
        expect(state.designSystem.fonts.body).toBe('Georgia');
    });

    it('should track state via getState', () => {
        expect(getState()).toBeNull();
        initializePresentation('Test');
        expect(getState()).not.toBeNull();
        resetState();
        expect(getState()).toBeNull();
    });

    it('should save a presentation to disk', async () => {
        const tmpDir = path.join(import.meta.dirname, '../../output/.test-tmp');
        process.env.PPTX_AGENT_OUTPUT_DIR = tmpDir;

        // Re-import to pick up new env (config is evaluated at import time, so set before init)
        const state = initializePresentation('Save Test');
        state.pres.addSlide().addText('Hello', { x: 1, y: 1, w: 5, h: 1 });

        const result = await savePresentation('test-output.pptx');
        expect(result.slideCount).toBe(1);
        expect(result.filePath).toContain('test-output.pptx');

        // Verify file exists
        const stat = await fs.stat(result.filePath);
        expect(stat.size).toBeGreaterThan(0);

        // Cleanup
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should sanitize filenames', async () => {
        const tmpDir = path.join(import.meta.dirname, '../../output/.test-tmp2');
        process.env.PPTX_AGENT_OUTPUT_DIR = tmpDir;

        initializePresentation('Sanitize Test');
        getState()!.pres.addSlide();

        const result = await savePresentation('my file (v2).pptx');
        expect(path.basename(result.filePath)).toBe('my_file__v2_.pptx');

        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should throw when saving without initialization', async () => {
        await expect(savePresentation('nope.pptx')).rejects.toThrow('No presentation initialized');
    });
});
