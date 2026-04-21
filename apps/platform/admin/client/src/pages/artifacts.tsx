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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type Column,
} from '@teamsuzie/ui';

type ContentType = 'markdown' | 'json' | 'yaml' | 'text';

interface ArtifactRow {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  organization_id: string | null;
  file_path: string;
  content_type: ContentType;
  size_bytes: number;
  created_at: string;
  updated_at: string | null;
}

interface ArtifactDetail extends ArtifactRow {
  content: string;
}

interface AgentOption {
  id: string;
  name: string;
}

const ANY_AGENT = '__any__';
const NO_AGENT = '__none__';

const EXTENSION_BY_CONTENT_TYPE: Record<ContentType, string> = {
  markdown: 'md',
  json: 'json',
  yaml: 'yaml',
  text: 'txt',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

export function ArtifactsPage() {
  const [rows, setRows] = useState<ArtifactRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>(ANY_AGENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArtifactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/agents', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { items: { id: string; name: string }[] };
        setAgents(data.items ?? []);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    let url = '/api/workspace/files';
    if (agentFilter === NO_AGENT) {
      url += '?agent_id=null';
    } else if (agentFilter !== ANY_AGENT) {
      url += `?agent_id=${encodeURIComponent(agentFilter)}`;
    }
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to load artifacts (${response.status})`);
      }
      const data = (await response.json()) as { items: ArtifactRow[] };
      setRows(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openDetail = useCallback(async (row: ArtifactRow) => {
    setDetail({ ...row, content: '' });
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/workspace/files/${row.id}`, { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { file: ArtifactDetail };
        setDetail(data.file);
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setToast(data.error || 'Failed to load file content');
        setDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function remove(row: ArtifactRow) {
    if (!window.confirm(`Delete ${row.file_path}? This cannot be undone.`)) return;
    const response = await fetch(`/api/workspace/files/${row.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(data.error || 'Delete failed');
      return;
    }
    setToast('Deleted');
    if (detail?.id === row.id) setDetail(null);
    await refresh();
  }

  function download(file: ArtifactDetail) {
    const ext = EXTENSION_BY_CONTENT_TYPE[file.content_type] ?? 'txt';
    const name = basename(file.file_path).includes('.') ? basename(file.file_path) : `${basename(file.file_path)}.${ext}`;
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<Column<ArtifactRow>[]>(
    () => [
      {
        key: 'path',
        header: 'Path',
        render: (row) => <span className="truncate font-mono text-xs">{row.file_path}</span>,
      },
      {
        key: 'agent',
        header: 'Agent',
        render: (row) =>
          row.agent_name ? (
            row.agent_name
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (row) => (
          <Badge variant="outline" className="font-mono text-[10px]">
            {row.content_type}
          </Badge>
        ),
      },
      {
        key: 'size',
        header: 'Size',
        render: (row) => <span className="font-mono text-xs">{formatBytes(row.size_bytes)}</span>,
      },
      {
        key: 'created',
        header: 'Created',
        render: (row) => new Date(row.created_at).toLocaleString(),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Artifacts</PageHeaderTitle>
          <PageHeaderDescription>
            Text files agents have written to the workspace — notes, configs, logs. Binary
            outputs (pptx, xlsx, docx) land in a follow-on phase.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-56">
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_AGENT}>All agents</SelectItem>
                  <SelectItem value={NO_AGENT}>No agent (user files)</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {toast && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">{toast}</div>
          )}

          <DataTable<ArtifactRow>
            data={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            isLoading={loading}
            emptyMessage="No artifacts yet. Agents that POST to /api/workspace/files will show up here."
            filterPlaceholder="Filter by path…"
            filterFn={(row, query) => row.file_path.toLowerCase().includes(query.toLowerCase())}
            onRowClick={(row) => void openDetail(row)}
            renderActions={(row) => (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => void openDetail(row)}>
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove(row)}
                >
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </AppShellContent>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{detail?.file_path}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {detail && (
                <>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {detail.content_type}
                  </Badge>
                  <span>{formatBytes(detail.size_bytes)}</span>
                  <span>·</span>
                  <span>{new Date(detail.created_at).toLocaleString()}</span>
                  {detail.agent_name && (
                    <>
                      <span>·</span>
                      <span>{detail.agent_name}</span>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {detail &&
            (detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading content…</p>
            ) : (
              <div className="space-y-3">
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {detail.content}
                </pre>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => download(detail)}>
                    Download
                  </Button>
                </div>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
