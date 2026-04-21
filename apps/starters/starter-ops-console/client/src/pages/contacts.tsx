import { useCallback, useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Button,
  DataTable,
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  type Column,
} from '@teamsuzie/ui';
import { ContactDialog, type ContactFormValues } from '../components/contact-dialog.js';

export interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  approvalsEnabled: boolean;
}

export function ContactsPage({ approvalsEnabled }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/contacts', { credentials: 'include' });
    const data = (await response.json()) as { items: Contact[] };
    setContacts(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCreate(values: ContactFormValues) {
    const response = await fetch('/api/contacts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Create failed');
    }
    await refresh();
  }

  async function handleEdit(values: ContactFormValues) {
    if (!editing) return;
    const response = await fetch(`/api/contacts/${editing.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Save failed');
    }
    await refresh();
  }

  async function handleDelete(contact: Contact) {
    if (
      !confirm(
        approvalsEnabled
          ? `Propose deleting ${contact.name}? A reviewer must approve before the delete is applied.`
          : `Delete ${contact.name}? This cannot be undone.`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/contacts/${contact.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      setToast('Delete failed');
      return;
    }
    const data = (await response.json()) as { mode?: string; approval_id?: string };
    if (data.mode === 'approval') {
      setToast(`Deletion proposed — awaiting approval (id ${data.approval_id?.slice(0, 8)}…)`);
    } else {
      setToast(`${contact.name} deleted`);
    }
    await refresh();
  }

  const columns: Column<Contact>[] = [
    { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'email', header: 'Email', render: (c) => c.email },
    { key: 'company', header: 'Company', render: (c) => c.company ?? '—' },
    {
      key: 'notes',
      header: 'Notes',
      render: (c) => (
        <span className="text-muted-foreground line-clamp-1">{c.notes ?? ''}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Contacts</PageHeaderTitle>
          <PageHeaderDescription>
            Destructive actions {approvalsEnabled ? (
              <>are <Badge variant="default">gated</Badge> through the approval queue.</>
            ) : (
              <>run <Badge variant="secondary">directly</Badge> (queue disabled).</>
            )}
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/contacts.csv">Export CSV</a>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogMode('create');
              setDialogOpen(true);
            }}
          >
            New contact
          </Button>
        </PageHeaderActions>
      </PageHeader>
      <AppShellContent>
        <div className="p-6">
          {toast && (
            <div className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-sm">
              {toast}
            </div>
          )}
          <DataTable<Contact>
            data={contacts}
            columns={columns}
            getRowKey={(c) => c.id}
            isLoading={loading}
            emptyMessage="No contacts yet."
            filterFn={(c, q) => {
              const needle = q.toLowerCase();
              return (
                c.name.toLowerCase().includes(needle) ||
                c.email.toLowerCase().includes(needle) ||
                (c.company ?? '').toLowerCase().includes(needle)
              );
            }}
            filterPlaceholder="Filter contacts…"
            renderActions={(c) => (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(c);
                    setDialogMode('edit');
                    setDialogOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(c)}>
                  Delete
                </Button>
              </div>
            )}
          />
        </div>
      </AppShellContent>
      <ContactDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={dialogMode === 'create' ? handleCreate : handleEdit}
      />
    </>
  );
}
