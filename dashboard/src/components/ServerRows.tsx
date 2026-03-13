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

const ServerRows: FC<{ servers: ServerWithStatus[] }> = ({ servers }) => (
  <>
    {servers.map((s) => (
      <tr class="border-b border-border hover:bg-bg-hover">
        <td class="px-4 py-3">
          <a
            href={`/servers/${s.name}`}
            class="font-semibold text-link no-underline hover:underline"
          >
            {s.name}
          </a>
        </td>
        <td class="px-4 py-3">
          <StatusBadge container={s.container} />
        </td>
        <td class="px-4 py-3">
          <TierBadge tier={s.tier} />
        </td>
        <td class="px-4 py-3 tabular-nums">
          {s.container?.cpuPercent != null ? `${s.container.cpuPercent}%` : ""}
        </td>
        <td class="px-4 py-3 tabular-nums">
          {s.container?.memoryUsageMB != null
            ? `${s.container.memoryUsageMB} / ${s.container.memoryLimitMB} MB`
            : ""}
        </td>
        <td class="px-4 py-3">
          {s.container ? formatUptime(s.container.startedAt) : ""}
        </td>
        <td class="px-4 py-3">{s.mode}</td>
        <td class="px-4 py-3">{s.memory}</td>
        <td class="px-4 py-3 text-sm text-text-muted max-w-64 truncate">
          {s.mods.join(", ")}
        </td>
        <td class="px-4 py-3">
          {s.bluemapUrl ? (
            <a
              href={s.bluemapUrl}
              target="_blank"
              class="text-link no-underline hover:underline"
              {...{ "hx-boost": "false" }}
            >
              Map
            </a>
          ) : (
            ""
          )}
        </td>
      </tr>
    ))}
  </>
);

export default ServerRows;
