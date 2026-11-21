// Entry point of this make.fun entry: copies app/ and screenshots/ into the output directory and
// writes dossier.json there with buildDossier, so the scorer sees exactly what it recomputes.
//
//   node main.ts            # MAKEFUN_OUTPUT_DIR unset => /output
//   MAKEFUN_OUTPUT_DIR=./out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier, DossierError } from './vendor/makefun-app.ts';

/** The directory holding this entry: app/, screenshots/ and vendor/ live beside it. */
const ENTRY_DIR = dirname(fileURLToPath(import.meta.url));

/** Where this entry's files go: MAKEFUN_OUTPUT_DIR when set, else /output. */
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The caps the bounty's gate.json gives buildDossier. Only text_max_bytes shapes the bytes. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

interface TreeCount {
  files: number;
  bytes: number;
}

/** Every file under `dir`, recursively, with the bytes they hold. */
function countTree(dir: string): TreeCount {
  const count: TreeCount = { files: 0, bytes: 0 };
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    count.files += 1;
    count.bytes += statSync(join(entry.parentPath, entry.name)).size;
  }
  return count;
}

/** Replace `<out>/<name>` with a copy of `<entry>/<name>`, refusing a missing source directory. */
function copyIntoOut(name: string): TreeCount {
  const from = resolve(ENTRY_DIR, name);
  if (!existsSync(from) || !statSync(from).isDirectory()) {
    throw new Error(`${name}/: no such directory beside main.ts (${from})`);
  }
  const to = join(OUT_DIR, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return countTree(to);
}

const app = copyIntoOut('app');
const screenshots = copyIntoOut('screenshots');

mkdirSync(OUT_DIR, { recursive: true });
let dossier: Uint8Array;
try {
  dossier = buildDossier(OUT_DIR, CAPS);
} catch (err) {
  if (err instanceof DossierError) {
    console.error(`main: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
const dossierPath = join(OUT_DIR, 'dossier.json');
writeFileSync(dossierPath, dossier);

const out = countTree(OUT_DIR);
console.log(`entry:       ${ENTRY_DIR}`);
console.log(`out:         ${OUT_DIR}`);
console.log(`app:         ${app.files} files, ${app.bytes} bytes`);
console.log(`screenshots: ${screenshots.files} files, ${screenshots.bytes} bytes`);
console.log(`dossier:     ${dossierPath}, ${dossier.byteLength} bytes`);
console.log(`out total:   ${out.files} files, ${out.bytes} bytes`);