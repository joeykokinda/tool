import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// outDir matches the Cloudflare Pages project ("tool"), which builds on push to master.
// yt/ is a second page so its script and styles get hashed names like the main app's.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "build", rollupOptions: { input: ["index.html", "yt/index.html"] } },
});
