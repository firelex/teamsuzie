import 'reflect-metadata';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`[FATAL] Failed to load .env from ${envPath}:`, result.error.message);
} else {
  console.log(`[INFO] Loaded .env from ${envPath}`);
}

await import('./index.js');
