import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

const E2E_SUPABASE_URL = "http://127.0.0.1:54321";
const E2E_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fixture-signature";
const DEFAULT_SUPABASE_URL = "https://uomhckyqghkcnctbdwvp.supabase.co";
// Esta chave é publicável e só é usada no browser; o isolamento permanece no RLS.
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_v3SkU_CqfAx5Rhy97GAdPw_j1ey1CQ-";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "anjolav-pwa-icon.svg"],
      manifest: {
        name: "AnjoLav ERP",
        short_name: "AnjoLav",
        description: "ERP e PDV da AnjoLav com continuidade operacional controlada.",
        lang: "pt-BR",
        start_url: "/pdv",
        scope: "/",
        display: "standalone",
        background_color: "#071c35",
        theme_color: "#123f73",
        orientation: "any",
        icons: [
          {
            src: "/anjolav-pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webp,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // O rótulo do ambiente de acesso não pode vir de um HTML antigo do cache offline.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && /^\/login(?:\/|$)/.test(url.pathname),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "anjolav-navigation-v2",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 40, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) =>
              ["script", "style"].includes(request.destination),
            handler: "NetworkFirst",
            options: {
              cacheName: "anjolav-code-v2",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) =>
              ["font", "image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "anjolav-media-v2",
              expiration: { maxEntries: 160, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("maplibre-gl")) return "maplibre";
          if (id.includes("leaflet")) return "maps";
          if (id.includes("recharts")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("date-fns")) return "dates";
          return undefined;
        },
      },
    },
  },
  define:
    mode === "e2e"
      ? {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(E2E_SUPABASE_URL),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(E2E_PUBLISHABLE_KEY),
        }
      : {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
          ),
        },
}));
