import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const now = new Date();
  const appBuildId = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${String(now.getUTCDate()).padStart(2, '0')}-${now.getTime().toString(36)}`;
  const appBuiltAt = now.toISOString();
  let resolvedOutDir = path.resolve(__dirname, 'dist');

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(appBuildId),
      __APP_BUILT_AT__: JSON.stringify(appBuiltAt),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'app-version-manifest',
        configResolved(config) {
          resolvedOutDir = path.resolve(__dirname, config.build.outDir || 'dist');
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const urlPath = (req.url || '').split('?')[0];
            if (urlPath === '/version.json' || urlPath === '/docs/version.json') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
              res.end(
                JSON.stringify({
                  version: appBuildId,
                  builtAt: appBuiltAt,
                })
              );
              return;
            }
            next();
          });
        },
        closeBundle(error?: Error): void {
          if (error) return;
          if (!fs.existsSync(resolvedOutDir)) {
            fs.mkdirSync(resolvedOutDir, {recursive: true});
          }
          fs.writeFileSync(
            path.join(resolvedOutDir, 'version.json'),
            JSON.stringify(
              {
                version: appBuildId,
                builtAt: appBuiltAt,
              },
              null,
              2
            ),
            'utf8'
          );
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
