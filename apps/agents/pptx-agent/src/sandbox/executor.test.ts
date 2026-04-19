import { describe, it, expect, beforeEach } from 'vitest';
import PptxGenJSModule from 'pptxgenjs';
import { executeSandboxedCode } from './executor.js';
import { createDesignSystem } from './context.js';

const PptxGenJS = PptxGenJSModule as any;

function makePres() {
    const pres = new PptxGenJS();
    pres.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
    pres.layout = 'WIDE';
    return pres;
}

describe('sandbox executor', () => {
    it('should execute simple slide creation code', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `const slide = pres.addSlide();
             slide.addText("Hello World", { x: 1, y: 1, w: 5, h: 1, fontSize: 24 });`,
            pres,
            ds,
        );

        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(1);
    });

    it('should provide color palette and fonts', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `const slide = pres.addSlide();
             slide.addText("Themed", { x: 1, y: 1, w: 5, h: 1, color: C.primary, fontFace: fonts.header });`,
            pres,
            ds,
        );

        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(1);
    });

    it('should provide makeCardShadow helper', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `const slide = pres.addSlide();
             const shadow = makeCardShadow();
             slide.addShape(shapes.ROUNDED_RECTANGLE, { x: 1, y: 1, w: 4, h: 3, shadow });`,
            pres,
            ds,
        );

        expect(result.success).toBe(true);
    });

    it('should handle syntax errors gracefully', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `const slide = pres.addSlide(;`, // syntax error
            pres,
            ds,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should handle runtime errors gracefully', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `undefinedVariable.doSomething();`,
            pres,
            ds,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('undefinedVariable');
    });

    it('should block access to require/process/fs', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result1 = await executeSandboxedCode(
            `const fs = require("fs");`,
            pres,
            ds,
        );
        expect(result1.success).toBe(false);

        const result2 = await executeSandboxedCode(
            `process.exit(1);`,
            pres,
            ds,
        );
        expect(result2.success).toBe(false);
    });

    it('should create multiple slides in one call', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        const result = await executeSandboxedCode(
            `for (let i = 0; i < 3; i++) {
                const slide = pres.addSlide();
                slide.addText("Slide " + (i+1), { x: 1, y: 1, w: 5, h: 1 });
             }`,
            pres,
            ds,
        );

        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(3);
    });

    it('should replaceSlide correctly through the sandbox', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        // Build 3 slides
        await executeSandboxedCode(
            `pres.addSlide().addText("Slide A", { x: 1, y: 1, w: 5, h: 1 });
             pres.addSlide().addText("Slide B", { x: 1, y: 1, w: 5, h: 1 });
             pres.addSlide().addText("Slide C", { x: 1, y: 1, w: 5, h: 1 });`,
            pres, ds,
        );
        expect(pres.slides.length).toBe(3);

        // Replace slide 2 via sandbox
        const result = await executeSandboxedCode(
            `const slide = replaceSlide(2);
             slide.addText("Replaced B", { x: 1, y: 1, w: 5, h: 1 });`,
            pres, ds,
        );
        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(3);

        // Verify slide 2 has new content
        expect(JSON.stringify(pres.slides[1]._slideObjects)).toContain('Replaced B');
        // Verify slides 1 and 3 are untouched
        expect(JSON.stringify(pres.slides[0]._slideObjects)).toContain('Slide A');
        expect(JSON.stringify(pres.slides[2]._slideObjects)).toContain('Slide C');
    });

    it('should replaceSlide multiple times without index shifting through sandbox', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        // Build 5 slides
        await executeSandboxedCode(
            `for (let i = 1; i <= 5; i++) {
                pres.addSlide().addText("Slide " + i, { x: 1, y: 1, w: 5, h: 1 });
             }`,
            pres, ds,
        );
        expect(pres.slides.length).toBe(5);

        // Replace slides 2 and 4 in a single sandbox call
        const result = await executeSandboxedCode(
            `const s2 = replaceSlide(2);
             s2.addText("New 2", { x: 1, y: 1, w: 5, h: 1 });
             const s4 = replaceSlide(4);
             s4.addText("New 4", { x: 1, y: 1, w: 5, h: 1 });`,
            pres, ds,
        );
        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(5);

        expect(JSON.stringify(pres.slides[0]._slideObjects)).toContain('Slide 1');
        expect(JSON.stringify(pres.slides[1]._slideObjects)).toContain('New 2');
        expect(JSON.stringify(pres.slides[2]._slideObjects)).toContain('Slide 3');
        expect(JSON.stringify(pres.slides[3]._slideObjects)).toContain('New 4');
        expect(JSON.stringify(pres.slides[4]._slideObjects)).toContain('Slide 5');
    });

    it('should accumulate slides across multiple calls', async () => {
        const pres = makePres();
        const ds = createDesignSystem();

        await executeSandboxedCode(
            `pres.addSlide().addText("First", { x: 1, y: 1, w: 5, h: 1 });`,
            pres, ds,
        );
        const result = await executeSandboxedCode(
            `pres.addSlide().addText("Second", { x: 1, y: 1, w: 5, h: 1 });`,
            pres, ds,
        );

        expect(result.success).toBe(true);
        expect(result.slideCount).toBe(2);
    });
});
