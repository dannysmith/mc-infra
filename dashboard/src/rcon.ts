const DOCKER_SOCK = "/var/run/docker.sock";

const ALLOWED_COMMANDS: Record<string, string[]> = {
  list: ["list"],
  bluemap: ["bluemap"],
  "dh-debug": ["dh", "debug"],
};

export function getAllowedCommands(): string[] {
  return Object.keys(ALLOWED_COMMANDS);
}

export async function executeRcon(
  serverName: string,
  commandId: string
): Promise<{ ok: boolean; output: string }> {
  const args = ALLOWED_COMMANDS[commandId];
  if (!args) {
    return { ok: false, output: `Unknown command: ${commandId}` };
  }

  const rconArgs = ["rcon-cli", ...args];

  try {
    // Create exec instance
    const createRes = await fetch(
      `http://localhost/containers/${serverName}/exec`,
      {
        unix: DOCKER_SOCK,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Cmd: rconArgs,
          AttachStdout: true,
          AttachStderr: true,
        }),
      } as any
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      return { ok: false, output: `Docker exec create failed: ${err}` };
    }

    const { Id: execId } = (await createRes.json()) as { Id: string };

    // Start exec and capture output
    const startRes = await fetch(
      `http://localhost/exec/${execId}/start`,
      {
        unix: DOCKER_SOCK,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Detach: false }),
      } as any
    );

    if (!startRes.ok) {
      const err = await startRes.text();
      return { ok: false, output: `Docker exec start failed: ${err}` };
    }

    // Docker exec multiplexes stdout/stderr with 8-byte headers per frame.
    // Each frame: [stream_type(1), 0, 0, 0, size(4 big-endian)] + payload.
    const raw = new Uint8Array(await startRes.arrayBuffer());
    let output = "";
    let offset = 0;
    while (offset + 8 <= raw.length) {
      const size =
        (raw[offset + 4]! << 24) |
        (raw[offset + 5]! << 16) |
        (raw[offset + 6]! << 8) |
        raw[offset + 7]!;
      offset += 8;
      if (offset + size <= raw.length) {
        output += new TextDecoder().decode(raw.slice(offset, offset + size));
      }
      offset += size;
    }

    // Strip Minecraft formatting codes (§x, \x1b[...m)
    const cleaned = output.replace(/§[0-9a-fk-or]|\x1b\[[0-9;]*m/g, "").trim();
    return { ok: true, output: cleaned };
  } catch (e) {
    return { ok: false, output: `Error: ${e}` };
  }
}
