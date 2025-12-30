import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Initialize platform settings with defaults from environment variables
 * or hardcoded defaults if env vars are not set.
 */
export async function initializePlatformSettings() {
  console.log("Checking platform settings initialization...");

  // Check if settings already exist
  const existingSettings = await db
    .select()
    .from(schema.platformSettings)
    .limit(1);

  if (existingSettings.length > 0) {
    console.log("Platform settings already initialized");
    return;
  }

  console.log("Initializing platform settings with defaults...");

  const defaultSettings = [
    {
      key: "platform_name",
      value: process.env.PLATFORM_NAME || "CTF Platform",
      valueType: "string",
      category: "branding",
    },
    {
      key: "platform_tagline",
      value: process.env.PLATFORM_TAGLINE || "Test Your Cybersecurity Skills",
      valueType: "string",
      category: "branding",
    },
    {
      key: "primary_color",
      value: process.env.PRIMARY_COLOR || "345 80% 35%",
      valueType: "string",
      category: "appearance",
    },
    {
      key: "logo_filename",
      value: "",
      valueType: "string",
      category: "branding",
    },
    {
      key: "favicon_filename",
      value: "",
      valueType: "string",
      category: "branding",
    },
    {
      key: "footer_copyright",
      value: `© ${new Date().getFullYear()} ${process.env.PLATFORM_NAME || "CTF Platform"}. All rights reserved.`,
      valueType: "string",
      category: "branding",
    },
  ];

  await db.insert(schema.platformSettings).values(defaultSettings);

  console.log("Platform settings initialized successfully");
}
