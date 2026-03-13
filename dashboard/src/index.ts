import { Hono } from "hono";
import { getServers } from "./manifest";

const app = new Hono();

// API: server list from manifest
app.get("/api/servers", (c) => {
  try {
    const servers = getServers();
    return c.json(servers);
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
    h1 { margin-bottom: 1.5rem; font-size: 1.5rem; color: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.6rem 1rem; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:hover td { background: #161b22; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-permanent { background: #1f6feb33; color: #58a6ff; }
    .badge-semi-permanent { background: #f0883e33; color: #f0883e; }
    .badge-ephemeral { background: #8b949e33; color: #8b949e; }
    .mods { font-size: 0.8rem; color: #8b949e; max-width: 300px; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    #error { color: #f85149; margin: 1rem 0; }
    #loading { color: #8b949e; }
  </style>
</head>
<body>
  <h1>MC Dashboard</h1>
  <div id="loading">Loading servers...</div>
  <div id="error"></div>
  <table id="servers" style="display:none">
    <thead>
      <tr>
        <th>Name</th>
        <th>Tier</th>
        <th>Type</th>
        <th>Version</th>
        <th>Mode</th>
        <th>Memory</th>
        <th>MOTD</th>
        <th>Mods</th>
        <th>BlueMap</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody id="server-list"></tbody>
  </table>
  <script>
    fetch('/api/servers')
      .then(r => r.json())
      .then(servers => {
        document.getElementById('loading').style.display = 'none';
        const table = document.getElementById('servers');
        table.style.display = '';
        const tbody = document.getElementById('server-list');
        servers.forEach(s => {
          const tierClass = 'badge-' + s.tier.replace('_', '-');
          const row = document.createElement('tr');
          row.innerHTML =
            '<td><strong>' + s.name + '</strong></td>' +
            '<td><span class="badge ' + tierClass + '">' + s.tier + '</span></td>' +
            '<td>' + s.type + '</td>' +
            '<td>' + s.version + '</td>' +
            '<td>' + s.mode + '</td>' +
            '<td>' + s.memory + '</td>' +
            '<td>' + s.motd + '</td>' +
            '<td class="mods">' + s.mods.join(', ') + '</td>' +
            '<td>' + (s.bluemapUrl ? '<a href="' + s.bluemapUrl + '" target="_blank">Map</a>' : '—') + '</td>' +
            '<td>' + s.created + '</td>';
          tbody.appendChild(row);
        });
      })
      .catch(err => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').textContent = 'Failed to load: ' + err;
      });
  </script>
</body>
</html>`);
});

export default {
  port: 3100,
  fetch: app.fetch,
};
