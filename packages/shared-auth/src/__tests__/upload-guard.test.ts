import { describe, expect, it } from 'vitest';
import {
    DEFAULT_UPLOAD_LIMITS,
    assertUploadLimits,
    extensionAllowed,
    normalizeUploadFilename,
} from '../utils/upload-guard.js';

describe('normalizeUploadFilename', () => {
    it('strips directory components', () => {
        expect(normalizeUploadFilename('../../etc/passwd')).toBe('passwd');
        expect(normalizeUploadFilename('C:\\Users\\foo\\report.pdf')).toBe('report.pdf');
        expect(normalizeUploadFilename('/absolute/path/to/file.txt')).toBe('file.txt');
    });

    it('replaces shell-hostile punctuation with underscores', () => {
        expect(normalizeUploadFilename('weird|name?.txt')).toBe('weird_name_.txt');
        expect(normalizeUploadFilename('a<b>c:d*e.doc')).toBe('a_b_c_d_e.doc');
    });

    it('prevents leading-dot filenames', () => {
        expect(normalizeUploadFilename('.htaccess')).toBe('_htaccess');
        expect(normalizeUploadFilename('...weird.txt')).toBe('_weird.txt');
    });

    it('returns a fallback for empty input', () => {
        expect(normalizeUploadFilename('')).toBe('file');
    });

    it('caps length while preserving extension', () => {
        const longStem = 'a'.repeat(250);
        const result = normalizeUploadFilename(`${longStem}.pdf`);
        expect(result.endsWith('.pdf')).toBe(true);
        expect(result.length).toBeLessThanOrEqual(200);
    });
});

describe('extensionAllowed', () => {
    it('accepts when extension is in allowlist (case insensitive)', () => {
        expect(extensionAllowed('report.PDF', ['pdf', 'docx'])).toBe(true);
        expect(extensionAllowed('sheet.xlsx', ['xlsx'])).toBe(true);
    });

    it('rejects missing or disallowed extensions', () => {
        expect(extensionAllowed('noext', ['pdf'])).toBe(false);
        expect(extensionAllowed('script.sh', ['pdf', 'txt'])).toBe(false);
    });
});

describe('assertUploadLimits', () => {
    it('accepts a normal file', () => {
        expect(() =>
            assertUploadLimits([{ originalname: 'a.pdf', size: 1024 }]),
        ).not.toThrow();
    });

    it('rejects files that exceed size', () => {
        expect(() =>
            assertUploadLimits([
                { originalname: 'a.pdf', size: DEFAULT_UPLOAD_LIMITS.maxFileSizeBytes + 1 },
            ]),
        ).toThrow(/exceeds/);
    });

    it('rejects disallowed extensions', () => {
        expect(() =>
            assertUploadLimits([{ originalname: 'a.exe', size: 100 }]),
        ).toThrow(/disallowed extension/);
    });

    it('rejects too many files', () => {
        const many = Array.from({ length: DEFAULT_UPLOAD_LIMITS.maxFiles + 1 }, (_, i) => ({
            originalname: `a${i}.pdf`,
            size: 10,
        }));
        expect(() => assertUploadLimits(many)).toThrow(/Too many files/);
    });

    it('honours custom limits', () => {
        expect(() =>
            assertUploadLimits([{ originalname: 'a.png', size: 100 }], {
                maxFileSizeBytes: 50,
                maxFiles: 10,
                allowedExtensions: ['png'],
            }),
        ).toThrow(/exceeds/);
    });
});
