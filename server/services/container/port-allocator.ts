import { getDockerClient } from "./docker-client";
import type Docker from "dockerode";

const PORT_RANGE_MIN = parseInt(process.env.CONTAINER_PORT_RANGE_MIN || "30000");
const PORT_RANGE_MAX = parseInt(process.env.CONTAINER_PORT_RANGE_MAX || "40000");

/**
 * Get all currently allocated ports from running containers
 */
async function getAllocatedPorts(): Promise<Set<number>> {
  const docker = getDockerClient();
  const containers = await docker.listContainers({ all: true });
  const allocatedPorts = new Set<number>();

  for (const container of containers) {
    if (container.Ports) {
      for (const port of container.Ports) {
        if (port.PublicPort) {
          allocatedPorts.add(port.PublicPort);
        }
      }
    }
  }

  return allocatedPorts;
}

/**
 * Allocate an available port from the configured range
 */
export async function allocatePort(): Promise<number> {
  const allocatedPorts = await getAllocatedPorts();

  // Find first available port in range
  for (let port = PORT_RANGE_MIN; port <= PORT_RANGE_MAX; port++) {
    if (!allocatedPorts.has(port)) {
      return port;
    }
  }

  throw new Error("No available ports in configured range");
}

/**
 * Allocate multiple ports
 */
export async function allocatePorts(count: number): Promise<number[]> {
  const allocatedPorts = await getAllocatedPorts();
  const ports: number[] = [];

  for (let port = PORT_RANGE_MIN; port <= PORT_RANGE_MAX && ports.length < count; port++) {
    if (!allocatedPorts.has(port)) {
      ports.push(port);
      allocatedPorts.add(port); // Mark as allocated for next iteration
    }
  }

  if (ports.length < count) {
    throw new Error(`Could not allocate ${count} ports. Only ${ports.length} available.`);
  }

  return ports;
}

/**
 * Check if a specific port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  if (port < PORT_RANGE_MIN || port > PORT_RANGE_MAX) {
    return false;
  }

  const allocatedPorts = await getAllocatedPorts();
  return !allocatedPorts.has(port);
}
