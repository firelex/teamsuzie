import { NextRequest } from 'next/server';
import { ensureBoot, getApprovals } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected', 'dispatched', 'failed']);

export async function GET(req: NextRequest) {
  await ensureBoot();
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const approvals = getApprovals();
  const items = await approvals.list({
    status:
      status === 'all' || !VALID_STATUSES.has(status)
        ? undefined
        : (status as 'pending' | 'approved' | 'rejected' | 'dispatched' | 'failed'),
  });
  return Response.json({ items });
}
