import { useCallback, useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  type Column,
} from '@teamsuzie/ui';

interface ApprovalItem {
  id: string;
  subject_id: string;
  action_type: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'failed';
  review?: {
    reviewer_id: string;
    verdict: 'approve' | 'reject';
    reason?: string;
    reviewed_at: string;
  };
  dispatch?: {
    dispatched_at: string;
    result: 'success' | 'failure';
    error?: string;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
}

type StatusFilter = ApprovalItem['status'] | 'all';

const STATUS_TABS: StatusFilter[] = ['pending', 'approved', 'dispatched', 'rejected', 'failed', 'all'];

function statusVariant(status: ApprovalItem['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'default';
    case 'approved':
    case 'dispatched':
      return 'secondary';
    case 'rejected':
    case 'failed':
      return 'destructive';
  }
}

function formatPayloadPreview(payload: unknown): string {
  try {
    const str = JSON.stringify(payload);
    if (str.length <= 40) return str;
    return str.slice(0, 37) + '…';
  } catch {
    return '—';
  }
}

export function ApprovalsPage() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/approvals' : `/api/approvals?status=${filter}`;
    const response = await fetch(url, { credentials: 'include' });
    if (response.ok) {
      const data = (await response.json()) as { items: ApprovalItem[] };
      setItems(data.items ?? []);
    } else {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(data.error || 'Failed to load approvals');
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function review(id: string, verdict: 'approve' | 'reject') {
    const response = await fetch(`/api/approvals/${id}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdict }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(data.error || 'Review failed');
      return;
    }
    const data = (await response.json()) as { item: ApprovalItem };
    setToast(
      verdict === 'approve'
        ? data.item.status === 'dispatched'
          ? 'Approved and dispatched'
          : 'Approved (no dispatcher registered; item left in approved state)'
        : 'Rejected',
    );
    await refresh();
  }

  const columns: Column<ApprovalItem>[] = [
    {
      key: 'action_type',
      header: 'Action',
      render: (item) => <span className="font-mono text-xs">{item.action_type}</span>,
    },
    {
      key: 'subject',
      header: 'Proposed by',
      render: (item) => {
        const email = item.metadata?.proposed_by_email;
        return typeof email === 'string' ? (
          email
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{item.subject_id.slice(0, 8)}</span>
        );
      },
    },
    {
      key: 'payload',
      header: 'Payload',
      render: (item) => (
        <span className="truncate font-mono text-xs text-muted-foreground">
          {formatPayloadPreview(item.payload)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <Badge variant={statusVariant(item.status)}>{item.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Proposed',
      render: (item) => new Date(item.created_at).toLocaleString(),
    },
  ];

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Approvals</PageHeaderTitle>
          <PageHeaderDescription>
            Agent-proposed actions awaiting human review. Approvals auto-dispatch when a handler is registered; otherwise they stay in the approved state for manual follow-up.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? 'default' : 'outline'}
                onClick={() => setFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          {toast && (
            <div className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-sm">
              {toast}
            </div>
          )}
          <DataTable<ApprovalItem>
            data={items}
            columns={columns}
            getRowKey={(item) => item.id}
            isLoading={loading}
            emptyMessage={`No ${filter === 'all' ? '' : filter + ' '}approvals.`}
            onRowClick={(item) => setDetail(item)}
            renderActions={(item) =>
              item.status === 'pending' ? (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void review(item.id, 'reject')}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => void review(item.id, 'approve')}>
                    Approve
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setDetail(item)}>
                  View
                </Button>
              )
            }
          />
        </div>
      </AppShellContent>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{detail?.action_type}</span>
              {detail && <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `Proposed ${new Date(detail.created_at).toLocaleString()} by ${
                    (detail.metadata?.proposed_by_email as string | undefined) ?? detail.subject_id.slice(0, 8)
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <section>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payload
                </div>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </section>
              {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                <section>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Metadata
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </section>
              )}
              {detail.review && (
                <section>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Review
                  </div>
                  <div className="rounded-md border border-border p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">verdict:</span> {detail.review.verdict}
                    </div>
                    <div>
                      <span className="text-muted-foreground">reviewer:</span>{' '}
                      <span className="font-mono">{detail.review.reviewer_id.slice(0, 8)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">at:</span>{' '}
                      {new Date(detail.review.reviewed_at).toLocaleString()}
                    </div>
                    {detail.review.reason && (
                      <div>
                        <span className="text-muted-foreground">reason:</span> {detail.review.reason}
                      </div>
                    )}
                  </div>
                </section>
              )}
              {detail.dispatch && (
                <section>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dispatch
                  </div>
                  <div className="rounded-md border border-border p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">result:</span> {detail.dispatch.result}
                    </div>
                    <div>
                      <span className="text-muted-foreground">at:</span>{' '}
                      {new Date(detail.dispatch.dispatched_at).toLocaleString()}
                    </div>
                    {detail.dispatch.error && (
                      <div className="text-destructive">
                        <span className="text-muted-foreground">error:</span> {detail.dispatch.error}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
