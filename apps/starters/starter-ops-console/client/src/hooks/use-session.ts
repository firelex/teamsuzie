import { useCallback, useEffect, useState } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/session', { credentials: 'include' });
      const data = (await response.json()) as { user: SessionUser | null };
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, error, refresh, logout };
}
