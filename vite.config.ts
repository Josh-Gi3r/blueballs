import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 5280 chosen to avoid Josh's live ports (3456 Louis, 5200, 8000/8200, 4173 savills, 5173/74 ATLAS).
export default defineConfig({
  plugins: [react()],
  server: { port: 5280, strictPort: true },
  preview: { port: 5280, strictPort: true },
});
