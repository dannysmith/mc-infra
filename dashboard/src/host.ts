import { readFileSync } from "fs";
import { statfsSync } from "fs";

export interface HostMetrics {
  load: { one: number; five: number; fifteen: number };
  cpu: { cores: number };
  memory: { totalMB: number; usedMB: number; availableMB: number };
  disk: { totalGB: number; usedGB: number; availableGB: number; usedPercent: number };
}

export function getHostMetrics(): HostMetrics {
  // CPU load
  const loadavg = readFileSync("/proc/loadavg", "utf-8").trim().split(" ");
  const load = {
    one: parseFloat(loadavg[0]!),
    five: parseFloat(loadavg[1]!),
    fifteen: parseFloat(loadavg[2]!),
  };

  // CPU cores
  const cpuinfo = readFileSync("/proc/cpuinfo", "utf-8");
  const cores = (cpuinfo.match(/^processor\s/gm) || []).length;

  // Memory
  const meminfo = readFileSync("/proc/meminfo", "utf-8");
  const memLine = (key: string): number => {
    const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return match ? parseInt(match[1]!, 10) : 0;
  };
  const totalKB = memLine("MemTotal");
  const availableKB = memLine("MemAvailable");
  const memory = {
    totalMB: Math.round(totalKB / 1024),
    usedMB: Math.round((totalKB - availableKB) / 1024),
    availableMB: Math.round(availableKB / 1024),
  };

  // Disk
  const stat = statfsSync("/");
  const totalBytes = stat.blocks * stat.bsize;
  const freeBytes = stat.bavail * stat.bsize;
  const usedBytes = totalBytes - freeBytes;
  const disk = {
    totalGB: Math.round((totalBytes / 1073741824) * 10) / 10,
    usedGB: Math.round((usedBytes / 1073741824) * 10) / 10,
    availableGB: Math.round((freeBytes / 1073741824) * 10) / 10,
    usedPercent: Math.round((usedBytes / totalBytes) * 100),
  };

  return { load, cpu: { cores }, memory, disk };
}
