import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRequestId } from '../middleware/request-id.js';

function makeReq(headers: Record<string, string | string[] | undefined> = {}): Request {
    return { headers } as unknown as Request;
}

function makeRes(): Response & { _headers: Record<string, string> } {
    const headers: Record<string, string> = {};
    return {
        _headers: headers,
        setHeader: (name: string, value: string) => {
            headers[name] = value;
        },
    } as unknown as Response & { _headers: Record<string, string> };
}

describe('createRequestId', () => {
    it('attaches a generated id when no header is present', () => {
        const mw = createRequestId();
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        mw(req, res, next);

        expect(req.requestId).toBeTruthy();
        expect(typeof req.requestId).toBe('string');
        expect(res._headers['X-Request-Id']).toBe(req.requestId);
        expect(next).toHaveBeenCalledOnce();
    });

    it('reuses a valid incoming X-Request-Id when trusted', () => {
        const mw = createRequestId();
        const req = makeReq({ 'x-request-id': 'abc123-req' });
        const res = makeRes();

        mw(req, res, vi.fn());

        expect(req.requestId).toBe('abc123-req');
        expect(res._headers['X-Request-Id']).toBe('abc123-req');
    });

    it('rejects and re-generates when incoming id contains invalid chars', () => {
        const mw = createRequestId();
        const req = makeReq({ 'x-request-id': 'bad;value with spaces' });
        const res = makeRes();

        mw(req, res, vi.fn());

        expect(req.requestId).not.toBe('bad;value with spaces');
        expect(req.requestId?.length).toBeGreaterThan(0);
    });

    it('ignores incoming id when trustIncoming is false', () => {
        const mw = createRequestId({ trustIncoming: false });
        const req = makeReq({ 'x-request-id': 'valid-id-from-client' });
        const res = makeRes();

        mw(req, res, vi.fn());

        expect(req.requestId).not.toBe('valid-id-from-client');
    });

    it('honours a custom generator', () => {
        const mw = createRequestId({ generate: () => 'fixed-id' });
        const req = makeReq();
        const res = makeRes();

        mw(req, res, vi.fn());

        expect(req.requestId).toBe('fixed-id');
    });
});
