import { IssuePanel } from '@/components/issue-panel';

// Lives above the [id] segment so the panel isn't remounted (and doesn't
// replay its slide-in) when switching between issues.
export default function IssuePanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <IssuePanel>{children}</IssuePanel>;
}
