import { useCallback, useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  DataTable,
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
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'failed';
  metadata?: Record<string, unknown>;
  created_at: string;
}

const STATUS_TABS: Array<ApprovalItem['status'] | 'all'> = [
  'pending',
  'dispatched',
  'rejected',
  'failed',
  'all',
];

function statusVariant(status: ApprovalItem['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'default';
    case 'dispatched':
      return 'secondary';
    case 'rejected':
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ApprovalsPage() {
  const [filter, setFilter] = useState<ApprovalItem['status'] | 'all'>('pending');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/approvals' : `/api/approvals?status=${filter}`;
    const response = await fetch(url, { credentials: 'include' });
    const data = (await response.json()) as { items: ApprovalItem[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
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
    setToast(verdict === 'approve' ? 'Approved and dispatched' : 'Rejected');
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
        return typeof email === 'string' ? email : item.subject_id.slice(0, 8);
      },
    },
    {
      key: 'target',
      header: 'Target',
      render: (item) => {
        const name = item.metadata?.contact_name;
        const email = item.metadata?.contact_email;
        if (typeof name === 'string' && typeof email === 'string') {
          return (
            <span>
              <span className="font-medium">{name}</span>{' '}
              <span className="text-muted-foreground">&lt;{email}&gt;</span>
            </span>
          );
        }
        return <span className="text-muted-foreground">—</span>;
      },
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
            Destructive actions proposed by agents or users. Approvals dispatch immediately.
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
            emptyMessage={`No ${filter} approvals.`}
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
                <span className="text-xs text-muted-foreground">—</span>
              )
            }
          />
        </div>
      </AppShellContent>
    </>
  );
}
