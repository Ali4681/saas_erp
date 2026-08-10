import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Avoid wrong monorepo root when a parent package-lock.json exists (Plesk/vhosts).
  outputFileTracingRoot: path.join(__dirname),
  // Lint locally / in CI; don't block production `next build` on the server.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep typechecking on; only skip if the host OOMs during build.
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      // Logo / CV uploads (UI allows up to 5MB)
      bodySizeLimit: "8mb",
    },
  },
};

export default withNextIntl(nextConfig);
