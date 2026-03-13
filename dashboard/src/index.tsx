import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { createBunWebSocket } from "hono/bun";
import { getServers } from "./manifest.ts";
import {
  getContainerStatuses,
  getContainerStatus,
  getAllContainers,
  streamContainerLogs,
} from "./docker.ts";
import { getHostMetrics } from "./host.ts";
import { executeRcon, getAllowedCommands } from "./rcon.ts";
import { getServerDiskUsage } from "./filesystem.ts";
import { getWorldInfo, getPlayerData } from "./world.ts";
import Layout from "./components/Layout.tsx";
import OverviewPage from "./routes/overview.tsx";
import DetailPage from "./routes/detail.tsx";
import ServerRows from "./components/ServerRows.tsx";
import HostHealth from "./components/HostHealth.tsx";
import { RuntimeSection } from "./routes/detail.tsx";
import type { ServerWithStatus } from "./components/ServerRows.tsx";

const { upgradeWebSocket, websocket } = createBunWebSocket();

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
  const [status, worldInfo, players] = await Promise.all([
    getContainerStatus(name),
    getWorldInfo(name),
    getPlayerData(name),
  ]);
  const disk = getServerDiskUsage(name);
  const serverWithStatus: ServerWithStatus = { ...server, container: status };
  return c.html(
    <Layout title={name}>
      <DetailPage
        server={serverWithStatus}
        disk={disk}
        rconCommands={getAllowedCommands()}
        worldInfo={worldInfo}
        players={players}
      />
    </Layout>
  );
});

// RCON command execution
app.post("/api/servers/:name/rcon", async (c) => {
  const name = c.req.param("name");
  const servers = getServers();
  if (!servers.find((s) => s.name === name)) {
    return c.html(
      <span class="text-red">Server not found.</span>,
      404
    );
  }

  const body = await c.req.parseBody();
  const command = typeof body.command === "string" ? body.command : "";
  const result = await executeRcon(name, command);

  if (!result.ok) {
    return c.html(<span class="text-red">{result.output}</span>);
  }
  return c.html(<span>{result.output || "(no output)"}</span>);
});

// WebSocket: log streaming
app.get(
  "/ws/servers/:name/logs",
  upgradeWebSocket((c) => {
    const name = c.req.param("name");
    let controller: AbortController | null = null;

    return {
      onOpen(_event, ws) {
        const servers = getServers();
        if (!servers.find((s) => s.name === name)) {
          ws.send("Error: Server not found");
          ws.close();
          return;
        }

        controller = new AbortController();
        streamContainerLogs(
          name,
          (line) => {
            try {
              ws.send(line);
            } catch {}
          },
          controller.signal
        )
          .catch(() => {})
          .finally(() => {
            try {
              ws.close();
            } catch {}
          });
      },
      onClose() {
        controller?.abort();
      },
    };
  })
);

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
  websocket,
};
