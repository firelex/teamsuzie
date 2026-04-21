import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@teamsuzie/ui';

interface DemoCredentials {
  email: string;
  password: string;
}

interface Props {
  onAuthenticated: () => Promise<void>;
  title: string;
  demo?: DemoCredentials;
}

export function LoginPage({ onAuthenticated, title, demo }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Login failed');
      }
      await onAuthenticated();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            {demo && (
              <div className="rounded-md border border-border bg-muted/50 p-3 text-xs">
                <div className="mb-1 font-medium text-foreground">Try the demo</div>
                <div className="space-y-0.5 font-mono text-muted-foreground">
                  <div>{demo.email}</div>
                  <div>{demo.password}</div>
                </div>
                <button
                  type="button"
                  className="mt-2 text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword(demo.password);
                  }}
                >
                  Fill credentials
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
