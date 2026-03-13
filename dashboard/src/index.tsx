import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getServers } from "./manifest.ts";
import {
  getContainerStatuses,
  getContainerStatus,
  getAllContainers,
} from "./docker.ts";
import { getHostMetrics } from "./host.ts";
import Layout from "./components/Layout.tsx";
import OverviewPage from "./routes/overview.tsx";
import DetailPage from "./routes/detail.tsx";
import ServerRows from "./components/ServerRows.tsx";
import HostHealth from "./components/HostHealth.tsx";
import { RuntimeSection } from "./routes/detail.tsx";
import type { ServerWithStatus } from "./components/ServerRows.tsx";

const app = new Hono();

// Static files (CSS)
app.use("/styles/*", serveStatic({ root: "./src/" }));

// Helper: get servers with container status
async function getServersWithStatus(): Promise<ServerWithStatus[]> {
  const servers = getServers();
  const statuses = await getContainerStatuses(servers.map((s) => s.name));
  return servers.map((s) => ({ ...s, container: statuses[s.name] ?? null }));
}

// JSON API (kept for debugging / future use)
app.get("/api/servers", async (c) => {
  try {
    const servers = await getServersWithStatus();
    return c.json(servers);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Overview page
app.get("/", async (c) => {
  const [servers, services] = await Promise.all([
    getServersWithStatus(),
    getAllContainers(),
  ]);
  const host = getHostMetrics();
  return c.html(
    <Layout>
      <OverviewPage servers={servers} host={host} services={services} />
    </Layout>
  );
});

// Server detail page
app.get("/servers/:name", async (c) => {
  const name = c.req.param("name");
  const servers = getServers();
  const server = servers.find((s) => s.name === name);
  if (!server) {
    return c.html(
      <Layout title="Not Found">
        <p class="text-red">Server "{name}" not found.</p>
      </Layout>,
      404
    );
  }
  const status = await getContainerStatus(name);
  const serverWithStatus: ServerWithStatus = { ...server, container: status };
  return c.html(
    <Layout title={name}>
      <DetailPage server={serverWithStatus} />
    </Layout>
  );
});

// HTMX partial: host health
app.get("/partials/host", async (c) => {
  const host = getHostMetrics();
  const services = await getAllContainers();
  return c.html(<HostHealth metrics={host} services={services} />);
});

// HTMX partial: server table rows
app.get("/partials/servers", async (c) => {
  const servers = await getServersWithStatus();
  return c.html(<ServerRows servers={servers} />);
});

// HTMX partial: server runtime section
app.get("/partials/servers/:name/runtime", async (c) => {
  const name = c.req.param("name");
  const status = await getContainerStatus(name);
  if (!status) {
    return c.html(<p class="text-text-muted">Container not found.</p>);
  }
  return c.html(<RuntimeSection container={status} />);
});

export default {
  port: 3100,
  fetch: app.fetch,
};
