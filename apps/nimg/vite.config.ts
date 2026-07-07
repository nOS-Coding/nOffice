import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  base: "/nimg/",
  server: { port: 5183, strictPort: true },
  build: { target: "esnext", minify: "esbuild" },
});
