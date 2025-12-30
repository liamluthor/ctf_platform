import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'react-query': ['@tanstack/react-query'],
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-switch',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'ui-components': [
            'framer-motion',
            'lucide-react',
            'date-fns',
          ],
          'forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
          ],
          'charts': [
            'recharts',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
