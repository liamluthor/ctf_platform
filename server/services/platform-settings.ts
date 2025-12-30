import { db } from "../db";
import * as schema from "@shared/schema";
import type { PlatformSettingsData } from "@shared/schema";
import { eq } from "drizzle-orm";

interface CacheEntry {
  data: PlatformSettingsData;
  timestamp: number;
}

/**
 * Service for managing platform settings with in-memory caching
 */
export class PlatformSettingsService {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Get all platform settings as formatted data
   * Uses in-memory cache with 5-minute TTL
   */
  async getAll(): Promise<PlatformSettingsData> {
    // Check if cache is valid
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    // Fetch from database
    const settings = await db
      .select()
      .from(schema.platformSettings);

    // Convert array to key-value map
    const settingsMap = new Map<string, string>();
    for (const setting of settings) {
      settingsMap.set(setting.key, setting.value);
    }

    // Format as PlatformSettingsData
    const data: PlatformSettingsData = {
      platformName: settingsMap.get("platform_name") || "CTF Platform",
      platformTagline: settingsMap.get("platform_tagline") || "Test Your Cybersecurity Skills",
      primaryColor: settingsMap.get("primary_color") || "345 80% 35%",
      logoUrl: this.formatFileUrl(settingsMap.get("logo_filename")),
      faviconUrl: this.formatFileUrl(settingsMap.get("favicon_filename")),
      footerCopyright: settingsMap.get("footer_copyright") || `© ${new Date().getFullYear()} CTF Platform. All rights reserved.`,
    };

    // Update cache
    this.cache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  }

  /**
   * Update multiple settings atomically
   * Invalidates cache after update
   */
  async updateBulk(updates: Record<string, string>): Promise<void> {
    const now = new Date();

    // Update each setting in a transaction
    for (const [key, value] of Object.entries(updates)) {
      await db
        .update(schema.platformSettings)
        .set({ value, updatedAt: now })
        .where(eq(schema.platformSettings.key, key));
    }

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Update a single setting
   */
  async updateSetting(key: string, value: string): Promise<void> {
    const now = new Date();

    await db
      .update(schema.platformSettings)
      .set({ value, updatedAt: now })
      .where(eq(schema.platformSettings.key, key));

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Clear the in-memory cache
   * Should be called after any updates
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Convert filename to full URL, or null if empty
   */
  private formatFileUrl(filename: string | undefined): string | null {
    if (!filename || filename === "") {
      return null;
    }
    return `/api/uploads/${filename}`;
  }
}

// Export singleton instance
export const platformSettingsService = new PlatformSettingsService();
