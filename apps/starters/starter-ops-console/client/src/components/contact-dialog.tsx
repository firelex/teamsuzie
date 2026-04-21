import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@teamsuzie/ui';
import type { Contact } from '../pages/contacts.js';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Contact | null;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => Promise<void>;
}

export interface ContactFormValues {
  name: string;
  email: string;
  company: string;
  notes: string;
}

const EMPTY: ContactFormValues = { name: '', email: '', company: '', notes: '' };

export function ContactDialog({ open, mode, initial, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<ContactFormValues>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(
        initial
          ? {
              name: initial.name,
              email: initial.email,
              company: initial.company ?? '',
              notes: initial.notes ?? '',
            }
          : EMPTY,
      );
      setError(null);
    }
  }, [open, initial]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New contact' : 'Edit contact'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a contact to this organization.'
              : 'Update the contact record.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={values.company}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
