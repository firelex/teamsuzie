import { NextRequest } from 'next/server';
import { ensureBoot, getApprovals } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureBoot();
  const { id } = await params;
  let body: { verdict?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const verdict = body.verdict === 'approve' ? 'approve' : 'reject';
  const reason = typeof body.reason === 'string' ? body.reason : undefined;

  try {
    const reviewed = await getApprovals().review(id, {
      reviewer_id: 'human',
      verdict,
      reason,
    });
    return Response.json({ ok: true, item: reviewed });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Review failed' },
      { status: 400 },
    );
  }
}
