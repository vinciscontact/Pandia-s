import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Change `site` to the real domain before going live (used for canonical URLs, sitemap and QR codes).
export default defineConfig({
  site: "https://hotelpandias.com",
  integrations: [sitemap({ filter: (page) => !page.includes("/tables") && !page.includes("/chef") })],
  build: { inlineStylesheets: "auto" },
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
});
