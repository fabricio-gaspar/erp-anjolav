import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/pdv-dialogs.css";
import "./styles/responsive-system.css";
import { bootstrapOfflineQueryCache } from "@/lib/offlineQueryCache";
import { queryClient } from "@/lib/queryClient";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

async function startApplication() {
  await bootstrapOfflineQueryCache(queryClient);
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApplication();
