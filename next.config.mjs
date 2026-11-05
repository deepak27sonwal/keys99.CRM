// Static export so the app can be hosted on GitHub Pages.
// BASE_PATH is set by the Pages workflow (e.g. /keys99.CRM); empty for local dev.
const basePath = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
};
export default nextConfig;
