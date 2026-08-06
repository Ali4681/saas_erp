import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Logo / CV uploads (UI allows up to 5MB)
      bodySizeLimit: "8mb",
    },
  },
};

export default withNextIntl(nextConfig);
