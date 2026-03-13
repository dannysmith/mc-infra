const DOCKER_SOCK = "/var/run/docker.sock";

async function dockerFetch(path: string): Promise<Response> {
  return fetch(`http://localhost${path}`, { unix: DOCKER_SOCK } as any);
}

interface ContainerInfo {
  Names: string[];
  Image: string;
  State: string;
  Status: string;
}

interface ContainerInspect {
  State: {
    Status: string;
    StartedAt: string;
    Health?: { Status: string };
  };
}

interface ContainerStats {
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
  };
}

export interface ContainerStatus {
  state: string;
  health: string | null;
  startedAt: string | null;
  cpuPercent: number | null;
  memoryUsageMB: number | null;
  memoryLimitMB: number | null;
}

export async function getContainerStatuses(
  serverNames: string[]
): Promise<Record<string, ContainerStatus>> {
  // Get all containers in one call
  const listRes = await dockerFetch("/containers/json?all=true");
  const containers: ContainerInfo[] = await listRes.json();

  const containersByName = new Map<string, ContainerInfo>();
  for (const c of containers) {
    const name = c.Names[0]?.replace(/^\//, "");
    if (name) containersByName.set(name, c);
  }

  const result: Record<string, ContainerStatus> = {};

  await Promise.all(
    serverNames.map(async (name) => {
      const container = containersByName.get(name);
      if (!container) {
        result[name] = {
          state: "not_created",
          health: null,
          startedAt: null,
          cpuPercent: null,
          memoryUsageMB: null,
          memoryLimitMB: null,
        };
        return;
      }

      // Get inspect for health + startedAt
      const inspectRes = await dockerFetch(`/containers/${name}/json`);
      const inspect: ContainerInspect = await inspectRes.json();

      const status: ContainerStatus = {
        state: inspect.State.Status,
        health: inspect.State.Health?.Status ?? null,
        startedAt: inspect.State.Status === "running" ? inspect.State.StartedAt : null,
        cpuPercent: null,
        memoryUsageMB: null,
        memoryLimitMB: null,
      };

      // Only fetch stats for running containers
      if (inspect.State.Status === "running") {
        const statsRes = await dockerFetch(
          `/containers/${name}/stats?stream=false`
        );
        const stats: ContainerStats = await statsRes.json();

        const cpuDelta =
          stats.cpu_stats.cpu_usage.total_usage -
          stats.precpu_stats.cpu_usage.total_usage;
        const sysDelta =
          stats.cpu_stats.system_cpu_usage -
          stats.precpu_stats.system_cpu_usage;
        const ncpus = stats.cpu_stats.online_cpus ?? 1;

        status.cpuPercent =
          sysDelta > 0
            ? Math.round((cpuDelta / sysDelta) * ncpus * 1000) / 10
            : 0;
        status.memoryUsageMB =
          Math.round(stats.memory_stats.usage / 1024 / 1024);
        status.memoryLimitMB =
          Math.round(stats.memory_stats.limit / 1024 / 1024);
      }

      result[name] = status;
    })
  );

  return result;
}

export async function getContainerStatus(
  name: string
): Promise<ContainerStatus | null> {
  const result = await getContainerStatuses([name]);
  return result[name] ?? null;
}

export interface ServiceInfo {
  name: string;
  image: string;
  state: string;
  status: string;
}

export async function getAllContainers(): Promise<ServiceInfo[]> {
  const res = await dockerFetch("/containers/json?all=true");
  const containers: ContainerInfo[] = await res.json();
  return containers
    .map((c) => ({
      name: c.Names[0]?.replace(/^\//, "") ?? "unknown",
      image: c.Image.split(":")[0]!.split("/").pop()!,
      state: c.State,
      status: c.Status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
