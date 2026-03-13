import type { FC } from "hono/jsx";
import type { ServerWithStatus } from "../components/ServerRows.tsx";
import type { HostMetrics } from "../host.ts";
import type { ServiceInfo } from "../docker.ts";
import ServerRows from "../components/ServerRows.tsx";
import HostHealth from "../components/HostHealth.tsx";

const OverviewPage: FC<{
  servers: ServerWithStatus[];
  host: HostMetrics;
  services: ServiceInfo[];
}> = ({ servers, host, services }) => (
  <div>
    <div class="mb-6 flex items-center gap-4">
      <h1 class="text-2xl font-bold text-text-heading">Overview</h1>
      <span class="text-sm text-text-muted" id="updated">
        {new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC
      </span>
    </div>

    <div
      id="host-health"
      hx-get="/partials/host"
      hx-trigger="every 10s"
      hx-swap="innerHTML"
    >
      <HostHealth metrics={host} services={services} />
    </div>

    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
      Servers
    </h2>
    <div
      id="server-rows"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      hx-get="/partials/servers"
      hx-trigger="every 10s"
      hx-swap="innerHTML"
    >
      <ServerRows servers={servers} />
    </div>
  </div>
);

export default OverviewPage;
