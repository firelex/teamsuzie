import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runAgentLoop } from './loop.js';
import { resetState } from '../services/presentation.js';
import { initDocs } from '../services/docs.js';

const tmpDir = path.resolve(import.meta.dirname, '../../output/.test-integration');
const describeIntegration = process.env.PPTX_AGENT_RUN_INTEGRATION_TESTS ? describe : describe.skip;

describeIntegration('agent loop (integration — requires LLM proxy)', () => {
    beforeEach(() => {
        resetState();
        process.env.PPTX_AGENT_OUTPUT_DIR = tmpDir;
    });

    afterEach(async () => {
        resetState();
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

    it('should generate a small presentation end-to-end', async () => {
        initDocs();

        const logs: string[] = [];
        const result = await runAgentLoop(
            'Create a 5-slide presentation about why cats are great. Include a title slide, 3 content slides with varied layouts, and a closing slide.',
            undefined,
            (msg) => {
                logs.push(msg);
                console.log(`  ${msg}`);
            },
        );

        expect(result.filePath).toBeTruthy();
        expect(result.slideCount).toBeGreaterThanOrEqual(5);

        const stat = await fs.stat(result.filePath);
        expect(stat.size).toBeGreaterThan(0);

        console.log(`Generated: ${result.filePath} (${result.slideCount} slides, ${(stat.size / 1024).toFixed(1)} KB)`);
    }, 120_000);
});
