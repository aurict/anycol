import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    "@anycol/auth",
    "@anycol/contracts",
    "@anycol/observability",
  ],
  experimental: { useTypeScriptCli: false },
};
export default config;
