import { describe, it, expect } from 'vitest';
import { toolDefinitions } from './tools.js';

describe('tool definitions', () => {
    it('should define all 7 tools', () => {
        expect(toolDefinitions.length).toBe(7);
    });

    const expectedTools = [
        'initialize_presentation',
        'add_slides',
        'preview_slides',
        'read_pptxgenjs_docs',
        'finalize_presentation',
        'browse_layout_patterns',
        'browse_color_palettes',
    ];

    for (const name of expectedTools) {
        it(`should define ${name}`, () => {
            const tool = toolDefinitions.find(t => t.function.name === name);
            expect(tool).toBeDefined();
            expect(tool!.type).toBe('function');
            expect(tool!.function.description).toBeTruthy();
            expect(tool!.function.parameters).toBeDefined();
        });
    }

    it('should require title for initialize_presentation', () => {
        const tool = toolDefinitions.find(t => t.function.name === 'initialize_presentation')!;
        expect((tool.function.parameters as any).required).toContain('title');
    });

    it('should require code and description for add_slides', () => {
        const tool = toolDefinitions.find(t => t.function.name === 'add_slides')!;
        const required = (tool.function.parameters as any).required;
        expect(required).toContain('code');
        expect(required).toContain('description');
    });

    it('should require filename for finalize_presentation', () => {
        const tool = toolDefinitions.find(t => t.function.name === 'finalize_presentation')!;
        expect((tool.function.parameters as any).required).toContain('filename');
    });

    it('should have optional slide_numbers for preview_slides', () => {
        const tool = toolDefinitions.find(t => t.function.name === 'preview_slides')!;
        const required = (tool.function.parameters as any).required;
        expect(required).toBeUndefined();
    });
});
