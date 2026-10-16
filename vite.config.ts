import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const E2E_SUPABASE_URL = "http://127.0.0.1:54321";
const E2E_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fixture-signature";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
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
      : undefined,
}));
