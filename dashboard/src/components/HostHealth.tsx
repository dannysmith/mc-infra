import type { FC } from "hono/jsx";
import type { HostMetrics } from "../host.ts";
import type { ServiceInfo } from "../docker.ts";

const Stat: FC<{ label: string; children: any }> = ({ label, children }) => (
  <div class="flex flex-col gap-0.5">
    <span class="text-xs font-semibold uppercase tracking-wider text-text-muted">
      {label}
    </span>
    <span class="tabular-nums">{children}</span>
  </div>
);

const Bar: FC<{ percent: number; color?: string }> = ({
  percent,
  color = "bg-blue",
}) => (
  <div class="h-2 w-24 rounded-full bg-border">
    <div
      class={`h-2 rounded-full ${color}`}
      style={`width: ${Math.min(percent, 100)}%`}
    />
  </div>
);

const stateColors: Record<string, string> = {
  running: "text-green",
  exited: "text-text-muted",
  restarting: "text-orange",
  dead: "text-red",
};

const HostHealth: FC<{ metrics: HostMetrics; services: ServiceInfo[] }> = ({
  metrics,
  services,
}) => {
  const memPercent = Math.round(
    (metrics.memory.usedMB / metrics.memory.totalMB) * 100
  );

  return (
    <div class="mb-6 rounded-lg border border-border bg-bg-card p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Host
        </h2>
      </div>

      {/* Metrics row */}
      <div class="mb-5 flex flex-wrap gap-8">
        <Stat label="Load">
          {metrics.load.one} / {metrics.load.five} / {metrics.load.fifteen}
          <span class="ml-1 text-xs text-text-muted">
            ({metrics.cpu.cores} cores)
          </span>
        </Stat>
        <Stat label="Memory">
          <div class="flex items-center gap-2">
            {metrics.memory.usedMB} / {metrics.memory.totalMB} MB ({memPercent}
            %)
            <Bar
              percent={memPercent}
              color={memPercent > 90 ? "bg-red" : "bg-blue"}
            />
          </div>
        </Stat>
        <Stat label="Disk">
          <div class="flex items-center gap-2">
            {metrics.disk.usedGB} / {metrics.disk.totalGB} GB (
            {metrics.disk.usedPercent}%)
            <Bar
              percent={metrics.disk.usedPercent}
              color={metrics.disk.usedPercent > 90 ? "bg-red" : "bg-blue"}
            />
          </div>
        </Stat>
      </div>

      {/* Services */}
      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Services
        </h3>
        <div class="flex flex-wrap gap-3">
          {services.map((s) => (
            <div class="flex items-center gap-2 rounded border border-border-light px-3 py-1.5 text-sm">
              <span class={stateColors[s.state] ?? "text-text-muted"}>
                {s.state === "running" ? "\u25CF" : "\u25CB"}
              </span>
              <span class="font-medium">{s.name}</span>
              <span class="text-xs text-text-muted">{s.image}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HostHealth;
