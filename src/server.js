import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './config.js';
import { createHttpApp } from './http-app.js';
import { createModelScopeClient } from './modelscope-client.js';
import { createQuotaService } from './quota-service.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = createModelScopeClient({ token: process.env.MODELSCOPE_TOKEN });
const quotaService = createQuotaService({ probe: client.probe });
const server = createServer(createHttpApp({
  quotaService,
  publicDir: join(projectRoot, 'public'),
  logger: {
    info(entry) {
      console.info(JSON.stringify(entry));
    }
  }
}));

server.listen(PORT, '0.0.0.0', () => {
  console.info(`Qwen usage checker listening on port ${PORT}.`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
