import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  AppShellContent,
  AppShellMain,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
} from '@teamsuzie/ui';
import { Protected } from './components/protected.js';
import { useSession, type SessionUser } from './hooks/use-session.js';
import { LoginPage } from './pages/login.js';
import { ContactsPage } from './pages/contacts.js';
import { UsersPage } from './pages/users.js';
import { ApprovalsPage } from './pages/approvals.js';

interface HealthResponse {
  title: string;
  approvalsEnabled: boolean;
  demo?: { email: string; password: string };
}

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/contacts', label: 'Contacts' },
  { to: '/users', label: 'Users' },
  { to: '/approvals', label: 'Approvals' },
];

function Wordmark({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-6 rounded-md bg-foreground" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-tight">{title}</span>
    </div>
  );
}

function OpsSidebar({
  title,
  user,
  onLogout,
}: {
  title: string;
  user: SessionUser;
  onLogout: () => Promise<void>;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <Wordmark title={title} />
      </SidebarHeader>
      <SidebarNav>
        {NAV.map((item) => (
          <SidebarNavItem key={item.to} asChild>
            <NavLink to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          </SidebarNavItem>
        ))}
      </SidebarNav>
      <SidebarFooter>
        <div className="space-y-2">
          <div className="truncate text-foreground/80">{user.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardPage({
  approvalsEnabled,
  user,
}: {
  approvalsEnabled: boolean;
  user: SessionUser;
}) {
  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Dashboard</PageHeaderTitle>
          <PageHeaderDescription>
            Welcome, {user.name}. This starter shows Team Suzie's primitives wired into a polished admin surface.
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Button size="sm" asChild>
            <a href="/contacts">Open Contacts</a>
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <AppShellContent>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Approvals</CardDescription>
              <CardTitle className="flex items-center gap-2">
                {approvalsEnabled ? 'Gated' : 'Bypassed'}
                <Badge variant={approvalsEnabled ? 'default' : 'secondary'}>
                  {approvalsEnabled ? 'on' : 'off'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Destructive actions route through <code className="font-mono">@teamsuzie/approvals</code>.
                Toggle with <code className="font-mono">STARTER_OPS_APPROVALS_ENABLED</code>.
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
                Multi-tenant sessions via <code className="font-mono">@teamsuzie/shared-auth</code>. Contacts scope to your default org.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Export</CardDescription>
              <CardTitle>CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Download your org's contacts at <code className="font-mono">/api/export/contacts.csv</code>.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppShellContent>
    </>
  );
}

function AppContent({
  health,
  user,
  onLogout,
}: {
  health: HealthResponse;
  user: SessionUser;
  onLogout: () => Promise<void>;
}) {
  return (
    <AppShell>
      <OpsSidebar title={health.title} user={user} onLogout={onLogout} />
      <AppShellMain>
        <Routes>
          <Route path="/" element={<DashboardPage approvalsEnabled={health.approvalsEnabled} user={user} />} />
          <Route path="/contacts" element={<ContactsPage approvalsEnabled={health.approvalsEnabled} />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </AppShellMain>
    </AppShell>
  );
}

function AuthedGate({
  children,
  user,
  loading,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
  loading: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  return <>{children}</>;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const session = useSession();

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealth({ title: 'Team Suzie', approvalsEnabled: true }));
  }, []);

  const resolvedHealth = health ?? { title: 'Team Suzie', approvalsEnabled: true };

  return (
    <AuthedGate user={session.user} loading={session.loading}>
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              title={resolvedHealth.title}
              onAuthenticated={session.refresh}
              demo={resolvedHealth.demo}
            />
          }
        />
        <Route
          path="/*"
          element={
            <Protected user={session.user} loading={session.loading}>
              {session.user && (
                <AppContent
                  health={resolvedHealth}
                  user={session.user}
                  onLogout={session.logout}
                />
              )}
            </Protected>
          }
        />
      </Routes>
    </AuthedGate>
  );
}
