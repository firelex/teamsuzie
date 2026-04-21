import { useCallback, useEffect, useState } from 'react';
import {
  AppShellContent,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@teamsuzie/ui';

export interface SkillTemplateRow {
  slug: string;
  name: string;
  description: string;
  required_context: string[];
}

export function SkillsPage() {
  const [items, setItems] = useState<SkillTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/skill-templates', { credentials: 'include' });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to load skills (${response.status})`);
      }
      const data = (await response.json()) as { items: SkillTemplateRow[] };
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Skills</PageHeaderTitle>
          <PageHeaderDescription>
            Installable capabilities shipped as <code className="font-mono">SKILL.md</code> templates in{' '}
            <code className="font-mono">packages/skills</code>. Attach a skill to an agent from the Agents page.
          </PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="space-y-4 p-6">
          {error && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive text-sm">{error}</CardTitle>
              </CardHeader>
            </Card>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading skills…</p>
          ) : items.length === 0 ? (
            <EmptyState>
              <EmptyStateTitle>No skills discovered</EmptyStateTitle>
              <EmptyStateDescription>
                Drop a directory with a <code className="font-mono">SKILL.md</code> under{' '}
                <code className="font-mono">packages/skills/templates/</code>, restart admin, and it will show up here.
              </EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((skill) => (
                <Card key={skill.slug} className="flex flex-col">
                  <CardHeader>
                    <CardDescription className="font-mono text-xs">{skill.slug}</CardDescription>
                    <CardTitle className="text-base">{skill.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{skill.description || '—'}</p>
                    <div className="mt-auto">
                      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Required context
                      </div>
                      {skill.required_context.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {skill.required_context.map((key) => (
                            <Badge key={key} variant="outline" className="font-mono text-[10px]">
                              {key}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </AppShellContent>
    </>
  );
}
