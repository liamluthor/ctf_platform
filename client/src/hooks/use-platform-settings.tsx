import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PlatformSettingsData } from "@shared/schema";

interface PlatformSettingsContextValue {
  settings: PlatformSettingsData | undefined;
  isLoading: boolean;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextValue | undefined>(undefined);

/**
 * Convert HSL string format to CSS custom properties
 * Input: "345 80% 35%" -> Output: Sets CSS variables
 */
function injectCSSVariables(primaryColorHSL: string) {
  const root = document.documentElement;

  // Parse HSL values
  const match = primaryColorHSL.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) {
    console.error("Invalid HSL format:", primaryColorHSL);
    return;
  }

  const [, h, s, l] = match;

  // Set primary color
  root.style.setProperty("--primary", `${h} ${s}% ${l}%`);

  // Calculate and set accent color (slightly lighter, more saturated)
  const accentL = Math.min(parseInt(l) + 10, 95);
  const accentS = Math.min(parseInt(s) + 5, 100);
  root.style.setProperty("--accent", `${h} ${accentS}% ${accentL}%`);

  // Calculate ring color (for focus states)
  root.style.setProperty("--ring", `${h} ${s}% ${l}%`);

  // Set hero gradient color with alpha for radial gradient backgrounds
  root.style.setProperty("--hero-gradient", `hsl(${h} ${s}% ${l}% / 0.15)`);
}

/**
 * Update favicon dynamically
 */
function updateFavicon(url: string | null) {
  const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;

  if (!link) {
    console.warn("Favicon link element not found");
    return;
  }

  if (url) {
    // Add cache-busting query parameter
    link.href = `${url}?v=${Date.now()}`;
  } else {
    // Reset to default
    link.href = "/favicon.svg";
  }
}

/**
 * Update document title and meta tags
 */
function updateMetaTags(name: string, tagline: string) {
  // Update page title
  document.title = `${name} - ${tagline}`;

  // Update Open Graph tags
  const ogTitle = document.querySelector("meta[property='og:title']") as HTMLMetaElement;
  if (ogTitle) {
    ogTitle.content = name;
  }

  const ogDescription = document.querySelector("meta[property='og:description']") as HTMLMetaElement;
  if (ogDescription) {
    ogDescription.content = tagline;
  }

  // Update Twitter tags
  const twitterTitle = document.querySelector("meta[name='twitter:title']") as HTMLMetaElement;
  if (twitterTitle) {
    twitterTitle.content = name;
  }

  const twitterDescription = document.querySelector("meta[name='twitter:description']") as HTMLMetaElement;
  if (twitterDescription) {
    twitterDescription.content = tagline;
  }

  // Update description meta tag
  const description = document.querySelector("meta[name='description']") as HTMLMetaElement;
  if (description) {
    description.content = tagline;
  }
}

export function PlatformSettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery<PlatformSettingsData>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend cache TTL
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Apply settings when they load or change
  useEffect(() => {
    if (settings) {
      // Inject CSS variables for theming
      injectCSSVariables(settings.primaryColor);

      // Update favicon
      updateFavicon(settings.faviconUrl);

      // Update meta tags
      updateMetaTags(settings.platformName, settings.platformTagline);
    }
  }, [settings]);

  return (
    <PlatformSettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

/**
 * Hook to access platform settings in components
 */
export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);

  if (context === undefined) {
    throw new Error("usePlatformSettings must be used within PlatformSettingsProvider");
  }

  return context;
}

/**
 * Utility: Convert hex color to HSL format
 * Example: "#8B1538" -> "345 80% 35%"
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Convert to 0-360, 0-100%, 0-100%
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Utility: Convert HSL format to hex color
 * Example: "345 80% 35%" -> "#8B1538"
 */
export function hslToHex(hsl: string): string {
  const match = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) {
    return "#000000";
  }

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
