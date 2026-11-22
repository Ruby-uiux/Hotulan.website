/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native SQLite driver: load from node_modules at runtime instead of bundling.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Migrations are read from disk on startup; include them in standalone/traced output.
  outputFileTracingIncludes: { "/**/*": ["./drizzle/**/*"] },
};

export default nextConfig;
