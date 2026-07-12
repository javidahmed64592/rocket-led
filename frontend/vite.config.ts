import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../static",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/login": "http://localhost:8000",
      "/logout": "http://localhost:8000",
      "/protected": "http://localhost:8000",
    },
  },
});
