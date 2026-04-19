import { iconToBase64Png } from './icons.js';

export interface DesignSystem {
    colors: Record<string, string>;
    fonts: { header: string; body: string };
}

const DEFAULT_COLORS: Record<string, string> = {
    primary: '2563EB',
    primaryDark: '1E40AF',
    secondary: '7C3AED',
    accent: '059669',
    dark: '111827',
    medium: '4B5563',
    light: '9CA3AF',
    subtle: 'F3F4F6',
    white: 'FFFFFF',
    black: '000000',
    success: '10B981',
    warning: 'F59E0B',
    danger: 'EF4444',
    info: '3B82F6',
};

const DEFAULT_FONTS = {
    header: 'Helvetica Neue',
    body: 'Helvetica Neue',
};

export function createDesignSystem(theme?: { colors?: Record<string, string>; fonts?: { header: string; body: string } }): DesignSystem {
    return {
        colors: { ...DEFAULT_COLORS, ...theme?.colors },
        fonts: { ...DEFAULT_FONTS, ...theme?.fonts },
    };
}

export function makeCardShadow(): object {
    return { type: 'outer', blur: 3, offset: 2, angle: 90, color: '000000', opacity: 0.35 };
}

export function addFooter(slide: any, text: string, C: Record<string, string>, fonts: { header: string; body: string }): void {
    slide.addText(text, {
        x: 0.5,
        y: 5.15,
        w: 9.0,
        h: 0.35,
        fontSize: 8,
        color: C.light || '9CA3AF',
        fontFace: fonts.body,
        align: 'left',
    });
}

// PptxGenJS ShapeType uses internal names (e.g. 'roundRect').
// The system prompt uses UPPER_CASE enum names. Build a mapping.
const SHAPE_ENUM: Record<string, string> = {
    RECTANGLE: 'rect',
    ROUNDED_RECTANGLE: 'roundRect',
    OVAL: 'ellipse',
    LINE: 'line',
    TRIANGLE: 'triangle',
    RIGHT_TRIANGLE: 'rtTriangle',
    DIAMOND: 'diamond',
    PENTAGON: 'homePentagon',
    HEXAGON: 'hexagon',
    CLOUD: 'cloud',
    STAR_4_POINT: 'star4',
    STAR_5_POINT: 'star5',
    STAR_6_POINT: 'star6',
    ARROW_RIGHT: 'rightArrow',
    ARROW_LEFT: 'leftArrow',
    ARROW_UP: 'upArrow',
    ARROW_DOWN: 'downArrow',
    CHEVRON: 'chevron',
    CALLOUT_RECTANGLE: 'wedgeRectCallout',
    CALLOUT_ROUNDED_RECTANGLE: 'wedgeRoundRectCallout',
    CALLOUT_OVAL: 'wedgeEllipseCallout',
    PLUS: 'mathPlus',
    BLOCK_ARC: 'blockArc',
    DONUT: 'donut',
    NO_SYMBOL: 'noSmoking',
    FLOWCHART_PROCESS: 'flowChartProcess',
    FLOWCHART_DECISION: 'flowChartDecision',
    FLOWCHART_TERMINATOR: 'flowChartTerminator',
};

const SLIDE_W = 10.0;
const SLIDE_H = 5.625;

function clampShadow(shadow: any): void {
    if (!shadow || typeof shadow !== 'object') return;
    // PptxGenJS shadow values: blur 0-100 (points), offset 0-200 (points), opacity 0-1, angle 0-359
    // LLMs frequently pass EMU values (e.g. 38100 instead of 3) — detect and convert
    if (typeof shadow.blur === 'number') {
        if (shadow.blur > 100) shadow.blur = Math.round(shadow.blur / 12700) || 3;
        shadow.blur = Math.min(100, Math.max(0, shadow.blur));
    }
    if (typeof shadow.offset === 'number') {
        if (shadow.offset > 200) shadow.offset = Math.round(shadow.offset / 12700) || 2;
        shadow.offset = Math.min(200, Math.max(0, shadow.offset));
    }
    if (typeof shadow.opacity === 'number') {
        if (shadow.opacity > 1) shadow.opacity = shadow.opacity / 100000;
        shadow.opacity = Math.min(1, Math.max(0, shadow.opacity));
    }
    if (typeof shadow.angle === 'number') {
        if (shadow.angle > 360) shadow.angle = Math.round(shadow.angle / 60000) || 90;
        shadow.angle = Math.min(359, Math.max(0, shadow.angle));
    }
}

function clampBounds(opts: any): any {
    if (!opts || typeof opts !== 'object') return opts;
    const x = typeof opts.x === 'number' ? opts.x : 0;
    const y = typeof opts.y === 'number' ? opts.y : 0;
    if (typeof opts.w === 'number' && x + opts.w > SLIDE_W) {
        opts.w = Math.max(0.1, SLIDE_W - x);
    }
    if (typeof opts.h === 'number' && y + opts.h > SLIDE_H) {
        opts.h = Math.max(0.1, SLIDE_H - y);
    }
    if (typeof opts.x === 'number' && opts.x < 0) opts.x = 0;
    if (typeof opts.y === 'number' && opts.y < 0) opts.y = 0;
    if (opts.shadow) clampShadow(opts.shadow);
    return opts;
}

function wrapSlide(slide: any): any {
    const origAddText = slide.addText.bind(slide);
    const origAddShape = slide.addShape.bind(slide);
    const origAddImage = slide.addImage.bind(slide);
    const origAddTable = slide.addTable.bind(slide);

    slide.addText = (text: any, opts?: any) => { clampBounds(opts); return origAddText(text, opts); };
    slide.addShape = (shape: any, opts?: any) => { clampBounds(opts); return origAddShape(shape, opts); };
    slide.addImage = (opts?: any) => { clampBounds(opts); return origAddImage(opts); };
    slide.addTable = (rows: any, opts?: any) => { clampBounds(opts); return origAddTable(rows, opts); };

    return slide;
}

function wrapPres(pres: any): any {
    const origAddSlide = pres.addSlide.bind(pres);
    pres.addSlide = (...args: any[]) => {
        const slide = origAddSlide(...args);
        return wrapSlide(slide);
    };
    return pres;
}

function removeSlide(pres: any, slideNumber: number): boolean {
    const idx = slideNumber - 1;
    if (idx < 0 || idx >= pres.slides.length) return false;
    pres.slides.splice(idx, 1);
    return true;
}

function insertSlide(pres: any, slideNumber: number, addSlideFn: (...args: any[]) => any): any {
    const slide = addSlideFn();
    // addSlide appended at the end — move it to the desired position
    const fromIdx = pres.slides.length - 1;
    const toIdx = Math.max(0, Math.min(slideNumber - 1, pres.slides.length - 1));
    if (fromIdx !== toIdx) {
        const [removed] = pres.slides.splice(fromIdx, 1);
        pres.slides.splice(toIdx, 0, removed);
    }
    return slide;
}

function replaceSlide(pres: any, slideNumber: number, addSlideFn: (...args: any[]) => any): any {
    const idx = slideNumber - 1;
    if (idx < 0 || idx >= pres.slides.length) {
        throw new Error(`Cannot replace slide ${slideNumber}: only ${pres.slides.length} slides exist`);
    }
    console.log(`[REPLACE-SLIDE] Replacing slide ${slideNumber} of ${pres.slides.length} total`);
    // Remove the old slide
    pres.slides.splice(idx, 1);
    const slide = addSlideFn();
    // Move it from the end to the original position
    const fromIdx = pres.slides.length - 1;
    if (fromIdx !== idx) {
        const [moved] = pres.slides.splice(fromIdx, 1);
        pres.slides.splice(idx, 0, moved);
    }
    return slide;
}

export function buildSandboxGlobals(pres: any, designSystem: DesignSystem) {
    const { colors: C, fonts } = designSystem;

    // Merge our enum names with the raw ShapeType (internal names also work)
    const shapes = { ...SHAPE_ENUM, ...(pres.ShapeType || {}) };

    // Wrap pres so all slides get bounds-clamping on addText/addShape/addImage
    const wrappedPres = wrapPres(pres);

    return {
        pres: wrappedPres,
        C,
        fonts,
        makeCardShadow,
        addFooter: (slide: any, text: string) => addFooter(slide, text, C, fonts),
        removeSlide: (slideNumber: number) => removeSlide(pres, slideNumber),
        insertSlide: (slideNumber: number) => insertSlide(pres, slideNumber, wrappedPres.addSlide.bind(wrappedPres)),
        replaceSlide: (slideNumber: number) => replaceSlide(pres, slideNumber, wrappedPres.addSlide.bind(wrappedPres)),
        iconToBase64Png,
        shapes,
        console: {
            log: (...args: unknown[]) => console.log('[SANDBOX]', ...args),
            warn: (...args: unknown[]) => console.warn('[SANDBOX]', ...args),
            error: (...args: unknown[]) => console.error('[SANDBOX]', ...args),
        },
    };
}
