import React from 'react';
import ReactDOMServer from 'react-dom/server';

const iconCache = new Map<string, Buffer>();
let sharpModulePromise: Promise<any> | null = null;

async function loadSharp(): Promise<any> {
    if (!sharpModulePromise) {
        sharpModulePromise = import('sharp')
            .then((mod) => mod.default ?? mod)
            .catch((error) => {
                throw new Error(`pptx-agent: sharp module unavailable: ${(error as Error).message}`);
            });
    }
    return sharpModulePromise;
}

async function loadIconModule(iconName: string): Promise<React.ComponentType<{ size?: number; color?: string }> | null> {
    const prefix = iconName.slice(0, 2).toLowerCase();
    const packMap: Record<string, string> = {
        ai: 'react-icons/ai',
        bi: 'react-icons/bi',
        bs: 'react-icons/bs',
        cg: 'react-icons/cg',
        ci: 'react-icons/ci',
        di: 'react-icons/di',
        fa: 'react-icons/fa',
        fc: 'react-icons/fc',
        fi: 'react-icons/fi',
        gi: 'react-icons/gi',
        go: 'react-icons/go',
        gr: 'react-icons/gr',
        hi: 'react-icons/hi',
        im: 'react-icons/im',
        io: 'react-icons/io5',
        lu: 'react-icons/lu',
        md: 'react-icons/md',
        pi: 'react-icons/pi',
        ri: 'react-icons/ri',
        rx: 'react-icons/rx',
        si: 'react-icons/si',
        sl: 'react-icons/sl',
        tb: 'react-icons/tb',
        tfi: 'react-icons/tfi',
        ti: 'react-icons/ti',
        vsc: 'react-icons/vsc',
        wi: 'react-icons/wi',
    };

    // Try 2-char prefix first, then 3-char
    let packName = packMap[prefix];
    if (!packName && iconName.length >= 3) {
        packName = packMap[iconName.slice(0, 3).toLowerCase()];
    }
    if (!packName) return null;

    try {
        const mod = await import(packName);
        return mod[iconName] || null;
    } catch {
        return null;
    }
}

function renderSvgString(IconComponent: React.ComponentType<{ size?: number; color?: string }>, color: string, size: number): string {
    const element = React.createElement(IconComponent, { size, color });
    return ReactDOMServer.renderToStaticMarkup(element);
}

export async function iconToBase64Png(iconName: string, color: string = '#ffffff', size: number = 128): Promise<string> {
    const cacheKey = `${iconName}_${color}_${size}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached.toString('base64');

    const IconComponent = await loadIconModule(iconName);
    if (!IconComponent) {
        throw new Error(`Icon "${iconName}" not found. Use react-icons names like FaRocket, MdSecurity, BiChart, etc.`);
    }

    const svgString = renderSvgString(IconComponent, color, size);
    const sharp = await loadSharp();
    const pngBuffer = await sharp(Buffer.from(svgString))
        .resize(size, size)
        .png()
        .toBuffer();

    iconCache.set(cacheKey, pngBuffer);
    return pngBuffer.toString('base64');
}

export function clearIconCache(): void {
    iconCache.clear();
}
