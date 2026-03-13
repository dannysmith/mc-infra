import { readFileSync, readdirSync } from "fs";
import path from "path";
import * as nbt from "prismarine-nbt";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

// --- Types ---

export interface WorldInfo {
  levelName: string;
  version: string;
  seed: string;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  dayTime: number;
  gameType: number;
  difficulty: number;
  hardcore: boolean;
  raining: boolean;
  thundering: boolean;
  gamerules: Record<string, string>;
}

export interface PlayerData {
  uuid: string;
  name: string;
  // From playerdata .dat (NBT)
  posX: number;
  posY: number;
  posZ: number;
  dimension: string;
  gameMode: number;
  health: number;
  xpLevel: number;
  // From stats .json
  stats: PlayerStats | null;
  // From advancements .json
  advancementCount: number;
}

export interface PlayerStats {
  playTimeTicks: number;
  deaths: number;
  mobKills: number;
  blocksMined: number;
  distanceWalkedCm: number;
  distanceFlownCm: number;
  jumps: number;
}

// --- Helpers ---

function readUsercache(serverName: string): Record<string, string> {
  const filePath = path.join(
    REPO_ROOT,
    "servers",
    serverName,
    "data",
    "usercache.json"
  );
  try {
    const raw = readFileSync(filePath, "utf-8");
    const entries = JSON.parse(raw) as { uuid: string; name: string }[];
    const map: Record<string, string> = {};
    for (const e of entries) {
      map[e.uuid] = e.name;
    }
    return map;
  } catch {
    return {};
  }
}

function parseDimension(raw: string): string {
  // e.g. "minecraft:overworld" → "Overworld"
  const name = raw.replace("minecraft:", "");
  if (name === "the_nether") return "Nether";
  if (name === "the_end") return "The End";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const GAME_MODES: Record<number, string> = {
  0: "Survival",
  1: "Creative",
  2: "Adventure",
  3: "Spectator",
};

const DIFFICULTIES: Record<number, string> = {
  0: "Peaceful",
  1: "Easy",
  2: "Normal",
  3: "Hard",
};

export function gameModeName(mode: number): string {
  return GAME_MODES[mode] ?? `Unknown (${mode})`;
}

export function difficultyName(diff: number): string {
  return DIFFICULTIES[diff] ?? `Unknown (${diff})`;
}

/** Convert ticks (20/sec) to a human-readable duration */
export function formatPlayTime(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 20);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Convert distance in cm to readable string */
export function formatDistance(cm: number): string {
  const blocks = Math.floor(cm / 100);
  if (blocks >= 1000) return `${(blocks / 1000).toFixed(1)}km`;
  return `${blocks}m`;
}

/** Convert day time ticks (0-24000) to in-game time string */
export function formatDayTime(ticks: number): string {
  // MC day starts at 6:00 AM (tick 0), noon at 6000, sunset ~12000, midnight 18000
  const dayTicks = ((ticks % 24000) + 24000) % 24000;
  const hours = Math.floor((dayTicks / 1000 + 6) % 24);
  const minutes = Math.floor(((dayTicks % 1000) / 1000) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// --- Data fetching ---

export async function getWorldInfo(
  serverName: string
): Promise<WorldInfo | null> {
  const levelDatPath = path.join(
    REPO_ROOT,
    "servers",
    serverName,
    "data",
    "world",
    "level.dat"
  );
  try {
    const buf = readFileSync(levelDatPath);
    const { parsed } = await nbt.parse(Buffer.from(buf));
    const data = nbt.simplify(parsed);
    const d = data.Data;

    // Seed can be a [high, low] int pair (64-bit long) or a single number
    const rawSeed = d.WorldGenSettings?.seed;
    let seed: string;
    if (Array.isArray(rawSeed)) {
      // Combine two 32-bit ints into a 64-bit BigInt
      const high = BigInt(rawSeed[0]) & 0xFFFFFFFFn;
      const low = BigInt(rawSeed[1]) & 0xFFFFFFFFn;
      seed = ((high << 32n) | low).toString();
    } else {
      seed = String(rawSeed ?? "unknown");
    }

    // Spawn can be {pos: [x, y, z]} or SpawnX/SpawnY/SpawnZ
    const spawn = d.spawn?.pos ?? [d.SpawnX ?? 0, d.SpawnY ?? 0, d.SpawnZ ?? 0];

    // Gamerules: field is "game_rules" with minecraft: prefixed keys and numeric values
    const rawRules = d.game_rules ?? d.GameRules ?? {};
    const gamerules: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawRules)) {
      const cleanKey = (key as string).replace("minecraft:", "");
      gamerules[cleanKey] = String(val);
    }

    return {
      levelName: d.LevelName ?? "",
      version: d.Version?.Name ?? "unknown",
      seed,
      spawnX: spawn[0] ?? 0,
      spawnY: spawn[1] ?? 0,
      spawnZ: spawn[2] ?? 0,
      dayTime: Number(d.DayTime ?? 0),
      gameType: d.GameType ?? 0,
      difficulty: d.Difficulty ?? 0,
      hardcore: Boolean(d.hardcore ?? false),
      raining: Boolean(d.raining ?? false),
      thundering: Boolean(d.thundering ?? false),
      gamerules,
    };
  } catch {
    return null;
  }
}

export async function getPlayerData(
  serverName: string
): Promise<PlayerData[]> {
  const worldDir = path.join(
    REPO_ROOT,
    "servers",
    serverName,
    "data",
    "world"
  );
  const playerDataDir = path.join(worldDir, "playerdata");
  const statsDir = path.join(worldDir, "stats");
  const advancementsDir = path.join(worldDir, "advancements");

  const usercache = readUsercache(serverName);

  let datFiles: string[];
  try {
    datFiles = readdirSync(playerDataDir).filter(
      (f) => f.endsWith(".dat") && !f.endsWith("_old.dat")
    );
  } catch {
    return [];
  }

  const players: PlayerData[] = [];

  for (const datFile of datFiles) {
    const uuid = datFile.replace(".dat", "");
    const name = usercache[uuid] ?? uuid.slice(0, 8);

    try {
      // Parse playerdata NBT
      const buf = readFileSync(path.join(playerDataDir, datFile));
      const { parsed } = await nbt.parse(Buffer.from(buf));
      const pd = nbt.simplify(parsed);

      const pos = pd.Pos ?? [0, 0, 0];
      const dimension =
        typeof pd.Dimension === "string" ? pd.Dimension : "minecraft:overworld";

      // Read stats JSON
      let stats: PlayerStats | null = null;
      try {
        const statsRaw = readFileSync(
          path.join(statsDir, `${uuid}.json`),
          "utf-8"
        );
        const statsJson = JSON.parse(statsRaw);
        const custom = statsJson.stats?.["minecraft:custom"] ?? {};
        const mined = statsJson.stats?.["minecraft:mined"] ?? {};

        stats = {
          playTimeTicks: custom["minecraft:play_time"] ?? 0,
          deaths: custom["minecraft:deaths"] ?? 0,
          mobKills: custom["minecraft:mob_kills"] ?? 0,
          blocksMined: Object.values(mined).reduce(
            (a: number, b) => a + (b as number),
            0
          ),
          distanceWalkedCm:
            (custom["minecraft:walk_one_cm"] ?? 0) +
            (custom["minecraft:sprint_one_cm"] ?? 0),
          distanceFlownCm: custom["minecraft:fly_one_cm"] ?? 0,
          jumps: custom["minecraft:jump"] ?? 0,
        };
      } catch {
        // No stats file
      }

      // Read advancements JSON — count non-recipe advancements that are done
      let advancementCount = 0;
      try {
        const advRaw = readFileSync(
          path.join(advancementsDir, `${uuid}.json`),
          "utf-8"
        );
        const advJson = JSON.parse(advRaw);
        for (const [key, val] of Object.entries(advJson)) {
          if (
            !key.startsWith("minecraft:recipes/") &&
            typeof val === "object" &&
            val !== null &&
            (val as any).done === true
          ) {
            advancementCount++;
          }
        }
      } catch {
        // No advancements file
      }

      players.push({
        uuid,
        name,
        posX: Math.floor(pos[0]),
        posY: Math.floor(pos[1]),
        posZ: Math.floor(pos[2]),
        dimension: parseDimension(dimension),
        gameMode: pd.playerGameType ?? 0,
        health: Math.floor(pd.Health ?? 0),
        xpLevel: pd.XpLevel ?? 0,
        stats,
        advancementCount,
      });
    } catch {
      // Skip unreadable player data
    }
  }

  return players;
}
