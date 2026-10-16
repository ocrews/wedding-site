// Bundles a Node service (api, worker) into dist/index.js.
// The app's own third-party `dependencies` stay external (installed via `pnpm deploy --prod`
// in Docker). Everything else — workspace packages (@wedding/*, shipped as TS source) and
// their transitive deps such as zod — is bundled in.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const entry = process.argv[2] ?? 'src/index.ts';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const external = new Set(
  Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@wedding/')),
);
const pkgName = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

await build({
  entryPoints: [entry],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-app-deps',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => {
          if (args.path.startsWith('node:')) return { path: args.path, external: true };
          return external.has(pkgName(args.path)) ? { path: args.path, external: true } : undefined;
        });
      },
    },
  ],
});
