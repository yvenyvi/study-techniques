import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  build: {
    rollupOptions: { input: { landing: "index.html", app: "app.html" } },
  },
  plugins: [
    {
      name: "study-room-routes",
      configureServer(server) {
        server.middlewares.use(appRoutes);
      },
      configurePreviewServer(server) {
        server.middlewares.use(appRoutes);
      },
    },
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Study Room — Psychology Workspace",
        short_name: "Study Room",
        theme_color: "#35594b",
        background_color: "#f7f6f1",
        display: "standalone",
        start_url: "/app/",
        scope: "/app/",
        id: "/app/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6000000,
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,woff2,bcmap,pfb,ttf}"],
        navigateFallback: "app.html",
        navigateFallbackAllowlist: [
          /^\/app(?:\/|$)/,
          /^\/(?:library|courses|study|reviewers|goals|settings)(?:\/|$)/,
        ],
      },
    }),
  ],
});

// Mirror Vercel rewrites in both local dev and production preview.
function appRoutes(req: { url?: string }, _res: unknown, next: () => void) {
  if (
    /^\/(?:app|library|courses|study|reviewers|goals|settings)(?:\/|\?|$)/.test(
      req.url || "",
    )
  ) {
    req.url = "/app.html";
  }
  next();
}
