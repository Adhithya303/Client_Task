import type { Plugin, ResolvedConfig } from 'vite';
import { build as viteBuild } from 'vite';
import path from 'node:path';

export function firebaseSwPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;

  async function bundleServiceWorker(write: boolean, outDir?: string) {
    const entryFile = path.resolve(resolvedConfig.root, 'src/service-worker/firebase-messaging-sw.ts');

    const result = await viteBuild({
      root: resolvedConfig.root,
      configFile: false,
      logLevel: 'error',
      define: {
        'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_API_KEY ?? ''),
        'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
        'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_PROJECT_ID ?? ''),
        'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_STORAGE_BUCKET ?? ''),
        'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
        'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(resolvedConfig.env.VITE_FIREBASE_APP_ID ?? ''),
      },
      build: {
        write,
        outDir: outDir ?? 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: entryFile,
          output: {
            format: 'iife',
            entryFileNames: 'firebase-messaging-sw.js',
          },
        },
      },
    });

    if (!write && 'output' in result && Array.isArray(result.output)) {
      const chunk = result.output.find((o) => o.fileName.includes('firebase-messaging-sw'));
      return chunk && 'code' in chunk ? chunk.code : '';
    }

    return '';
  }

  return {
    name: 'firebase-sw-plugin',
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url === '/firebase-messaging-sw.js') {
          try {
            const code = await bundleServiceWorker(false);
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Service-Worker-Allowed', '/');
            res.end(code);
            return;
          } catch (err) {
            console.error('[firebase-sw-plugin] Failed to serve service worker:', err);
            res.statusCode = 500;
            res.end('/* Error bundling firebase-messaging-sw.js */');
            return;
          }
        }
        next();
      });
    },
    async closeBundle() {
      // During production build, output firebase-messaging-sw.js directly to dist
      if (resolvedConfig.command === 'build') {
        const outDir = path.resolve(resolvedConfig.root, resolvedConfig.build.outDir);
        await bundleServiceWorker(true, outDir);
      }
    },
  };
}
