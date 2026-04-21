import type { ReactNode } from 'react';
import {
  AppShellContent,
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@teamsuzie/ui';

interface Props {
  title: string;
  description: string;
  phase: string;
  summary: string;
  icon?: ReactNode;
}

export function PlaceholderPage({ title, description, phase, summary, icon }: Props) {
  return (
    <>
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>{title}</PageHeaderTitle>
          <PageHeaderDescription>{description}</PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
      <AppShellContent>
        <div className="p-6">
          <EmptyState>
            {icon && <EmptyStateIcon>{icon}</EmptyStateIcon>}
            <EmptyStateTitle>Lands in {phase}</EmptyStateTitle>
            <EmptyStateDescription>{summary}</EmptyStateDescription>
          </EmptyState>
        </div>
      </AppShellContent>
    </>
  );
}
