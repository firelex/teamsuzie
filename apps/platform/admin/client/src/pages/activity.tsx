import { useCallback, useEffect, useMemo, useState } from 'react';
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

export interface ActivityRow {
  id: string;
  timestamp: string;
  actor_type: 'user' | 'agent' | 'system';
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
}

interface UsageRow {
  id: string;
  timestamp: string;
  service: string;
  operation: string;
  model: string | null;
  input_units: number;
  output_units: number;
  cost_estimate: number;
  agent_id: string | null;
  agent_name: string | null;
  request_id: string | null;
}

interface FilterPreset {
  key: string;
  label: string;
  actionPrefix?: string;
  resourceType?: string;
  /** When true, the "LLM" tab loads usage events instead of audit rows. */
  usage?: boolean;
}

const FILTER_PRESETS: FilterPreset[] = [
  { key: 'all', label: 'All' },
  { key: 'agents', label: 'Agents', actionPrefix: 'agent.' },
  { key: 'approvals', label: 'Approvals', actionPrefix: 'approval.' },
  { key: 'tokens', label: 'Tokens', actionPrefix: 'api_key.' },
  { key: 'config', label: 'Config', actionPrefix: 'config.' },
  { key: 'llm', label: 'LLM', usage: true },
];

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action.endsWith('.delete') || action.endsWith('.reject') || action.endsWith('.revoke')) {
    return 'destructive';
  }
  if (action.endsWith('.create') || action.endsWith('.approve')) return 'default';
  if (action.endsWith('.update') || action.endsWith('.propose')) return 'secondary';
  return 'outline';
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ActivityRow | null>(null);
  const [usageDetail, setUsageDetail] = useState<UsageRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (filter.usage) {
        const response = await fetch('/api/activity/usage?limit=50', {
          credentials: 'include',
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Failed to load usage (${response.status})`);
        }
        const data = (await response.json()) as { items: UsageRow[]; total: number };
        setUsageRows(data.items ?? []);
        setTotal(data.total ?? 0);
      } else {
        const params = new URLSearchParams({ limit: '50' });
        if (filter.actionPrefix) params.set('action_prefix', filter.actionPrefix);
        if (filter.resourceType) params.set('resource_type', filter.resourceType);
        const response = await fetch(`/api/activity?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Failed to load activity (${response.status})`);
        }
        const data = (await response.json()) as { items: ActivityRow[]; total: number };
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const auditColumns = useMemo<Column<ActivityRow>[]>(
    () => [
      {
        key: 'timestamp',
        header: 'When',
        render: (row) => (
          <span className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span>
        ),
      },
      {
        key: 'actor',
        header: 'Actor',
        render: (row) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[10px]">
                {row.actor_type}
              </Badge>
              <span className="truncate">{row.actor_label ?? (row.actor_id ? row.actor_id.slice(0, 8) : '—')}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'action',
        header: 'Action',
        render: (row) => (
          <Badge variant={actionVariant(row.action)} className="font-mono text-[10px]">
            {row.action}
          </Badge>
        ),
      },
      {
        key: 'resource',
        header: 'Resource',
        render: (row) => (
          <div className="min-w-0">
            <div className="text-xs">{row.resource_type}</div>
            {row.resource_id && (
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {row.resource_id.slice(0, 8)}…
              </div>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const usageColumns = useMemo<Column<UsageRow>[]>(
    () => [
      {
        key: 'timestamp',
        header: 'When',
        render: (row) => (
          <span className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span>
        ),
      },
      {
        key: 'service',
        header: 'Service',
        render: (row) => (
          <div className="min-w-0">
            <Badge variant="outline" className="font-mono text-[10px]">
              {row.service}
            </Badge>
            {row.model && (
              <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{row.model}</div>
            )}
          </div>
        ),
      },
      {
        key: 'agent',
        header: 'Agent',
        render: (row) =>
          row.agent_name ? (
            <span className="truncate">{row.agent_name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: 'tokens',
        header: 'Tokens',
        align: 'right',
        render: (row) => (
          <span className="font-mono text-xs">
            {formatTokens(row.input_units)} / {formatTokens(row.output_units)}
          </span>
        ),
      },
      {
        key: 'cost',
        header: 'Cost',
        align: 'right',
        render: (row) => <span className="font-mono text-xs">{formatCost(row.cost_estimate)}</span>,
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Activity</PageHeaderTitle>
          <PageHeaderDescription>
            Every state change captured by the admin control plane plus LLM usage ingested from the llm-proxy. Backed by{' '}
            <code className="font-mono">audit_log</code> and <code className="font-mono">usage_event</code>.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant={filter.key === preset.key ? 'default' : 'outline'}
                onClick={() => setFilter(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              {loading ? 'loading…' : `${filter.usage ? usageRows.length : rows.length} of ${total}`}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {filter.usage ? (
            <DataTable<UsageRow>
              data={usageRows}
              columns={usageColumns}
              getRowKey={(row) => row.id}
              isLoading={loading}
              emptyMessage="No LLM calls recorded yet. Make a request through the llm-proxy to see it here."
              onRowClick={(row) => setUsageDetail(row)}
              renderActions={(row) => (
                <Button variant="ghost" size="sm" onClick={() => setUsageDetail(row)}>
                  View
                </Button>
              )}
            />
          ) : (
            <DataTable<ActivityRow>
              data={rows}
              columns={auditColumns}
              getRowKey={(row) => row.id}
              isLoading={loading}
              emptyMessage="No activity yet."
              onRowClick={(row) => setDetail(row)}
              renderActions={(row) => (
                <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
                  View
                </Button>
              )}
            />
          )}
        </div>
      </AppShellContent>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={actionVariant(detail?.action ?? '')} className="font-mono text-[10px]">
                {detail?.action}
              </Badge>
              <span className="font-mono text-sm">{detail?.resource_type}</span>
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${new Date(detail.timestamp).toLocaleString()} · ${detail.actor_type}${
                    detail.actor_label ? ` · ${detail.actor_label}` : ''
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              {detail.resource_id && (
                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Resource id
                  </div>
                  <pre className="rounded-md bg-muted p-3 font-mono text-xs">{detail.resource_id}</pre>
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Details
                </div>
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {detail.details ? JSON.stringify(detail.details, null, 2) : '(none)'}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageDetail} onOpenChange={(open) => !open && setUsageDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {usageDetail?.service}
              </Badge>
              {usageDetail?.model && <span className="font-mono text-sm">{usageDetail.model}</span>}
            </DialogTitle>
            <DialogDescription>
              {usageDetail
                ? `${new Date(usageDetail.timestamp).toLocaleString()} · ${usageDetail.operation}${
                    usageDetail.agent_name ? ` · ${usageDetail.agent_name}` : ''
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {usageDetail && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Input tokens</div>
                <div className="font-mono">{usageDetail.input_units.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Output tokens</div>
                <div className="font-mono">{usageDetail.output_units.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost (est.)</div>
                <div className="font-mono">{formatCost(usageDetail.cost_estimate)}</div>
              </div>
              {usageDetail.request_id && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Request id</div>
                  <div className="truncate font-mono text-xs">{usageDetail.request_id}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
