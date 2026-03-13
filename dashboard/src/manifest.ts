import { readFileSync } from "fs";
import yaml from "js-yaml";
import path from "path";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const MANIFEST_PATH = path.join(REPO_ROOT, "manifest.yml");

interface ServerDef {
  type: string;
  version: string;
  mode: string;
  tier: string;
  mod_groups: string[];
  modrinth_mods: string[];
  jar_mods: string[];
  modrinth_version_type?: string;
  svc: boolean;
  seed: string | null;
  motd: string;
  memory: string;
  backup?: { interval: string; keep: number };
  pregen?: { radius: number };
  bluemap_port?: number;
  created: string;
}

interface Manifest {
  players: { ops: string[]; whitelist: string[] };
  mod_groups: Record<string, string[]>;
  servers: Record<string, ServerDef>;
}

export function readManifest(): Manifest {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  return yaml.load(raw) as Manifest;
}

export interface ServerInfo {
  name: string;
  type: string;
  version: string;
  mode: string;
  tier: string;
  memory: string;
  motd: string;
  seed: string | null;
  modGroups: string[];
  mods: string[];
  bluemapUrl: string | null;
  created: string;
}

export function getServers(): ServerInfo[] {
  const manifest = readManifest();
  return Object.entries(manifest.servers).map(([name, s]) => {
    // Resolve mod groups to individual mod lists
    const groupMods = (s.mod_groups || []).flatMap(
      (g) => manifest.mod_groups[g] || []
    );
    const allMods = [...new Set([...groupMods, ...s.modrinth_mods, ...s.jar_mods])];

    return {
      name,
      type: s.type,
      version: s.version,
      mode: s.mode,
      tier: s.tier,
      memory: s.memory,
      motd: s.motd,
      seed: s.seed,
      modGroups: s.mod_groups,
      mods: allMods,
      bluemapUrl: s.bluemap_port ? `https://map-${name}.mc.danny.is` : null,
      created: s.created,
    };
  });
}
