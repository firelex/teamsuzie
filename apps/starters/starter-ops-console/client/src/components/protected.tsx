import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { SessionUser } from '../hooks/use-session.js';

interface Props {
  user: SessionUser | null;
  loading: boolean;
  roles?: string[];
  children: ReactNode;
}

export function Protected({ user, loading, roles, children }: Props) {
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        You don't have access to this page.
      </div>
    );
  }
  return <>{children}</>;
}
