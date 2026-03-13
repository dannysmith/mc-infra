import { Hono } from "hono";
import { getServers } from "./manifest";
import { getContainerStatuses } from "./docker";

const app = new Hono();

// API: server list from manifest + Docker status
app.get("/api/servers", async (c) => {
  try {
    const servers = getServers();
    const statuses = await getContainerStatuses(servers.map((s) => s.name));
    const combined = servers.map((s) => ({
      ...s,
      container: statuses[s.name] ?? null,
    }));
    return c.json(combined);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// HTML page
app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MC Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #e1e4e8; padding: 2rem; }
    h1 { margin-bottom: 0.5rem; font-size: 1.5rem; color: #fff; }
    .toolbar { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; }
    .toolbar .meta { color: #8b949e; font-size: 0.85rem; }
    button { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; padding: 0.35rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
    button:hover { background: #30363d; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.6rem 1rem; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:hover td { background: #161b22; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-permanent { background: #1f6feb33; color: #58a6ff; }
    .badge-semi-permanent { background: #f0883e33; color: #f0883e; }
    .badge-ephemeral { background: #8b949e33; color: #8b949e; }
    .status-running { color: #3fb950; }
    .status-exited { color: #8b949e; }
    .status-not_created { color: #484f58; }
    .health { font-size: 0.75rem; color: #8b949e; }
    .mods { font-size: 0.8rem; color: #8b949e; max-width: 250px; }
    .metric { font-variant-numeric: tabular-nums; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    #error { color: #f85149; margin: 1rem 0; }
    #loading { color: #8b949e; }
  </style>
</head>
<body>
  <h1>MC Dashboard</h1>
  <div class="toolbar">
    <button id="refresh" onclick="loadServers()">Refresh</button>
    <span class="meta" id="updated"></span>
  </div>
  <div id="loading">Loading servers...</div>
  <div id="error"></div>
  <table id="servers" style="display:none">
    <thead>
      <tr>
        <th>Name</th>
        <th>Status</th>
        <th>Tier</th>
        <th>CPU</th>
        <th>RAM</th>
        <th>Uptime</th>
        <th>Mode</th>
        <th>Memory</th>
        <th>Mods</th>
        <th>BlueMap</th>
      </tr>
    </thead>
    <tbody id="server-list"></tbody>
  </table>
  <script>
    function formatUptime(startedAt) {
      if (!startedAt) return '';
      var ms = Date.now() - new Date(startedAt).getTime();
      var s = Math.floor(ms / 1000);
      if (s < 60) return s + 's';
      var m = Math.floor(s / 60);
      if (m < 60) return m + 'm';
      var h = Math.floor(m / 60);
      if (h < 24) return h + 'h ' + (m % 60) + 'm';
      var d = Math.floor(h / 24);
      return d + 'd ' + (h % 24) + 'h';
    }

    function statusHtml(c) {
      if (!c) return '<span class="status-not_created">not created</span>';
      var label = c.state;
      if (c.health) label += ' (' + c.health + ')';
      return '<span class="status-' + c.state + '">' + label + '</span>';
    }

    function loadServers() {
      document.getElementById('loading').style.display = '';
      document.getElementById('error').textContent = '';
      fetch('/api/servers')
        .then(function(r) { return r.json(); })
        .then(function(servers) {
          document.getElementById('loading').style.display = 'none';
          var table = document.getElementById('servers');
          table.style.display = '';
          var tbody = document.getElementById('server-list');
          tbody.innerHTML = '';
          document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
          servers.forEach(function(s) {
            var c = s.container;
            var tierClass = 'badge-' + s.tier.replace('_', '-');
            var row = document.createElement('tr');
            row.innerHTML =
              '<td><strong>' + s.name + '</strong></td>' +
              '<td>' + statusHtml(c) + '</td>' +
              '<td><span class="badge ' + tierClass + '">' + s.tier + '</span></td>' +
              '<td class="metric">' + (c && c.cpuPercent != null ? c.cpuPercent + '%' : '') + '</td>' +
              '<td class="metric">' + (c && c.memoryUsageMB != null ? c.memoryUsageMB + ' / ' + c.memoryLimitMB + ' MB' : '') + '</td>' +
              '<td>' + (c ? formatUptime(c.startedAt) : '') + '</td>' +
              '<td>' + s.mode + '</td>' +
              '<td>' + s.memory + '</td>' +
              '<td class="mods">' + s.mods.join(', ') + '</td>' +
              '<td>' + (s.bluemapUrl ? '<a href="' + s.bluemapUrl + '" target="_blank">Map</a>' : '') + '</td>';
            tbody.appendChild(row);
          });
        })
        .catch(function(err) {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('error').textContent = 'Failed to load: ' + err;
        });
    }

    loadServers();
  </script>
</body>
</html>`);
});

export default {
  port: 3100,
  fetch: app.fetch,
};
