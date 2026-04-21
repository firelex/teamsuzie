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

interface Props {
  title: string;
  agentsConfigured: number;
  user: SessionUser;
}

const ROADMAP: { phase: string; name: string; status: 'live' | 'next' | 'planned' }[] = [
  { phase: '0', name: 'Foundations (auth + routed shell)', status: 'live' },
  { phase: '1', name: 'Agent registry', status: 'next' },
  { phase: '2', name: 'Skills management', status: 'planned' },
  { phase: '3', name: 'Approvals inbox', status: 'planned' },
  { phase: '4', name: 'Artifacts browser', status: 'planned' },
  { phase: '5', name: 'Tokens & API keys', status: 'planned' },
  { phase: '6', name: 'Config surface', status: 'planned' },
  { phase: '7', name: 'Activity & usage', status: 'planned' },
];

function variantFor(status: 'live' | 'next' | 'planned'): 'default' | 'secondary' | 'outline' {
  return status === 'live' ? 'default' : status === 'next' ? 'secondary' : 'outline';
}

export function OverviewPage({ title, agentsConfigured, user }: Props) {
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
                  OpenClaw-compatible agents wired via <code className="font-mono">CHAT_AGENTS</code>. Once the Agent Registry lands, this falls back to DB-managed agents.
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
                  Multi-tenant sessions via <code className="font-mono">@teamsuzie/shared-auth</code>.
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
                  Pluggable routers on the backend, react-router on the client. New phases drop in without touching the shell.
                </p>
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
