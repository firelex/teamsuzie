import { describe, it, expect, beforeAll } from 'vitest';
import { initDocs, searchDocs } from './docs.js';

describe('docs service', () => {
    beforeAll(() => {
        initDocs();
    });

    it('should index pptxgenjs type definitions', () => {
        const results = searchDocs('Slide');
        expect(results.length).toBeGreaterThan(0);
    });

    it('should find table-related docs', () => {
        const results = searchDocs('table');
        expect(results.length).toBeGreaterThan(0);
        const combined = results.map(r => r.heading + ' ' + r.content).join(' ').toLowerCase();
        expect(combined).toContain('table');
    });

    it('should find chart-related docs', () => {
        const results = searchDocs('chart');
        expect(results.length).toBeGreaterThan(0);
    });

    it('should find text/font-related docs', () => {
        const results = searchDocs('text font');
        expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for nonsense queries', () => {
        const results = searchDocs('xyzzy_nonexistent_thing_12345');
        expect(results.length).toBe(0);
    });

    it('should limit results to 5', () => {
        const results = searchDocs('options');
        expect(results.length).toBeLessThanOrEqual(5);
    });
});
