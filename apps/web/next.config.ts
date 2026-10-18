import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // packages/shared ships TypeScript source, so Next compiles it.
  transpilePackages: ["@lulu/shared"],
};

export default withNextIntl(nextConfig);
