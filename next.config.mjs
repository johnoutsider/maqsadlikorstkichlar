/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development output separate from production builds. Running
  // `next build` while `next dev` is active must not overwrite dev chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
