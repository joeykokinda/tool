import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// outDir matches the Cloudflare Pages project ("tool"), which builds on push to master
export default defineConfig({ plugins: [react()], build: { outDir: "build" } });
