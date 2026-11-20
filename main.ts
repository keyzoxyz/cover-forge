// main.ts — package app/ + screenshots/ into the make.fun output directory
// and write dossier.json via the kit's buildDossier.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Runs on Node >= 22.6 with native type stripping (no build step, no deps).

import { buildDossier } from './vendor/makefun-app.ts';
import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Exactly the caps the task specifies — passed straight to buildDossier.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

async function walk(dir: string, base = dir): Promise<{ rel: string; abs: string; size: number }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: { rel: string; abs: string; size: number }[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(abs, base)));
    } else if (entry.isFile()) {
      const info = await stat(abs);
      files.push({ rel: abs.slice(base.length + 1), abs, size: info.size });
    }
  }
  return files;
}

async function copyDir(name: string): Promise<{ count: number; bytes: number }> {
  const from = join(ROOT, name);
  const to = join(outDir, name);
  await cp(from, to, { recursive: true });
  const files = await walk(to);
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`${name}/ -> ${to} (${files.length} files, ${bytes} bytes)`);
  return { count: files.length, bytes };
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });

  const app = await copyDir('app');
  const shots = await copyDir('screenshots');

  const dossier = buildDossier(ROOT, CAPS);
  // buildDossier hands back the dossier as bytes (Uint8Array/Buffer) or a string.
  const dossierText =
    typeof dossier === 'string'
      ? dossier
      : new TextDecoder('utf-8').decode(dossier as Uint8Array);
  const dossierPath = join(outDir, 'dossier.json');
  await writeFile(dossierPath, dossierText, 'utf8');

  const dossierBytes = Buffer.byteLength(dossierText, 'utf8');
  const listed = JSON.parse(dossierText);
  // The dossier's file inventory lives in the markdown digest ("### app/... (N lines, N bytes)").
  const sources = String(listed?.text || '')
    .split('\n')
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).split(' (')[0]);
  const images: string[] = Array.isArray(listed?.images)
    ? listed.images.map((img: { name: string }) => img.name)
    : [];

  console.log('');
  console.log(`app files:        ${app.count} (${app.bytes} bytes)`);
  console.log(`screenshots:      ${shots.count} (${shots.bytes} bytes)`);
  console.log(`dossier.json:     ${dossierBytes} bytes -> ${dossierPath}`);
  console.log(`dossier sources:  ${sources.length}`);
  sources.forEach((p) => console.log(`  - ${p}`));
  console.log(`dossier images:   ${images.length} (cover = ${listed?.cover}); ${images.join(', ')}`);

  console.log('');
  console.log('--- totals ---');
  console.log(
    `copied ${app.count + shots.count} files, ${app.bytes + shots.bytes} bytes; ` +
      `dossier ${(dossierBytes / 1024).toFixed(1)} KiB (cap 1536.0 KiB)`,
  );
}

main().catch((err) => {
  console.error(`main.ts failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});