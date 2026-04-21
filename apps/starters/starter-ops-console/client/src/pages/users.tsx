import { useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  DataTable,
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  type Column,
} from '@teamsuzie/ui';

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  joined_at: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Failed to load users');
        }
        const data = (await response.json()) as { items: OrgUser[] };
        if (!cancelled) setUsers(data.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: Column<OrgUser>[] = [
    { key: 'name', header: 'Name', render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>{u.role}</Badge>
      ),
    },
    {
      key: 'joined_at',
      header: 'Joined',
      render: (u) => new Date(u.joined_at).toLocaleDateString(),
    },
  ];

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Users</PageHeaderTitle>
          <PageHeaderDescription>
            Members of your default organization. Role changes and deactivation are future phases.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="p-6">
          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
          <DataTable<OrgUser>
            data={users}
            columns={columns}
            getRowKey={(u) => u.id}
            isLoading={loading}
            emptyMessage="No members found."
          />
        </div>
      </AppShellContent>
    </>
  );
}
