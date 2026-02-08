/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" bundles Node.js server + dependencies into .next/standalone
  // for Docker / Azure App Service deployment. Remove if using Static Web Apps.
  output: "standalone",
};

module.exports = nextConfig;
