import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, '../../..'),
  transpilePackages: ['@teamsuzie/ui', '@teamsuzie/approvals', '@teamsuzie/skills', '@teamsuzie/agent-loop'],
};

export default nextConfig;
