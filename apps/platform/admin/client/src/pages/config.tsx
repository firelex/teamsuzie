import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
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
  Switch,
  Textarea,
} from '@teamsuzie/ui';

interface ConfigDefinition {
  id: string;
  key: string;
  display_name: string;
  description: string | null;
  category: string;
  value_type: 'string' | 'number' | 'boolean' | 'json' | 'secret';
  default_value: string | null;
  allowed_scopes: string[];
  is_sensitive: boolean;
  requires_restart: boolean;
}

interface ResolvedConfig {
  key: string;
  value: string | null;
  source_scope: 'global' | 'org' | 'user' | 'agent' | 'default';
  source_scope_id: string | null;
  definition: ConfigDefinition;
}

const CATEGORY_ORDER = ['platform', 'ai', 'service', 'infrastructure', 'oauth'] as const;

function formatValue(row: ResolvedConfig): string {
  if (row.definition.is_sensitive) {
    return row.value === null && row.source_scope === 'default' ? '(not set)' : '[REDACTED]';
  }
  if (row.value === null) return '(not set)';
  if (row.definition.value_type === 'boolean') return row.value === 'true' ? 'true' : 'false';
  return row.value;
}

function sourceBadge(row: ResolvedConfig): { label: string; variant: 'default' | 'outline' | 'secondary' } {
  if (row.source_scope === 'default') return { label: 'default', variant: 'outline' };
  if (row.source_scope === 'global') return { label: 'system', variant: 'secondary' };
  return { label: row.source_scope, variant: 'default' };
}

interface EditState {
  def: ConfigDefinition;
  currentValue: string | null;
  draft: string;
  error: string | null;
  submitting: boolean;
}

export function ConfigPage() {
  const [rows, setRows] = useState<ResolvedConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/config/values?scope=global', { credentials: 'include' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to load config (${response.status})`);
      }
      const data = (await response.json()) as { values: ResolvedConfig[] };
      setRows(data.values ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openEdit = useCallback(
    (row: ResolvedConfig) => {
      // Secrets: never prefill the draft with the ciphertext or the placeholder —
      // the user is typing a new value to replace whatever's there.
      const currentValue = row.definition.is_sensitive ? null : row.value;
      const draftValue = row.definition.is_sensitive
        ? ''
        : row.value !== null
          ? row.value
          : (row.definition.default_value ?? '');
      setEdit({
        def: row.definition,
        currentValue,
        draft: draftValue,
        error: null,
        submitting: false,
      });
    },
    [],
  );

  async function save() {
    if (!edit) return;
    setEdit({ ...edit, submitting: true, error: null });
    const response = await fetch(`/api/config/values/${encodeURIComponent(edit.def.key)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'global', scope_id: null, value: edit.draft }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setEdit({ ...edit, submitting: false, error: data.error || 'Save failed' });
      return;
    }
    setEdit(null);
    setToast(`${edit.def.display_name} updated`);
    await refresh();
  }

  async function unset(row: ResolvedConfig) {
    if (row.source_scope === 'default') return;
    if (!window.confirm(`Reset ${row.definition.display_name} to default?`)) return;
    const response = await fetch(
      `/api/config/values/${encodeURIComponent(row.key)}?scope=global`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(data.error || 'Reset failed');
      return;
    }
    setToast(`${row.definition.display_name} reset to default`);
    await refresh();
  }

  const grouped = useMemo(() => {
    const byCategory = new Map<string, ResolvedConfig[]>();
    for (const row of rows) {
      const cat = row.definition.category;
      const bucket = byCategory.get(cat) ?? [];
      bucket.push(row);
      byCategory.set(cat, bucket);
    }
    const ordered: [string, ResolvedConfig[]][] = [];
    for (const cat of CATEGORY_ORDER) {
      const bucket = byCategory.get(cat);
      if (bucket && bucket.length) ordered.push([cat, bucket]);
      byCategory.delete(cat);
    }
    for (const [cat, bucket] of byCategory) ordered.push([cat, bucket]);
    return ordered;
  }, [rows]);

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Config</PageHeaderTitle>
          <PageHeaderDescription>
            System-scope defaults. Per-agent / per-user overrides are supported by the API
            (see <code className="font-mono">/api/config/values/:key?scope=agent&amp;scope_id=…</code>) but not
            yet editable from this surface.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {toast && (
            <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">{toast}</div>
          )}

          {!loading && rows.length === 0 && !error ? (
            <EmptyState>
              <EmptyStateTitle>No definitions</EmptyStateTitle>
              <EmptyStateDescription>
                Seed some with <code className="font-mono">ConfigService.ensureDefinitions</code>, or restart admin.
              </EmptyStateDescription>
            </EmptyState>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            grouped.map(([category, bucket]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-base capitalize">{category}</CardTitle>
                  <CardDescription>
                    {bucket.length} setting{bucket.length === 1 ? '' : 's'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {bucket.map((row) => {
                    const badge = sourceBadge(row);
                    return (
                      <div
                        key={row.key}
                        className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{row.definition.display_name}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {row.definition.value_type}
                            </Badge>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            {row.definition.requires_restart && (
                              <Badge variant="destructive">restart required</Badge>
                            )}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                          {row.definition.description && (
                            <p className="text-xs text-muted-foreground">{row.definition.description}</p>
                          )}
                          <div className="pt-1 font-mono text-xs">
                            <span className="text-muted-foreground">value: </span>
                            <span className={row.value === null && row.source_scope === 'default' ? 'text-muted-foreground' : ''}>
                              {formatValue(row)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 sm:self-center">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            {row.definition.is_sensitive ? 'Replace' : 'Edit'}
                          </Button>
                          {row.source_scope !== 'default' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void unset(row)}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </AppShellContent>

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.def.display_name}</DialogTitle>
            <DialogDescription>
              {edit?.def.description}
              {edit?.def.requires_restart && (
                <span className="mt-1 block text-destructive">
                  Changes to this setting require a restart to take effect.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {edit.def.value_type === 'boolean' ? (
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="cfg-val-bool" className="text-sm">
                    {edit.def.display_name}
                  </Label>
                  <Switch
                    id="cfg-val-bool"
                    checked={edit.draft === 'true'}
                    onCheckedChange={(v) => setEdit({ ...edit, draft: v ? 'true' : 'false' })}
                  />
                </div>
              ) : edit.def.value_type === 'json' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-val-json">Value (JSON)</Label>
                  <Textarea
                    id="cfg-val-json"
                    rows={6}
                    value={edit.draft}
                    onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-val">Value</Label>
                  <Input
                    id="cfg-val"
                    type={edit.def.is_sensitive ? 'password' : 'text'}
                    value={edit.draft}
                    onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
                    placeholder={
                      edit.def.is_sensitive
                        ? 'Type a new secret — the current one is hidden'
                        : (edit.def.default_value ?? '')
                    }
                  />
                </div>
              )}
              {edit.def.value_type === 'string' && edit.currentValue && !edit.def.is_sensitive && (
                <p className="text-xs text-muted-foreground">
                  Current: <span className="font-mono">{edit.currentValue}</span>
                </p>
              )}
              {edit.error && <p className="text-xs text-destructive">{edit.error}</p>}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEdit(null)}
                  disabled={edit.submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={edit.submitting}>
                  {edit.submitting ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
