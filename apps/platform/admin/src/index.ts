import { createApp } from './app.js';
import { config } from './config.js';

async function main() {
  const { server } = await createApp();

  server.listen(config.port, () => {
    console.log(`Admin listening on ${config.publicUrl}`);
    console.log(`  agents configured: ${config.agents.length}`);
    if (config.nodeEnv === 'development') {
      console.log(`  open http://localhost:5175 and sign in with the demo creds shown on the login page`);
    }
  });
}

void main();
