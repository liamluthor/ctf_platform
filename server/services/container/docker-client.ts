import Docker from "dockerode";

let dockerInstance: Docker | null = null;

/**
 * Get or create Docker client instance
 */
export function getDockerClient(): Docker {
  if (!dockerInstance) {
    const socketPath = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
    dockerInstance = new Docker({ socketPath });
  }
  return dockerInstance;
}

/**
 * Check if Docker daemon is accessible
 */
export async function checkDockerHealth(): Promise<boolean> {
  try {
    const docker = getDockerClient();
    await docker.ping();
    return true;
  } catch (error) {
    console.error("Docker health check failed:", error);
    return false;
  }
}

/**
 * Get Docker daemon info
 */
export async function getDockerInfo(): Promise<any | null> {
  try {
    const docker = getDockerClient();
    return await docker.info();
  } catch (error) {
    console.error("Failed to get Docker info:", error);
    return null;
  }
}
