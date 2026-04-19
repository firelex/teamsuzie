import { describe, it, expect } from 'vitest';
import { iconToBase64Png, clearIconCache } from './icons.js';

describe('icon rendering', () => {
    it('should render a known react-icon to base64 PNG', async () => {
        clearIconCache();
        const base64 = await iconToBase64Png('FaRocket', '#ffffff', 64);
        expect(base64).toBeDefined();
        expect(base64.length).toBeGreaterThan(100);
        // Should be valid base64
        expect(() => Buffer.from(base64, 'base64')).not.toThrow();
    });

    it('should cache repeated calls', async () => {
        clearIconCache();
        const first = await iconToBase64Png('FaStar', '#000000', 48);
        const second = await iconToBase64Png('FaStar', '#000000', 48);
        expect(first).toBe(second);
    });

    it('should produce different results for different colors', async () => {
        clearIconCache();
        const white = await iconToBase64Png('FaHeart', '#ffffff', 64);
        const red = await iconToBase64Png('FaHeart', '#ff0000', 64);
        expect(white).not.toBe(red);
    });

    it('should throw for unknown icon names', async () => {
        await expect(iconToBase64Png('ZzNonexistent999', '#fff')).rejects.toThrow('not found');
    });

    it('should handle Material Design icons (Md prefix)', async () => {
        const base64 = await iconToBase64Png('MdSecurity', '#2563EB', 64);
        expect(base64.length).toBeGreaterThan(100);
    });
});
