import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const E2E_SUPABASE_URL = "http://127.0.0.1:54321";
const E2E_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fixture-signature";
const DEFAULT_SUPABASE_URL = "https://uomhckyqghkcnctbdwvp.supabase.co";
// Esta chave é publicável e só é usada no browser; o isolamento permanece no RLS.
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_v3SkU_CqfAx5Rhy97GAdPw_j1ey1CQ-";

const isLocalSupabaseUrl = (value: string | undefined) =>
  !value || /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(?:\/|$)/i.test(value);

const productionSupabaseUrl = isLocalSupabaseUrl(process.env.VITE_SUPABASE_URL?.trim())
  ? DEFAULT_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL!.trim();

const productionPublishableKey =
  !process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY.includes("fixture-signature")
    ? DEFAULT_SUPABASE_PUBLISHABLE_KEY
    : process.env.VITE_SUPABASE_PUBLISHABLE_KEY.trim();

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
      : {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            productionSupabaseUrl,
          ),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
            productionPublishableKey,
          ),
        },
}));
