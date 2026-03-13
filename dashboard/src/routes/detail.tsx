import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { ServerWithStatus } from "../components/ServerRows.tsx";
import type { ServerDiskUsage } from "../filesystem.ts";
import { formatBytes } from "../filesystem.ts";
import type { WorldInfo, PlayerData } from "../world.ts";
import {
  gameModeName,
  difficultyName,
  formatPlayTime,
  formatDistance,
  formatDayTime,
} from "../world.ts";
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

const BigStat: FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div>
    <div class="text-2xl font-bold tabular-nums text-text-heading">{value}</div>
    <div class="text-xs text-text-muted">
      {label}
      {sub && <span class="ml-1 text-text-muted/60">{sub}</span>}
    </div>
  </div>
);

const DetailPage: FC<{
  server: ServerWithStatus;
  disk: ServerDiskUsage;
  rconCommands: string[];
  worldInfo: WorldInfo | null;
  players: PlayerData[];
}> = ({ server: s, disk, rconCommands, worldInfo, players }) => (
  <div>
    {/* Breadcrumb */}
    <div class="mb-4">
      <a
        href="/"
        class="text-sm text-text-muted no-underline hover:text-link"
      >
        &larr; Overview
      </a>
    </div>

    {/* Hero card — server name + status + runtime stats */}
    <section class="mb-8 rounded-lg border border-border bg-bg-card p-6">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold text-text-heading">{s.name}</h1>
        <TierBadge tier={s.tier} />
        <StatusBadge container={s.container} />
      </div>

      {s.container && s.container.state !== "not_created" && (
        <div
          id="runtime"
          hx-get={`/partials/servers/${s.name}/runtime`}
          hx-trigger="every 10s"
          hx-swap="innerHTML"
        >
          <RuntimeSection container={s.container} />
        </div>
      )}
    </section>

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

    {/* Disk usage */}
    {disk.total > 0 && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Disk Usage
        </h2>
        <div class="mb-3 text-2xl font-bold tabular-nums text-text-heading">
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

    {/* World info */}
    {worldInfo && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          World
        </h2>
        <dl class="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="MC Version">{worldInfo.version}</Field>
          <Field label="Seed">
            <span class="font-mono text-sm">{worldInfo.seed}</span>
          </Field>
          <Field label="Spawn">
            <span class="tabular-nums">
              {worldInfo.spawnX}, {worldInfo.spawnY}, {worldInfo.spawnZ}
            </span>
          </Field>
          <Field label="Day Time">
            <span class="tabular-nums">
              Day {Math.floor(worldInfo.dayTime / 24000)},{" "}
              {formatDayTime(worldInfo.dayTime)}
            </span>
          </Field>
          <Field label="Game Mode">
            {gameModeName(worldInfo.gameType)}
          </Field>
          <Field label="Difficulty">
            {difficultyName(worldInfo.difficulty)}
            {worldInfo.hardcore && (
              <span class="ml-1 text-red">(Hardcore)</span>
            )}
          </Field>
          <Field label="Weather">
            {worldInfo.thundering
              ? "Thunder"
              : worldInfo.raining
                ? "Rain"
                : "Clear"}
          </Field>
        </dl>
        {Object.keys(worldInfo.gamerules).length > 0 && (
          <details class="mt-4">
            <summary class="cursor-pointer text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text">
              Gamerules
            </summary>
            <dl class="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(worldInfo.gamerules)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, val]) => (
                  <div class="flex justify-between gap-2">
                    <dt class="text-text-muted">{key}</dt>
                    <dd
                      class={
                        val === "true"
                          ? "text-green"
                          : val === "false"
                            ? "text-text-muted"
                            : "tabular-nums"
                      }
                    >
                      {val}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
        )}
      </section>
    )}

    {/* Players */}
    {players.length > 0 && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Players
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          {players.map((p) => (
            <div class="rounded-lg border border-border bg-bg p-5">
              {/* Player header */}
              <div class="mb-4 flex items-center gap-3">
                <img
                  src={`https://mc-heads.net/avatar/${p.uuid}/48`}
                  alt=""
                  class="h-12 w-12 rounded"
                  loading="lazy"
                />
                <div>
                  <div class="text-lg font-bold text-text-heading">
                    {p.name}
                  </div>
                  <div class="text-xs text-text-muted">
                    {gameModeName(p.gameMode)}
                  </div>
                </div>
              </div>

              {/* Location */}
              <dl class="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Field label="Position">
                  <span class="tabular-nums">
                    {p.posX}, {p.posY}, {p.posZ}
                  </span>
                </Field>
                <Field label="Dimension">{p.dimension}</Field>
                <Field label="Health">
                  <span class="tabular-nums">{p.health / 2}</span>
                  <span class="text-red"> &#10084;</span>
                </Field>
                <Field label="XP Level">
                  <span class="tabular-nums">{p.xpLevel}</span>
                </Field>
              </dl>

              {/* Stats */}
              {p.stats && (
                <>
                  <div class="mb-3 border-t border-border" />
                  <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Field label="Play Time">
                      {formatPlayTime(p.stats.playTimeTicks)}
                    </Field>
                    <Field label="Deaths">
                      <span class="tabular-nums">{p.stats.deaths}</span>
                    </Field>
                    <Field label="Mobs Killed">
                      <span class="tabular-nums">{p.stats.mobKills}</span>
                    </Field>
                    <Field label="Blocks Mined">
                      <span class="tabular-nums">{p.stats.blocksMined}</span>
                    </Field>
                    <Field label="Walked">
                      {formatDistance(p.stats.distanceWalkedCm)}
                    </Field>
                    <Field label="Flown">
                      {formatDistance(p.stats.distanceFlownCm)}
                    </Field>
                    {p.advancementCount > 0 && (
                      <Field label="Advancements">
                        <span class="tabular-nums">{p.advancementCount}</span>
                      </Field>
                    )}
                  </dl>
                </>
              )}
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
          class="min-h-[2.5rem] rounded border border-border bg-bg p-4 font-mono text-sm text-text-muted"
        >
          Click a command above to run it.
        </pre>
      </section>
    )}

    {/* Logs */}
    {s.container?.state === "running" && (
      <section class="mb-6 rounded-lg border border-border bg-bg-card p-5">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          Logs
        </h2>
        <div
          id="log-viewer"
          data-server={s.name}
          class="h-96 overflow-y-auto rounded border border-border bg-bg p-3 font-mono text-xs leading-5 text-text-muted"
        >
          <div id="log-content"></div>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <span id="log-status" class="text-xs text-text-muted">
            Connecting...
          </span>
          <button
            id="log-scroll-btn"
            class="hidden rounded border border-border-light bg-bg px-2 py-1 text-xs text-text-muted hover:bg-bg-hover"
          >
            &darr; Scroll to bottom
          </button>
        </div>
        <script>
          {raw(`(function(){
  var v=document.getElementById('log-viewer'),c=document.getElementById('log-content'),
      st=document.getElementById('log-status'),sb=document.getElementById('log-scroll-btn'),
      name=v.dataset.server,auto=true,ws=null,dead=false;
  function connect(){
    if(dead)return;
    var p=location.protocol==='https:'?'wss:':'ws:';
    ws=new WebSocket(p+'//'+location.host+'/ws/servers/'+name+'/logs');
    ws.onopen=function(){st.textContent='Connected';};
    ws.onmessage=function(e){
      var d=document.createElement('div');d.textContent=e.data;c.appendChild(d);
      while(c.children.length>1000)c.removeChild(c.firstChild);
      if(auto)v.scrollTop=v.scrollHeight;
    };
    ws.onclose=function(){if(!dead){st.textContent='Disconnected. Reconnecting...';setTimeout(connect,3000);}};
    ws.onerror=function(){ws.close();};
  }
  v.addEventListener('scroll',function(){
    var atBot=v.scrollHeight-v.scrollTop-v.clientHeight<30;
    auto=atBot;sb.classList.toggle('hidden',atBot);
  });
  sb.addEventListener('click',function(){v.scrollTop=v.scrollHeight;auto=true;sb.classList.add('hidden');});
  document.addEventListener('htmx:beforeSwap',function cleanup(){dead=true;if(ws)ws.close();document.removeEventListener('htmx:beforeSwap',cleanup);});
  connect();
})()`)}
        </script>
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
  <div class="flex h-5 w-full overflow-hidden rounded-full bg-border">
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
}> = ({ container: c }) => {
  const isRunning = c.state === "running";
  if (!isRunning) {
    return (
      <div class="mt-4 border-t border-border pt-4">
        <StatusBadge container={c} />
      </div>
    );
  }

  return (
    <div class="mt-4 grid grid-cols-4 gap-6 border-t border-border pt-4">
      {c.cpuPercent != null && (
        <BigStat label="CPU" value={`${c.cpuPercent}%`} />
      )}
      {c.memoryUsageMB != null && (
        <BigStat
          label="RAM"
          value={`${c.memoryUsageMB} MB`}
          sub={`/ ${c.memoryLimitMB} MB`}
        />
      )}
      {c.startedAt && (
        <BigStat
          label="Uptime"
          value={formatUptime(c.startedAt)}
        />
      )}
      <BigStat label="Status" value={c.health ?? c.state} />
    </div>
  );
};

function formatUptime(startedAt: string): string {
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

export { RuntimeSection };
export default DetailPage;
