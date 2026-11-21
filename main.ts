// Entrypoint for this make.fun entry: stage app/ and screenshots/ into the output directory and
// write the dossier the scorer expects there.
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

interface Counts {
  files: number;
  bytes: number;
}

function countImages(dir: string): Counts {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const inner = countImages(path);
      files += inner.files;
      bytes += inner.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else if (entry.isFile()) {
      copyFileSync(src, dst);
    }
  }
}

mkdirSync(out, { recursive: true });

const appOut = join(out, 'app');
copyDir(join(here, 'app'), appOut);
const app = countImages(appOut);

const shotsOut = join(out, 'screenshots');
copyDir(join(here, 'screenshots'), shotsOut);
const shots = countImages(shotsOut);

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`app: ${app.files} files, ${app.bytes} bytes`);
console.log(`screenshots: ${shots.files} files, ${shots.bytes} bytes`);
console.log(`dossier.json: ${dossier.byteLength} bytes`);