import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  AppShellContent,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@teamsuzie/ui';
import type { SessionUser } from '../hooks/use-session.js';
import type { ActivityRow } from './activity.js';

interface Props {
  title: string;
  agentsConfigured: number;
  user: SessionUser;
}

interface RecentAgent {
  id: string;
  name: string;
  last_active_at: string | null;
  status: string;
}

interface UsageSummary {
  total: {
    input_units: number;
    output_units: number;
    total_units: number;
    cost_estimate: number;
    request_count: number;
  };
  by_service: Array<{
    service: string;
    total_units: number;
    cost_estimate: number;
    request_count: number;
  }>;
}

const ROADMAP: { phase: string; name: string; status: 'live' | 'next' | 'planned' }[] = [
  { phase: '0', name: 'Foundations (auth + routed shell)', status: 'live' },
  { phase: '1', name: 'Agent registry', status: 'live' },
  { phase: '2', name: 'Skills management', status: 'live' },
  { phase: '3', name: 'Approvals inbox', status: 'live' },
  { phase: '4', name: 'Artifacts browser', status: 'live' },
  { phase: '5', name: 'Tokens & API keys', status: 'live' },
  { phase: '6', name: 'Config surface', status: 'live' },
  { phase: '7', name: 'Activity & audit', status: 'live' },
];

function variantFor(status: 'live' | 'next' | 'planned'): 'default' | 'secondary' | 'outline' {
  return status === 'live' ? 'default' : status === 'next' ? 'secondary' : 'outline';
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 0) return 'in the future';
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
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

export function OverviewPage({ title, agentsConfigured, user }: Props) {
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [recentAgents, setRecentAgents] = useState<RecentAgent[]>([]);
  const [usageToday, setUsageToday] = useState<UsageSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const [activityRes, agentsRes, usageRes] = await Promise.all([
        fetch('/api/activity?limit=8', { credentials: 'include' }),
        fetch('/api/activity/recent-agents?limit=5', { credentials: 'include' }),
        fetch('/api/activity/usage-summary', { credentials: 'include' }),
      ]);
      if (activityRes.ok) {
        const data = (await activityRes.json()) as { items: ActivityRow[] };
        setActivity(data.items ?? []);
      }
      if (agentsRes.ok) {
        const data = (await agentsRes.json()) as { items: RecentAgent[] };
        setRecentAgents(data.items ?? []);
      }
      if (usageRes.ok) {
        const data = (await usageRes.json()) as UsageSummary;
        setUsageToday(data);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>{title}</PageHeaderTitle>
          <PageHeaderDescription>
            Welcome, {user.name}. This control plane turns the OSS stack into something you can operate — not just chat against.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Chat</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  {agentsConfigured} configured
                  <Badge variant={agentsConfigured > 0 ? 'default' : 'outline'}>
                    {agentsConfigured > 0 ? 'ready' : 'empty'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  OpenClaw-compatible agents wired via <code className="font-mono">CHAT_AGENTS</code> plus DB-managed agents from the registry.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Auth</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  {user.role}
                  <Badge variant="secondary">shared-auth</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Multi-tenant sessions via <code className="font-mono">@teamsuzie/shared-auth</code>. User bearer tokens + agent API keys supported.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Stack</CardDescription>
                <CardTitle>Express + React</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Pluggable routers on the backend, react-router on the client. Integration suite lives at{' '}
                  <code className="font-mono">src/__tests__/</code>.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">LLM usage (today)</CardTitle>
              <CardDescription>
                Token counts and estimated cost across every call the llm-proxy handled.{' '}
                <NavLink to="/activity" className="text-primary underline-offset-2 hover:underline">
                  See all →
                </NavLink>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!usageToday || usageToday.total.request_count === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing logged today. The llm-proxy publishes to Redis channel{' '}
                  <code className="font-mono">usage:events</code>; admin subscribes and attributes each event
                  to the agent whose API key produced it.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Requests</div>
                      <div className="text-lg font-semibold">
                        {usageToday.total.request_count.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Input tokens</div>
                      <div className="text-lg font-semibold">
                        {formatTokens(usageToday.total.input_units)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Output tokens</div>
                      <div className="text-lg font-semibold">
                        {formatTokens(usageToday.total.output_units)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cost</div>
                      <div className="text-lg font-semibold">
                        {formatCost(usageToday.total.cost_estimate)}
                      </div>
                    </div>
                  </div>
                  {usageToday.by_service.length > 0 && (
                    <ul className="divide-y divide-border text-xs">
                      {usageToday.by_service.map((row) => (
                        <li key={row.service} className="flex items-center gap-3 py-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {row.service}
                          </Badge>
                          <span className="min-w-0 flex-1 text-muted-foreground">
                            {row.request_count} req · {formatTokens(row.total_units)} tokens
                          </span>
                          <span className="shrink-0 font-mono">{formatCost(row.cost_estimate)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>
                  Latest audit events across all phases.{' '}
                  <NavLink to="/activity" className="text-primary underline-offset-2 hover:underline">
                    See all →
                  </NavLink>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No activity yet. Every create / update / delete across Agents, Skills, Approvals, Tokens, and Config will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.map((row) => (
                      <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                          {row.action}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {row.actor_label ?? row.actor_type} · {row.resource_type}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {relativeTime(row.timestamp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recently active agents</CardTitle>
                <CardDescription>
                  Last-seen timestamps are updated whenever an agent handles a chat request.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No agents have been active yet. Start a Chat session to light this up.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentAgents.map((agent) => (
                      <li key={agent.id} className="flex items-center gap-3 py-2 text-sm">
                        <NavLink to={`/agents/${agent.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                          {agent.name}
                        </NavLink>
                        <Badge variant={agent.status === 'active' ? 'default' : 'outline'} className="shrink-0">
                          {agent.status}
                        </Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {relativeTime(agent.last_active_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Roadmap</CardTitle>
              <CardDescription>What lands in each phase.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {ROADMAP.map((item) => (
                  <li key={item.phase} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {item.phase}
                      </span>
                      <span>{item.name}</span>
                    </span>
                    <Badge variant={variantFor(item.status)}>{item.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </AppShellContent>
    </>
  );
}
