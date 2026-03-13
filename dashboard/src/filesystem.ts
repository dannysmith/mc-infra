import { readdirSync, statSync } from "fs";
import path from "path";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

export interface DiskCategory {
  label: string;
  bytes: number;
}

export interface ServerDiskUsage {
  total: number;
  categories: DiskCategory[];
}

function dirSize(dirPath: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else if (entry.isFile()) {
        total += statSync(full).size;
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return total;
}

function fileSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function globFiles(dirPath: string, pattern: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.match(pattern)) {
        total += statSync(path.join(dirPath, entry.name)).size;
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return total;
}

function dimensionSize(worldPath: string, dimSubdir: string): number {
  const base = dimSubdir ? path.join(worldPath, dimSubdir) : worldPath;
  return (
    dirSize(path.join(base, "region")) +
    dirSize(path.join(base, "entities")) +
    dirSize(path.join(base, "poi"))
  );
}

export function getServerDiskUsage(serverName: string): ServerDiskUsage {
  const dataDir = path.join(REPO_ROOT, "servers", serverName, "data");
  const worldDir = path.join(dataDir, "world");

  const categories: DiskCategory[] = [];
  let accounted = 0;

  // Dimensions (region + entities + poi)
  const overworld = dimensionSize(worldDir, "");
  if (overworld > 0) {
    categories.push({ label: "Overworld", bytes: overworld });
    accounted += overworld;
  }

  const nether = dimensionSize(worldDir, "DIM-1");
  if (nether > 0) {
    categories.push({ label: "Nether", bytes: nether });
    accounted += nether;
  }

  const end = dimensionSize(worldDir, "DIM1");
  if (end > 0) {
    categories.push({ label: "End", bytes: end });
    accounted += end;
  }

  // DH LODs (DistantHorizons.sqlite files in each dimension's data/)
  const dhOverworld = fileSize(path.join(worldDir, "data", "DistantHorizons.sqlite"));
  const dhNether = fileSize(path.join(worldDir, "DIM-1", "data", "DistantHorizons.sqlite"));
  const dhEnd = fileSize(path.join(worldDir, "DIM1", "data", "DistantHorizons.sqlite"));
  const dhTotal = dhOverworld + dhNether + dhEnd;
  if (dhTotal > 0) {
    categories.push({ label: "DH LODs", bytes: dhTotal });
    accounted += dhTotal;
  }

  // BlueMap
  const bluemap = dirSize(path.join(dataDir, "bluemap"));
  if (bluemap > 0) {
    categories.push({ label: "BlueMap", bytes: bluemap });
    accounted += bluemap;
  }

  // Mods
  const mods = dirSize(path.join(dataDir, "mods"));
  if (mods > 0) {
    categories.push({ label: "Mods", bytes: mods });
    accounted += mods;
  }

  // Total
  const total = dirSize(dataDir);

  // Other (everything else)
  const other = total - accounted;
  if (other > 0) {
    categories.push({ label: "Other", bytes: other });
  }

  return { total, categories };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
