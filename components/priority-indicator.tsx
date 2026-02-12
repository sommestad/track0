interface PriorityIndicatorProps {
  priority: number;
}

const priorityColor: Record<number, string> = {
  1: 'var(--red)',
  2: 'var(--yellow)',
  3: 'var(--blue)',
};

export function PriorityIndicator({
  priority,
}: PriorityIndicatorProps): React.ReactNode {
  const color = priorityColor[priority];

  return (
    <span
      className="ml-auto text-[0.625rem] text-muted-foreground"
      style={color ? { color } : undefined}
    >
      P{priority}
    </span>
  );
}
