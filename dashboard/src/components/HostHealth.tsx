import type { FC } from "hono/jsx";
import type { HostMetrics } from "../host.ts";
import type { ServiceInfo } from "../docker.ts";

const RingChart: FC<{
  percent: number;
  size?: number;
  color?: string;
}> = ({ percent, size = 88, color = "var(--color-blue)" }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percent, 100) / 100);
  return (
    <div class="relative" style={`width:${size}px;height:${size}px`}>
      <svg width={size} height={size} style="transform:rotate(-90deg)">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style="stroke:var(--color-border);stroke-width:6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={`stroke:${color};stroke-width:6;stroke-dasharray:${circ};stroke-dashoffset:${offset};stroke-linecap:round`}
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-xl font-bold tabular-nums">{percent}%</span>
      </div>
    </div>
  );
};

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
  const diskPercent = metrics.disk.usedPercent;

  return (
    <div class="mb-8">
      {/* Metric cards */}
      <div class="mb-4 grid grid-cols-3 gap-4">
        {/* Load */}
        <div class="rounded-lg border border-border bg-bg-card p-5">
          <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Load Average
          </div>
          <div class="mb-1 text-3xl font-bold tabular-nums text-text-heading">
            {metrics.load.one}
          </div>
          <div class="text-sm tabular-nums text-text-muted">
            {metrics.load.five} / {metrics.load.fifteen}
            <span class="ml-1 text-xs">({metrics.cpu.cores} cores)</span>
          </div>
        </div>

        {/* Memory */}
        <div class="rounded-lg border border-border bg-bg-card p-5">
          <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Memory
          </div>
          <div class="flex items-center gap-5">
            <RingChart
              percent={memPercent}
              color={
                memPercent > 90 ? "var(--color-red)" : "var(--color-blue)"
              }
            />
            <div class="text-sm tabular-nums">
              <span class="text-text">{metrics.memory.usedMB}</span>
              <span class="text-text-muted">
                {" "}
                / {metrics.memory.totalMB} MB
              </span>
            </div>
          </div>
        </div>

        {/* Disk */}
        <div class="rounded-lg border border-border bg-bg-card p-5">
          <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Disk
          </div>
          <div class="flex items-center gap-5">
            <RingChart
              percent={diskPercent}
              color={
                diskPercent > 90 ? "var(--color-red)" : "var(--color-blue)"
              }
            />
            <div class="text-sm tabular-nums">
              <span class="text-text">{metrics.disk.usedGB}</span>
              <span class="text-text-muted">
                {" "}
                / {metrics.disk.totalGB} GB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Services — compact pill row */}
      <div class="flex flex-wrap gap-2">
        {services.map((s) => (
          <div
            class="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs"
            title={s.image}
          >
            <span class={stateColors[s.state] ?? "text-text-muted"}>
              {s.state === "running" ? "\u25CF" : "\u25CB"}
            </span>
            <span class="font-medium">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HostHealth;
