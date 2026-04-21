import { useCallback, useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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

interface AgentKeyRow {
  id: string;
  agent_id: string;
  agent_name: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
}

interface UserTokenRow {
  id: string;
  name: string;
  token_prefix: string;
  last_seen_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface AgentOption {
  id: string;
  name: string;
}

interface ScopeOption {
  scope: string;
  description: string;
}

function formatWhen(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function keyStatusBadge(row: AgentKeyRow): { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' } {
  if (row.revoked_at) return { label: 'revoked', variant: 'destructive' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())
    return { label: 'expired', variant: 'destructive' };
  if (!row.is_active) return { label: 'inactive', variant: 'outline' };
  return { label: 'active', variant: 'default' };
}

function tokenStatusBadge(row: UserTokenRow): { label: string; variant: 'default' | 'outline' | 'destructive' } {
  if (row.revoked_at) return { label: 'revoked', variant: 'destructive' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())
    return { label: 'expired', variant: 'destructive' };
  return { label: 'active', variant: 'default' };
}

interface RevealState {
  title: string;
  subtitle: string;
  secret: string;
}

function RevealDialog({
  reveal,
  onClose,
}: {
  reveal: RevealState | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!reveal) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{reveal.title}</DialogTitle>
          <DialogDescription>{reveal.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <pre className="rounded-md border border-border bg-muted p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {reveal.secret}
          </pre>
          <p className="text-xs text-muted-foreground">
            Copy this now. It will not be shown again.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(reveal.secret);
              setCopied(true);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentKeyCreateDialog({
  open,
  agents,
  scopes,
  onClose,
  onCreated,
}: {
  open: boolean;
  agents: AgentOption[];
  scopes: ScopeOption[];
  onClose: () => void;
  onCreated: (plaintext: string, summary: AgentKeyRow) => void;
}) {
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAgentId('');
      setName('');
      setExpiresInDays('');
      setSelectedScopes([]);
      setError(null);
    }
  }, [open]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!agentId) {
        setError('Choose an agent');
        return;
      }
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          agent_id: agentId,
          name: name.trim(),
          scopes: selectedScopes,
        };
        if (expiresInDays.trim()) {
          const n = Number(expiresInDays);
          if (Number.isFinite(n) && n > 0) payload.expires_in_days = n;
        } else {
          payload.expires_in_days = null;
        }
        const response = await fetch('/api/agent-keys', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Create failed');
        }
        const data = (await response.json()) as { key: string; summary: AgentKeyRow };
        onCreated(data.key, data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      } finally {
        setSubmitting(false);
      }
    },
    [agentId, name, expiresInDays, selectedScopes, onCreated],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New agent API key</DialogTitle>
          <DialogDescription>
            Agent bearer keys are sent as <code className="font-mono">Authorization: Bearer dtk_...</code>.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="ak-agent">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="ak-agent">
                <SelectValue placeholder="Choose an agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ak-name">Label</Label>
            <Input
              id="ak-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. prod, local dev, integration tests"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ak-expiry">Expires in (days)</Label>
            <Input
              id="ak-expiry"
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="blank = never expires"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Scopes</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {scopes.map((s) => {
                const checked = selectedScopes.includes(s.scope);
                return (
                  <label
                    key={s.scope}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                      checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedScopes(
                          e.target.checked
                            ? [...selectedScopes, s.scope]
                            : selectedScopes.filter((x) => x !== s.scope),
                        );
                      }}
                    />
                    <span>
                      <span className="block font-mono">{s.scope}</span>
                      <span className="block text-muted-foreground">{s.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserTokenCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plaintext: string, summary: UserTokenRow) => void;
}) {
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setExpiresInDays('30');
      setError(null);
    }
  }, [open]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          token_name: name.trim() || 'app-client',
        };
        if (expiresInDays.trim()) {
          const n = Number(expiresInDays);
          if (Number.isFinite(n) && n > 0) payload.expires_in_days = n;
        } else {
          payload.expires_in_days = null;
        }
        const response = await fetch('/api/auth/tokens', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message || 'Create failed');
        }
        const data = (await response.json()) as {
          access_token: string;
          token_name: string;
          expires_at: string | null;
        };
        const summary: UserTokenRow = {
          id: '',
          name: data.token_name,
          token_prefix: data.access_token.slice(0, 12),
          last_seen_at: null,
          expires_at: data.expires_at,
          revoked_at: null,
          created_at: new Date().toISOString(),
        };
        onCreated(data.access_token, summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      } finally {
        setSubmitting(false);
      }
    },
    [name, expiresInDays, onCreated],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New user access token</DialogTitle>
          <DialogDescription>
            Bearer tokens for your own user account. Used with{' '}
            <code className="font-mono">Authorization: Bearer tsu_...</code>.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="ut-name">Label</Label>
            <Input
              id="ut-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. laptop CLI, mobile app"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ut-expiry">Expires in (days)</Label>
            <Input
              id="ut-expiry"
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="blank = never expires"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create token'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TokensPage() {
  const [agentKeys, setAgentKeys] = useState<AgentKeyRow[]>([]);
  const [userTokens, setUserTokens] = useState<UserTokenRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshKeys = useCallback(async () => {
    setLoadingKeys(true);
    const response = await fetch('/api/agent-keys', { credentials: 'include' });
    if (response.ok) {
      const data = (await response.json()) as { items: AgentKeyRow[] };
      setAgentKeys(data.items ?? []);
    }
    setLoadingKeys(false);
  }, []);

  const refreshTokens = useCallback(async () => {
    setLoadingTokens(true);
    const response = await fetch('/api/auth/tokens', { credentials: 'include' });
    if (response.ok) {
      const data = (await response.json()) as { tokens: UserTokenRow[] };
      setUserTokens(data.tokens ?? []);
    }
    setLoadingTokens(false);
  }, []);

  useEffect(() => {
    void refreshKeys();
    void refreshTokens();
    void (async () => {
      const [agentsRes, scopesRes] = await Promise.all([
        fetch('/api/agents', { credentials: 'include' }),
        fetch('/api/agent-keys/scopes', { credentials: 'include' }),
      ]);
      if (agentsRes.ok) {
        const data = (await agentsRes.json()) as { items: { id: string; name: string }[] };
        setAgents(data.items ?? []);
      }
      if (scopesRes.ok) {
        const data = (await scopesRes.json()) as { scopes: ScopeOption[] };
        setScopes(data.scopes ?? []);
      }
    })();
  }, [refreshKeys, refreshTokens]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function revokeKey(row: AgentKeyRow) {
    if (!window.confirm(`Revoke key ${row.key_prefix}… for ${row.agent_name}? This cannot be undone.`)) return;
    const response = await fetch(`/api/agent-keys/${row.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(data.error || 'Revoke failed');
      return;
    }
    setToast('Key revoked');
    await refreshKeys();
  }

  async function revokeToken(row: UserTokenRow) {
    if (!window.confirm(`Revoke ${row.name} (${row.token_prefix}…)? This cannot be undone.`)) return;
    const response = await fetch(`/api/auth/tokens/${row.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      setToast(data.message || 'Revoke failed');
      return;
    }
    setToast('Token revoked');
    await refreshTokens();
  }

  const agentKeyColumns: Column<AgentKeyRow>[] = [
    {
      key: 'name',
      header: 'Label',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{row.key_prefix}…</div>
        </div>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (row) => row.agent_name,
    },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (row) =>
        row.scopes.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.scopes.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: 'last_used',
      header: 'Last used',
      render: (row) => formatWhen(row.last_used_at),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => (row.expires_at ? formatWhen(row.expires_at) : 'never'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const status = keyStatusBadge(row);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  const userTokenColumns: Column<UserTokenRow>[] = [
    {
      key: 'name',
      header: 'Label',
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{row.token_prefix}…</div>
        </div>
      ),
    },
    {
      key: 'last_seen',
      header: 'Last seen',
      render: (row) => formatWhen(row.last_seen_at),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => (row.expires_at ? formatWhen(row.expires_at) : 'never'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const status = tokenStatusBadge(row);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Tokens</PageHeaderTitle>
          <PageHeaderDescription>
            Bearer credentials for clients and agents. Created secrets are shown once — copy them now.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-6 p-6">
          {toast && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">{toast}</div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Agent API keys</CardTitle>
                <CardDescription>
                  Bearer keys for agents. Unblocks agent-driven calls into{' '}
                  <code className="font-mono">/api/approvals</code> and (with scopes) other OSS services.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateKeyOpen(true)} disabled={agents.length === 0}>
                New key
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable<AgentKeyRow>
                data={agentKeys}
                columns={agentKeyColumns}
                getRowKey={(row) => row.id}
                isLoading={loadingKeys}
                emptyMessage={
                  agents.length === 0
                    ? 'Create an agent first (Agents tab), then come back to issue a key.'
                    : 'No agent keys yet.'
                }
                renderActions={(row) =>
                  row.revoked_at ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void revokeKey(row)}
                    >
                      Revoke
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">User access tokens</CardTitle>
                <CardDescription>
                  Bearer tokens for your own user account — mobile apps, CLIs, integration tests.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateTokenOpen(true)}>
                New token
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable<UserTokenRow>
                data={userTokens}
                columns={userTokenColumns}
                getRowKey={(row) => row.id || row.token_prefix}
                isLoading={loadingTokens}
                emptyMessage="No tokens yet."
                renderActions={(row) =>
                  row.revoked_at || !row.id ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void revokeToken(row)}
                    >
                      Revoke
                    </Button>
                  )
                }
              />
            </CardContent>
          </Card>
        </div>
      </AppShellContent>

      <AgentKeyCreateDialog
        open={createKeyOpen}
        agents={agents}
        scopes={scopes}
        onClose={() => setCreateKeyOpen(false)}
        onCreated={(plaintext, summary) => {
          setCreateKeyOpen(false);
          setReveal({
            title: `Agent key created — ${summary.agent_name} / ${summary.name}`,
            subtitle: 'Send as Authorization: Bearer <token>. Shown once.',
            secret: plaintext,
          });
          void refreshKeys();
        }}
      />

      <UserTokenCreateDialog
        open={createTokenOpen}
        onClose={() => setCreateTokenOpen(false)}
        onCreated={(plaintext, summary) => {
          setCreateTokenOpen(false);
          setReveal({
            title: `User token created — ${summary.name}`,
            subtitle: 'Send as Authorization: Bearer <token>. Shown once.',
            secret: plaintext,
          });
          void refreshTokens();
        }}
      />

      <RevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}
