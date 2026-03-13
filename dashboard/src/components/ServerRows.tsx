import type { FC } from "hono/jsx";
import type { ServerInfo } from "../manifest.ts";
import type { ContainerStatus } from "../docker.ts";
import StatusBadge from "./StatusBadge.tsx";
import TierBadge from "./TierBadge.tsx";

function formatUptime(startedAt: string | null): string {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export interface ServerWithStatus extends ServerInfo {
  container: ContainerStatus | null;
}

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div class="text-lg font-bold tabular-nums text-text-heading">{value}</div>
    <div class="text-xs text-text-muted">{label}</div>
  </div>
);

const ServerRows: FC<{ servers: ServerWithStatus[] }> = ({ servers }) => (
  <>
    {servers.map((s) => {
      const isRunning = s.container?.state === "running";
      const borderColor = isRunning
        ? "border-l-green"
        : s.container
          ? "border-l-border-light"
          : "border-l-border";
      return (
        <a
          href={`/servers/${s.name}`}
          class={`block rounded-lg border border-border border-l-4 ${borderColor} bg-bg-card p-5 no-underline hover:bg-bg-hover`}
        >
          <div class="mb-3 flex items-center gap-3">
            <span class="text-lg font-bold text-text-heading">{s.name}</span>
            <TierBadge tier={s.tier} />
          </div>
          <div class="mb-4">
            <StatusBadge container={s.container} />
          </div>
          {isRunning && s.container ? (
            <div class="grid grid-cols-3 gap-4">
              <Stat label="CPU" value={`${s.container.cpuPercent ?? 0}%`} />
              <Stat
                label="RAM"
                value={`${s.container.memoryUsageMB ?? 0} MB`}
              />
              <Stat label="Uptime" value={formatUptime(s.container.startedAt)} />
            </div>
          ) : (
            <div class="grid grid-cols-3 gap-4 text-text-muted">
              <Stat label="Mode" value={s.mode} />
              <Stat label="Memory" value={s.memory} />
              <Stat label="Mods" value={String(s.mods.length)} />
            </div>
          )}
        </a>
      );
    })}
  </>
);

export default ServerRows;
