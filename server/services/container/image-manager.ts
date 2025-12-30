import { getDockerClient } from "./docker-client";
import type Docker from "dockerode";
import fs from "fs";
import { createReadStream } from "fs";
import path from "path";

export interface PullImageOptions {
  registryUrl?: string;
  imageName: string;
  imageTag?: string;
  username?: string;
  password?: string;
}

export interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: number;
}

/**
 * Pull an image from a registry
 */
export async function pullImage(options: PullImageOptions): Promise<void> {
  const docker = getDockerClient();
  const { registryUrl, imageName, imageTag = "latest", username, password } = options;

  // Construct full image name
  const fullImageName = registryUrl
    ? `${registryUrl}/${imageName}:${imageTag}`
    : `${imageName}:${imageTag}`;

  // Check if image already exists locally
  try {
    // Docker API requires URL encoding for image names
    const encodedImageName = encodeURIComponent(fullImageName);
    const image = docker.getImage(encodedImageName);
    await image.inspect();
    console.log("Image already exists locally:", fullImageName);
    return; // Image exists, no need to pull
  } catch (error) {
    // Image doesn't exist, proceed with pull
    console.log("Image not found locally, pulling:", fullImageName);
  }

  // Auth configuration if credentials provided
  const authconfig = username && password
    ? {
        username,
        password,
        serveraddress: registryUrl || "https://index.docker.io/v1/",
      }
    : undefined;

  return new Promise((resolve, reject) => {
    docker.pull(fullImageName, { authconfig }, (err, stream) => {
      if (err) {
        return reject(err);
      }

      if (!stream) {
        return reject(new Error("No stream returned from pull"));
      }

      // Follow the pull progress
      docker.modem.followProgress(
        stream,
        (err, output) => {
          if (err) {
            return reject(err);
          }
          console.log("Image pulled successfully:", fullImageName);
          resolve();
        },
        (event) => {
          // Progress event - can be logged or sent to clients
          if (event.status) {
            console.log(`Pull progress: ${event.status} ${event.progress || ""}`);
          }
        }
      );
    });
  });
}

/**
 * Load an image from a tar file
 */
export async function loadImageFromTar(tarPath: string): Promise<void> {
  const docker = getDockerClient();

  if (!fs.existsSync(tarPath)) {
    throw new Error(`Tar file not found: ${tarPath}`);
  }

  const tarStream = createReadStream(tarPath);

  return new Promise((resolve, reject) => {
    docker.loadImage(tarStream, (err, stream) => {
      if (err) {
        return reject(err);
      }

      if (!stream) {
        return reject(new Error("No stream returned from loadImage"));
      }

      // Follow the load progress
      docker.modem.followProgress(
        stream,
        (err, output) => {
          if (err) {
            return reject(err);
          }
          console.log("Image loaded successfully from tar:", tarPath);
          resolve();
        },
        (event) => {
          if (event.status) {
            console.log(`Load progress: ${event.status}`);
          }
        }
      );
    });
  });
}

/**
 * Validate that a tar file is a valid Docker image
 */
export async function validateTarFile(tarPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(tarPath)) {
      return false;
    }

    const stats = fs.statSync(tarPath);

    // Basic size check (must be > 0 and < 2GB)
    if (stats.size === 0 || stats.size > 2 * 1024 * 1024 * 1024) {
      return false;
    }

    // Check file extension
    const ext = path.extname(tarPath).toLowerCase();
    if (ext !== ".tar" && ext !== ".gz") {
      return false;
    }

    // TODO: More sophisticated validation (check for manifest.json inside tar)
    return true;
  } catch (error) {
    console.error("Error validating tar file:", error);
    return false;
  }
}

/**
 * Inspect an image to get metadata
 */
export async function inspectImage(imageName: string): Promise<Docker.ImageInspectInfo | null> {
  try {
    const docker = getDockerClient();
    const image = docker.getImage(imageName);
    return await image.inspect();
  } catch (error) {
    console.error("Failed to inspect image:", error);
    return null;
  }
}

/**
 * List all images
 */
export async function listImages(): Promise<ImageInfo[]> {
  try {
    const docker = getDockerClient();
    const images = await docker.listImages();

    return images.map((img) => ({
      id: img.Id,
      tags: img.RepoTags || [],
      size: img.Size,
      created: img.Created,
    }));
  } catch (error) {
    console.error("Failed to list images:", error);
    return [];
  }
}

/**
 * Remove an image
 */
export async function removeImage(imageName: string): Promise<void> {
  try {
    const docker = getDockerClient();
    const image = docker.getImage(imageName);
    await image.remove({ force: true });
    console.log("Image removed:", imageName);
  } catch (error) {
    console.error("Failed to remove image:", error);
    throw error;
  }
}
