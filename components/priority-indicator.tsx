interface PriorityIndicatorProps {
  priority: number;
}

export function PriorityIndicator({
  priority,
}: PriorityIndicatorProps): React.ReactNode {
  return (
    <span className="ml-auto text-[0.625rem] text-muted-foreground">
      P{priority}
    </span>
  );
}
