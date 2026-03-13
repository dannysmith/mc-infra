import type { FC } from "hono/jsx";
import type { ContainerStatus } from "../docker.ts";

const StatusBadge: FC<{ container: ContainerStatus | null }> = ({
  container,
}) => {
  if (!container) {
    return <span class="text-text-muted/50">not created</span>;
  }

  const colors: Record<string, string> = {
    running: "text-green",
    exited: "text-text-muted",
  };

  const colorClass = colors[container.state] ?? "text-text-muted";
  const label = container.health
    ? `${container.state} (${container.health})`
    : container.state;

  return <span class={colorClass}>{label}</span>;
};

export default StatusBadge;
