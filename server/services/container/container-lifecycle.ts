import { getDockerClient } from "./docker-client";
import type Docker from "dockerode";

export interface ContainerCreateOptions {
  imageName: string;
  containerName: string;
  portMappings: { containerPort: number; hostPort: number; protocol?: string }[];
  envVars: { key: string; value: string }[];
  memoryLimit?: number; // in MB
  cpuLimit?: number; // CPU shares (1024 = 1 CPU)
}

export interface ContainerStatus {
  id: string;
  name: string;
  state: string;
  status: string;
  startedAt?: string;
}

/**
 * Create a container with specified configuration
 */
export async function createContainer(options: ContainerCreateOptions): Promise<Docker.Container> {
  const docker = getDockerClient();

  // Build port bindings
  const exposedPorts: { [key: string]: {} } = {};
  const portBindings: Docker.PortMap = {};

  for (const mapping of options.portMappings) {
    const portKey = `${mapping.containerPort}/${mapping.protocol || "tcp"}`;
    exposedPorts[portKey] = {};
    portBindings[portKey] = [{ HostPort: mapping.hostPort.toString() }];
  }

  // Build environment variables
  const env = options.envVars.map((envVar) => `${envVar.key}=${envVar.value}`);

  // Create container
  const container = await docker.createContainer({
    name: options.containerName,
    Image: options.imageName,
    Env: env,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Memory: options.memoryLimit ? options.memoryLimit * 1024 * 1024 : undefined, // Convert MB to bytes
      CpuShares: options.cpuLimit,
      RestartPolicy: {
        Name: "unless-stopped",
      },
      NetworkMode: "bridge",
    },
  });

  console.log("Container created:", options.containerName);
  return container;
}

/**
 * Start a container
 */
export async function startContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.start();
  console.log("Container started:", containerId);
}

/**
 * Stop a container
 */
export async function stopContainer(containerId: string, timeout: number = 10): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.stop({ t: timeout });
  console.log("Container stopped:", containerId);
}

/**
 * Restart a container
 */
export async function restartContainer(containerId: string): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.restart();
  console.log("Container restarted:", containerId);
}

/**
 * Remove a container
 */
export async function removeContainer(containerId: string, force: boolean = false): Promise<void> {
  const docker = getDockerClient();
  const container = docker.getContainer(containerId);
  await container.remove({ force });
  console.log("Container removed:", containerId);
}

/**
 * Get container logs
 */
export async function getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });

    return logs.toString("utf-8");
  } catch (error) {
    console.error("Failed to get container logs:", error);
    throw error;
  }
}

/**
 * Get container status
 */
export async function getContainerStatus(containerId: string): Promise<ContainerStatus | null> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();

    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ""), // Remove leading slash
      state: info.State.Status,
      status: info.State.Running ? "running" : "stopped",
      startedAt: info.State.StartedAt,
    };
  } catch (error) {
    console.error("Failed to get container status:", error);
    return null;
  }
}

/**
 * Get container port mappings
 */
export async function getContainerPorts(containerId: string): Promise<{ containerPort: number; hostPort: number; protocol: string }[]> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();

    const ports: { containerPort: number; hostPort: number; protocol: string }[] = [];

    if (info.NetworkSettings.Ports) {
      for (const [key, bindings] of Object.entries(info.NetworkSettings.Ports)) {
        if (bindings && bindings.length > 0) {
          const [portStr, protocol] = key.split("/");
          const containerPort = parseInt(portStr);
          const hostPort = parseInt(bindings[0].HostPort);

          ports.push({
            containerPort,
            hostPort,
            protocol: protocol || "tcp",
          });
        }
      }
    }

    return ports;
  } catch (error) {
    console.error("Failed to get container ports:", error);
    return [];
  }
}

/**
 * Check container health
 */
export async function checkContainerHealth(containerId: string): Promise<{ healthy: boolean; status: string }> {
  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();

    const isRunning = info.State.Running;
    const health = info.State.Health?.Status || "none";

    return {
      healthy: isRunning && (health === "healthy" || health === "none"),
      status: isRunning ? (health || "running") : "stopped",
    };
  } catch (error) {
    console.error("Failed to check container health:", error);
    return { healthy: false, status: "unknown" };
  }
}

/**
 * Remove a Docker image from the local registry
 */
export async function removeImage(imageName: string, force: boolean = false): Promise<void> {
  try {
    const docker = getDockerClient();
    const image = docker.getImage(imageName);
    await image.remove({ force });
    console.log("Docker image removed:", imageName);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.warn(`Image ${imageName} not found, skipping removal`);
      return;
    }
    console.error("Failed to remove Docker image:", error);
    throw error;
  }
}

/**
 * Pull a Docker image from registry
 */
export async function pullImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const docker = getDockerClient();

    docker.pull(imageName, (err: any, stream: any) => {
      if (err) {
        console.error("Failed to pull Docker image:", err);
        return reject(err);
      }

      docker.modem.followProgress(stream, (err: any, output: any) => {
        if (err) {
          console.error("Failed during Docker image pull:", err);
          return reject(err);
        }
        console.log("Docker image pulled successfully:", imageName);
        resolve();
      });
    });
  });
}

/**
 * Find a Docker container by name
 * Returns the container ID if found, null if not found
 */
export async function findContainerByName(containerName: string): Promise<string | null> {
  try {
    const docker = getDockerClient();
    const containers = await docker.listContainers({ all: true });

    const found = containers.find(c =>
      c.Names?.some(name => name === `/${containerName}` || name === containerName)
    );

    return found ? found.Id : null;
  } catch (error) {
    console.error("Failed to find container by name:", error);
    return null;
  }
}
