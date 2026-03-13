import type { FC } from "hono/jsx";
import type { ServerWithStatus } from "../components/ServerRows.tsx";
import ServerRows from "../components/ServerRows.tsx";

const TH: FC<{ children: any }> = ({ children }) => (
  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
    {children}
  </th>
);

const OverviewPage: FC<{ servers: ServerWithStatus[] }> = ({ servers }) => (
  <div>
    <div class="mb-4 flex items-center gap-4">
      <h1 class="text-xl font-bold text-text-heading">Servers</h1>
      <span class="text-sm text-text-muted" id="updated">
        {new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC
      </span>
    </div>
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full">
        <thead class="border-b border-border bg-bg-card">
          <tr>
            <TH>Name</TH>
            <TH>Status</TH>
            <TH>Tier</TH>
            <TH>CPU</TH>
            <TH>RAM</TH>
            <TH>Uptime</TH>
            <TH>Mode</TH>
            <TH>Memory</TH>
            <TH>Mods</TH>
            <TH>BlueMap</TH>
          </tr>
        </thead>
        <tbody
          id="server-rows"
          hx-get="/partials/servers"
          hx-trigger="every 10s"
          hx-swap="innerHTML"
        >
          <ServerRows servers={servers} />
        </tbody>
      </table>
    </div>
  </div>
);

export default OverviewPage;
