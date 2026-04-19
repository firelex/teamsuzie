import { describe, it, expect } from 'vitest';
import PptxGenJSModule from 'pptxgenjs';
import { createDesignSystem, makeCardShadow, buildSandboxGlobals } from './context.js';

const PptxGenJS = PptxGenJSModule as any;

describe('design system', () => {
    it('should create default design system', () => {
        const ds = createDesignSystem();
        expect(ds.colors.primary).toBe('2563EB');
        expect(ds.colors.dark).toBe('111827');
        expect(ds.fonts.header).toBe('Helvetica Neue');
        expect(ds.fonts.body).toBe('Helvetica Neue');
    });

    it('should merge custom colors while keeping defaults', () => {
        const ds = createDesignSystem({ colors: { primary: 'FF0000' } });
        expect(ds.colors.primary).toBe('FF0000');
        expect(ds.colors.secondary).toBe('7C3AED'); // default preserved
    });

    it('should merge custom fonts', () => {
        const ds = createDesignSystem({ fonts: { header: 'Arial', body: 'Times' } });
        expect(ds.fonts.header).toBe('Arial');
        expect(ds.fonts.body).toBe('Times');
    });
});

describe('makeCardShadow', () => {
    it('should return a shadow config object', () => {
        const shadow = makeCardShadow() as any;
        expect(shadow.type).toBe('outer');
        expect(shadow.blur).toBe(3);
        expect(shadow.offset).toBe(2);
        expect(shadow.color).toBe('000000');
        expect(shadow.opacity).toBe(0.35);
    });
});

describe('replaceSlide', () => {
    it('should replace a slide at the correct position', () => {
        const pres = new PptxGenJS();
        pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
        pres.layout = 'WIDE';
        const ds = createDesignSystem();
        const globals = buildSandboxGlobals(pres, ds);

        // Build 5 slides with unique content
        for (let i = 1; i <= 5; i++) {
            const slide = globals.pres.addSlide();
            slide.addText(`Slide ${i}`, { x: 1, y: 1, w: 5, h: 1 });
        }
        expect(pres.slides.length).toBe(5);

        // Replace slide 3
        const newSlide = globals.replaceSlide(3);
        newSlide.addText('Replaced Slide 3', { x: 1, y: 1, w: 5, h: 1 });

        // Should still have 5 slides
        expect(pres.slides.length).toBe(5);

        // The replaced slide should be at index 2 (0-based)
        // Check that slides before and after are untouched
        // We can verify by checking the internal _slideObjects
        const slide3Objects = pres.slides[2]._slideObjects;
        expect(slide3Objects.length).toBe(1);
        // The new slide's text should be "Replaced Slide 3"
        const textContent = slide3Objects[0]?.text?.[0]?.text || slide3Objects[0]?.text;
        expect(JSON.stringify(textContent)).toContain('Replaced Slide 3');
    });

    it('should handle multiple replacements without index shifting', () => {
        const pres = new PptxGenJS();
        pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
        pres.layout = 'WIDE';
        const ds = createDesignSystem();
        const globals = buildSandboxGlobals(pres, ds);

        // Build 5 slides
        for (let i = 1; i <= 5; i++) {
            globals.pres.addSlide().addText(`Original ${i}`, { x: 1, y: 1, w: 5, h: 1 });
        }

        // Replace slides 2 and 4 (non-adjacent)
        const new2 = globals.replaceSlide(2);
        new2.addText('Fixed 2', { x: 1, y: 1, w: 5, h: 1 });

        const new4 = globals.replaceSlide(4);
        new4.addText('Fixed 4', { x: 1, y: 1, w: 5, h: 1 });

        expect(pres.slides.length).toBe(5);

        // Verify slide 2 was replaced
        expect(JSON.stringify(pres.slides[1]._slideObjects)).toContain('Fixed 2');
        // Verify slide 4 was replaced
        expect(JSON.stringify(pres.slides[3]._slideObjects)).toContain('Fixed 4');
        // Verify slide 3 is still original
        expect(JSON.stringify(pres.slides[2]._slideObjects)).toContain('Original 3');
    });

    it('should throw for out-of-range slide numbers', () => {
        const pres = new PptxGenJS();
        pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
        pres.layout = 'WIDE';
        const ds = createDesignSystem();
        const globals = buildSandboxGlobals(pres, ds);

        globals.pres.addSlide();
        globals.pres.addSlide();

        expect(() => globals.replaceSlide(0)).toThrow();
        expect(() => globals.replaceSlide(3)).toThrow();
    });
});

describe('shadow clamping via sandbox wrapper', () => {
    it('should clamp EMU shadow values passed through addShape', () => {
        const pres = new PptxGenJS();
        pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
        pres.layout = 'WIDE';
        const ds = createDesignSystem();
        const globals = buildSandboxGlobals(pres, ds);

        const slide = globals.pres.addSlide();
        // Simulate LLM passing EMU values
        const opts = {
            x: 0.5, y: 1.3, w: 2.8, h: 3.5,
            fill: { color: 'FFFFFF' },
            shadow: { type: 'outer', blur: 38100, offset: 25400, angle: 5400000, color: '000000', opacity: 35000 },
        };
        slide.addShape('roundRect', opts);

        // Shadow values should have been auto-corrected from EMUs to points
        expect(opts.shadow.blur).toBe(3);
        expect(opts.shadow.offset).toBe(2);
        expect(opts.shadow.opacity).toBeCloseTo(0.35, 1);
        expect(opts.shadow.angle).toBe(90);
    });
});
