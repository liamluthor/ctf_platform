import { storage } from "../../storage";
import type { Container, InsertContainerDeployment } from "@shared/schema";
import * as imageManager from "./image-manager";
import * as containerLifecycle from "./container-lifecycle";
import * as portAllocator from "./port-allocator";
import { checkDockerHealth } from "./docker-client";

export interface DeploymentConfig {
  container: Container;
  instanceName: string;
  deployedBy: string;
}

export interface DeploymentResult {
  deploymentId: number;
  platformId: string;
  accessUrl: string;
  ports: { containerPort: number; hostPort: number }[];
}

/**
 * Deploy a container
 */
export async function deployContainer(config: DeploymentConfig): Promise<DeploymentResult> {
  const { container, instanceName, deployedBy } = config;

  // Check Docker health
  const isHealthy = await checkDockerHealth();
  if (!isHealthy) {
    throw new Error("Docker daemon is not accessible");
  }

  // Parse exposed ports from container configuration
  // Support both old format (array of numbers) and new format (array of objects with serviceName)
  const exposedPortsRaw = JSON.parse(container.exposedPorts || "[]");
  const exposedPorts = Array.isArray(exposedPortsRaw)
    ? exposedPortsRaw.map(p => typeof p === 'number' ? { containerPort: p, serviceName: undefined } : p)
    : [];

  if (exposedPorts.length === 0) {
    throw new Error("Container has no exposed ports configured");
  }

  // Allocate host ports
  const hostPorts = await portAllocator.allocatePorts(exposedPorts.length);
  const portMappings = exposedPorts.map((portConfig, idx) => ({
    containerPort: portConfig.containerPort,
    hostPort: hostPorts[idx],
    protocol: "tcp",
    serviceName: portConfig.serviceName || undefined,
  }));

  // Get environment variables
  const envVars = await storage.getEnvVars(container.id);
  const envVarMappings = envVars.map((env) => ({
    key: env.key,
    value: env.value,
  }));

  // Determine image name based on deployment type
  let imageName: string;

  if (container.deploymentType === "registry") {
    // Pull image from registry if not already present
    if (!container.imageName) {
      throw new Error("Registry deployment requires imageName");
    }

    // Use container-specific credentials, or fall back to default registry credentials from .env
    const username = container.registryUsername || process.env.DOCKER_REGISTRY_USERNAME;
    const password = container.registryPassword || process.env.DOCKER_REGISTRY_PASSWORD;
    const registryUrl = container.registryUrl || process.env.DOCKER_REGISTRY_URL;

    await imageManager.pullImage({
      registryUrl: registryUrl || undefined,
      imageName: container.imageName,
      imageTag: container.imageTag || "latest",
      username: username || undefined,
      password: password || undefined,
    });

    imageName = container.registryUrl
      ? `${container.registryUrl}/${container.imageName}:${container.imageTag || "latest"}`
      : `${container.imageName}:${container.imageTag || "latest"}`;
  } else if (container.deploymentType === "upload") {
    // Load image from tar file
    if (container.uploadPath) {
      await imageManager.loadImageFromTar(container.uploadPath);
      // After loading, extract image name from tar (for now use container name)
      imageName = container.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    } else {
      throw new Error("Upload deployment requires uploadPath");
    }
  } else {
    throw new Error(`Unknown deployment type: ${container.deploymentType}`);
  }

  // Create deployment record FIRST to get deployment ID
  const deploymentData: InsertContainerDeployment = {
    containerId: container.id,
    instanceName,
    platform: "docker",
    platformId: "", // Will update after container creation
    status: "starting",
    statusMessage: "Creating container",
    accessUrl: "", // Will update after container creation
    startedAt: new Date(),
    deployedBy,
  };

  const deployment = await storage.createDeployment(deploymentData);

  // Auto-inject BASE_PATH environment variable for web containers
  const basePathEnvVar = {
    key: "BASE_PATH",
    value: `/container/${deployment.id}`,
  };
  const allEnvVars = [...envVarMappings, basePathEnvVar];

  // Create container with BASE_PATH included
  const dockerContainer = await containerLifecycle.createContainer({
    imageName,
    containerName: instanceName,
    portMappings,
    envVars: allEnvVars,
    memoryLimit: container.memoryLimit || 512,
    cpuLimit: container.cpuLimit || 256,
  });

  // Start container
  await containerLifecycle.startContainer(dockerContainer.id);

  // Wait a bit for container to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Get container status
  const status = await containerLifecycle.getContainerStatus(dockerContainer.id);
  if (!status) {
    throw new Error("Failed to get container status after deployment");
  }

  // Build access URL (using first port)
  const baseUrl = process.env.BASE_URL || process.env.CONTAINER_ACCESS_BASE_URL || "http://localhost";
  const accessUrl = `${baseUrl}:${hostPorts[0]}`;

  // Update deployment record with Docker container ID and access URL
  await storage.updateDeployment(deployment.id, {
    platformId: dockerContainer.id,
    status: "running",
    statusMessage: "Deployment successful",
    accessUrl,
  });

  // Create port mapping records
  for (const mapping of portMappings) {
    await storage.addPortMapping({
      deploymentId: deployment.id,
      containerPort: mapping.containerPort,
      hostPort: mapping.hostPort,
      protocol: mapping.protocol,
      serviceName: mapping.serviceName,
    });
  }

  console.log(`Container deployed successfully: ${instanceName}`);

  return {
    deploymentId: deployment.id,
    platformId: dockerContainer.id,
    accessUrl,
    ports: portMappings.map((p) => ({ containerPort: p.containerPort, hostPort: p.hostPort })),
  };
}

/**
 * Stop a deployment
 */
export async function stopDeployment(deploymentId: number): Promise<void> {
  const deployment = await storage.getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  if (deployment.platform === "docker" && deployment.platformId) {
    await containerLifecycle.stopContainer(deployment.platformId);
    await storage.updateDeployment(deploymentId, {
      status: "stopped",
      stoppedAt: new Date(),
    });
  } else {
    throw new Error("Unsupported platform or missing platformId");
  }

  console.log(`Deployment stopped: ${deploymentId}`);
}

/**
 * Restart a deployment
 */
export async function restartDeployment(deploymentId: number): Promise<void> {
  const deployment = await storage.getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  if (deployment.platform === "docker" && deployment.platformId) {
    await containerLifecycle.restartContainer(deployment.platformId);
    await storage.updateDeployment(deploymentId, {
      status: "running",
      startedAt: new Date(),
    });
  } else {
    throw new Error("Unsupported platform or missing platformId");
  }

  console.log(`Deployment restarted: ${deploymentId}`);
}

/**
 * Remove a deployment
 */
export async function removeDeployment(deploymentId: number, force: boolean = false): Promise<void> {
  const deployment = await storage.getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  if (deployment.platform === "docker" && deployment.platformId) {
    // Stop first if running
    if (deployment.status === "running") {
      await containerLifecycle.stopContainer(deployment.platformId);
    }

    // Remove container
    await containerLifecycle.removeContainer(deployment.platformId, force);

    // Delete deployment record
    await storage.deleteDeployment(deploymentId);
  } else {
    throw new Error("Unsupported platform or missing platformId");
  }

  console.log(`Deployment removed: ${deploymentId}`);
}

/**
 * Get deployment logs
 */
export async function getDeploymentLogs(deploymentId: number, tail: number = 100): Promise<string> {
  const deployment = await storage.getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  if (deployment.platform === "docker" && deployment.platformId) {
    return await containerLifecycle.getContainerLogs(deployment.platformId, tail);
  } else {
    throw new Error("Unsupported platform or missing platformId");
  }
}

/**
 * Get deployment status
 */
export async function getDeploymentStatus(deploymentId: number): Promise<{
  status: string;
  healthy: boolean;
  message: string;
}> {
  const deployment = await storage.getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  if (deployment.platform === "docker" && deployment.platformId) {
    const health = await containerLifecycle.checkContainerHealth(deployment.platformId);
    return {
      status: deployment.status,
      healthy: health.healthy,
      message: health.status,
    };
  } else {
    return {
      status: deployment.status,
      healthy: false,
      message: "Unknown platform",
    };
  }
}
