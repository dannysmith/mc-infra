import type { FC } from "hono/jsx";
import type { ServerWithStatus } from "../components/ServerRows.tsx";
import type { ServerDiskUsage } from "../filesystem.ts";
import { formatBytes } from "../filesystem.ts";
import StatusBadge from "../components/StatusBadge.tsx";
import TierBadge from "../components/TierBadge.tsx";

const Field: FC<{ label: string; children: any }> = ({ label, children }) => (
  <div class="flex flex-col gap-1">
    <dt class="text-xs font-semibold uppercase tracking-wider text-text-muted">
      {label}
    </dt>
    <dd>{children}</dd>
  </div>
);

const DetailPage: FC<{
  server: ServerWithStatus;
  disk: ServerDiskUsage;
  rconCommands: string[];
}> = ({ server: s, disk, rconCommands }) => (
  <div>
    <div class="mb-6">
      <a
        href="/"
        class="text-sm text-text-muted no-underline hover:text-link"
      >
        &larr; All servers
      </a>
    </div>

    <div class="mb-6 flex items-center gap-4">
      <h1 class="text-xl font-bold text-text-heading">{s.name}</h1>
      <TierBadge tier={s.tier} />
      <StatusBadge container={s.container} />
    </div>

    {/* Config from manifest */}
    <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Configuration
      </h2>
      <dl class="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Type">{s.type}</Field>
        <Field label="Version">{s.version}</Field>
        <Field label="Mode">{s.mode}</Field>
        <Field label="Memory">{s.memory}</Field>
        <Field label="MOTD">{s.motd}</Field>
        <Field label="Seed">{s.seed ?? "random"}</Field>
        <Field label="Created">{s.created}</Field>
        {s.bluemapUrl && (
          <Field label="BlueMap">
            <a
              href={s.bluemapUrl}
              target="_blank"
              class="text-link no-underline hover:underline"
              {...{ "hx-boost": "false" }}
            >
              {s.bluemapUrl.replace("https://", "")}
            </a>
          </Field>
        )}
      </dl>
    </section>

    {/* Mods */}
    <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Mods
      </h2>
      <div class="mb-2 text-sm text-text-muted">
        Groups: {s.modGroups.join(", ") || "none"}
      </div>
      <div class="flex flex-wrap gap-2">
        {s.mods.map((mod) => (
          <span class="rounded bg-border px-2 py-0.5 text-sm">{mod}</span>
        ))}
      </div>
    </section>

    {/* Runtime data */}
    {s.container && s.container.state !== "not_created" && (
      <section
        class="mb-6 rounded-lg border border-border bg-bg-card p-5"
        id="runtime"
        hx-get={`/partials/servers/${s.name}/runtime`}
        hx-trigger="every 10s"
        hx-swap="innerHTML"
      >
        <RuntimeSection container={s.container} />
      </section>
    )}

    {/* Disk usage */}
    {disk.total > 0 && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Disk Usage
        </h2>
        <div class="mb-3 text-lg font-semibold tabular-nums">
          {formatBytes(disk.total)}
        </div>
        <DiskBar categories={disk.categories} total={disk.total} />
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1">
          {disk.categories.map((cat) => (
            <div class="flex items-center gap-2 text-sm">
              <span
                class="inline-block h-3 w-3 rounded-sm"
                style={`background: ${diskColor(cat.label)}`}
              />
              <span>{cat.label}</span>
              <span class="tabular-nums text-text-muted">
                {formatBytes(cat.bytes)}
              </span>
            </div>
          ))}
        </div>
      </section>
    )}

    {/* RCON */}
    {s.container?.state === "running" && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Console
        </h2>
        <div class="mb-3 flex flex-wrap gap-2">
          {rconCommands.map((cmd) => (
            <button
              class="rounded border border-border-light bg-bg px-3 py-1.5 text-sm text-text hover:bg-bg-hover"
              hx-post={`/api/servers/${s.name}/rcon`}
              hx-vals={`{"command":"${cmd}"}`}
              hx-target="#rcon-output"
              hx-swap="innerHTML"
            >
              {cmd}
            </button>
          ))}
        </div>
        <pre
          id="rcon-output"
          class="min-h-[2rem] rounded bg-bg p-3 text-sm text-text-muted"
        >
          Click a command above to run it.
        </pre>
      </section>
    )}
  </div>
);

const DISK_COLORS: Record<string, string> = {
  Overworld: "#3fb950",
  Nether: "#f85149",
  End: "#d2a8ff",
  "DH LODs": "#f0883e",
  BlueMap: "#58a6ff",
  Mods: "#8b949e",
  Other: "#484f58",
};

function diskColor(label: string): string {
  return DISK_COLORS[label] ?? "#484f58";
}

const DiskBar: FC<{
  categories: { label: string; bytes: number }[];
  total: number;
}> = ({ categories, total }) => (
  <div class="flex h-4 w-full overflow-hidden rounded-full bg-border">
    {categories.map((cat) => {
      const pct = (cat.bytes / total) * 100;
      if (pct < 0.5) return null;
      return (
        <div
          style={`width: ${pct}%; background: ${diskColor(cat.label)}`}
          title={`${cat.label}: ${formatBytes(cat.bytes)}`}
        />
      );
    })}
  </div>
);

const RuntimeSection: FC<{
  container: NonNullable<ServerWithStatus["container"]>;
}> = ({ container: c }) => (
  <>
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
      Runtime
    </h2>
    <dl class="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      <Field label="State">
        <StatusBadge container={c} />
      </Field>
      {c.cpuPercent != null && (
        <Field label="CPU">
          <span class="tabular-nums">{c.cpuPercent}%</span>
        </Field>
      )}
      {c.memoryUsageMB != null && (
        <Field label="RAM">
          <span class="tabular-nums">
            {c.memoryUsageMB} / {c.memoryLimitMB} MB
          </span>
        </Field>
      )}
      {c.startedAt && (
        <Field label="Started">{new Date(c.startedAt).toUTCString()}</Field>
      )}
    </dl>
  </>
);

export { RuntimeSection };
export default DetailPage;
