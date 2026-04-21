import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AppShellContent,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
  PageHeaderActions,
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
import type { AgentRow } from './agents.js';

interface ProfileRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  agent_type: string;
}

interface AgentFormState {
  name: string;
  description: string;
  profile_id: string;
  agent_type: 'openclaw' | 'custom';
  status: 'active' | 'inactive' | 'suspended';
  baseUrl: string;
  apiKey: string;
  openclawAgentId: string;
  system_prompt: string;
  text_model: string;
  skills: string;
  approval_required: boolean;
}

const EMPTY_FORM: AgentFormState = {
  name: '',
  description: '',
  profile_id: '',
  agent_type: 'openclaw',
  status: 'active',
  baseUrl: '',
  apiKey: '',
  openclawAgentId: '',
  system_prompt: '',
  text_model: '',
  skills: '',
  approval_required: false,
};

const NO_PROFILE = '__none__';

function agentToForm(row: AgentRow): AgentFormState {
  const cfg = row.config as AgentRow['config'] & {
    apiKey?: string;
    openclawAgentId?: string;
    system_prompt?: string;
  };
  return {
    name: row.name,
    description: row.description ?? '',
    profile_id: row.profile_id ?? '',
    agent_type: row.agent_type,
    status: row.status,
    baseUrl: cfg.baseUrl ?? '',
    apiKey: cfg.apiKey ?? '',
    openclawAgentId: cfg.openclawAgentId ?? '',
    system_prompt: cfg.system_prompt ?? '',
    text_model: cfg.text_model ?? '',
    skills: (cfg.skills ?? []).join(', '),
    approval_required: !!cfg.approval_required,
  };
}

function formToPayload(form: AgentFormState, { create }: { create: boolean }) {
  const skills = form.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const config: Record<string, unknown> = {
    baseUrl: form.baseUrl.trim().replace(/\/$/, ''),
    approval_required: form.approval_required,
  };
  if (form.apiKey.trim()) config.apiKey = form.apiKey.trim();
  if (form.openclawAgentId.trim()) config.openclawAgentId = form.openclawAgentId.trim();
  if (form.system_prompt.trim()) config.system_prompt = form.system_prompt;
  if (form.text_model.trim()) config.text_model = form.text_model.trim();
  if (skills.length) config.skills = skills;

  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    agent_type: form.agent_type,
    status: form.status,
    profile_id: form.profile_id || null,
    config,
  };

  if (create && !payload.profile_id) delete payload.profile_id;
  return payload;
}

export function AgentEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isCreate = !id || id === 'new';

  const [form, setForm] = useState<AgentFormState>(EMPTY_FORM);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/agent-profiles', { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { items: ProfileRow[] };
        setProfiles(data.items ?? []);
      }
    })();
  }, []);

  useEffect(() => {
    if (isCreate) {
      setForm(EMPTY_FORM);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const response = await fetch(`/api/agents/${id}`, { credentials: 'include' });
      if (response.ok) {
        const data = (await response.json()) as { agent: AgentRow };
        setForm(agentToForm(data.agent));
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error || 'Failed to load agent');
      }
      setLoading(false);
    })();
  }, [id, isCreate]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!form.name.trim()) {
        setError('Name is required.');
        return;
      }
      setSubmitting(true);
      try {
        const payload = formToPayload(form, { create: isCreate });
        const response = await fetch(isCreate ? '/api/agents' : `/api/agents/${id}`, {
          method: isCreate ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Save failed');
        }
        navigate('/agents');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSubmitting(false);
      }
    },
    [form, id, isCreate, navigate],
  );

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === form.profile_id),
    [profiles, form.profile_id],
  );

  if (loading) {
    return (
      <AppShellContent>
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </AppShellContent>
    );
  }

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>{isCreate ? 'New agent' : `Edit ${form.name || 'agent'}`}</PageHeaderTitle>
          <PageHeaderDescription>
            Point the agent at an OpenClaw-compatible endpoint. Once saved, it shows up in the Chat agent list.
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Button variant="outline" onClick={() => navigate('/agents')}>
            Cancel
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <AppShellContent>
        <form className="mx-auto max-w-3xl space-y-6 p-6" onSubmit={submit}>
          {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive text-sm">{error}</CardTitle>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>How users see this agent in the product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short one-liner shown in the agent list."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile">Profile</Label>
                <Select
                  value={form.profile_id || NO_PROFILE}
                  onValueChange={(v) => setForm({ ...form, profile_id: v === NO_PROFILE ? '' : v })}
                >
                  <SelectTrigger id="profile">
                    <SelectValue placeholder="Choose a profile template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROFILE}>No profile</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfile?.description && (
                  <p className="text-xs text-muted-foreground">{selectedProfile.description}</p>
                )}
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="agent_type">Runtime type</Label>
                  <Select
                    value={form.agent_type}
                    onValueChange={(v) => setForm({ ...form, agent_type: v as 'openclaw' | 'custom' })}
                  >
                    <SelectTrigger id="agent_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openclaw">OpenClaw</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as AgentFormState['status'] })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runtime endpoint</CardTitle>
              <CardDescription>
                Any OpenClaw-compatible server exposing <code className="font-mono">/v1/chat/completions</code> and{' '}
                <code className="font-mono">/health</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="http://localhost:18789"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apiKey">API key (optional)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="Sent as Authorization: Bearer …"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openclawAgentId">OpenClaw agent id (optional)</Label>
                <Input
                  id="openclawAgentId"
                  value={form.openclawAgentId}
                  onChange={(e) => setForm({ ...form, openclawAgentId: e.target.value })}
                  placeholder="Sent as x-openclaw-agent-id"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text_model">Default model</Label>
                <Input
                  id="text_model"
                  value={form.text_model}
                  onChange={(e) => setForm({ ...form, text_model: e.target.value })}
                  placeholder="e.g. gpt-4.1-mini"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Behaviour</CardTitle>
              <CardDescription>System prompt, skills, and policy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="system_prompt">System prompt</Label>
                <Textarea
                  id="system_prompt"
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  rows={5}
                  placeholder="Injected as the first message. Leave blank to let the runtime handle it."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skills">Skills</Label>
                <Input
                  id="skills"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="Comma-separated slugs, e.g. file-access, documents"
                />
                <p className="text-xs text-muted-foreground">
                  Phase 2 will replace this with a picker sourced from <code className="font-mono">packages/skills</code>.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="approval_required" className="text-sm font-medium">
                    Require approval for actions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Phase 3 will route proposals through <code className="font-mono">@teamsuzie/approvals</code>.
                  </p>
                </div>
                <Switch
                  id="approval_required"
                  checked={form.approval_required}
                  onCheckedChange={(v) => setForm({ ...form, approval_required: v })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/agents')} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !form.name.trim()}>
              {submitting ? 'Saving…' : isCreate ? 'Create agent' : 'Save changes'}
            </Button>
          </div>
        </form>
      </AppShellContent>
    </>
  );
}
