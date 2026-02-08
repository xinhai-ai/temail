import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";
import defaultRuntimeCaching from "next-pwa/cache";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false,
  skipWaiting: true,
  reloadOnOnline: false,
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "GET",
    },
    ...defaultRuntimeCaching,
  ],
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(withPWA(nextConfig));
