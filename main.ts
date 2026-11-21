// The entrypoint of this make.fun entry: copies the app and its screenshots into the output
// directory and writes the dossier beside them with the vendored buildDossier, then reports
// the file and byte counts of everything it wrote.
//
//   node main.ts                      # out = /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Paths are resolved against this file's own directory, so the entry runs from any cwd.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DossierError, buildDossier, type DossierCaps } from './vendor/makefun-app.ts';

/** This entry's directory: app/, screenshots/ and vendor/ sit beside this file. */
const root = dirname(fileURLToPath(import.meta.url));

/** Where the entry is written: MAKEFUN_OUTPUT_DIR, else /output. */
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * The caps the scorer's gate.json holds (gta6-cover-art-01): only text_max_bytes shapes the
 * dossier's bytes, the rest only refuse what the gate refuses anyway. app_path_max_bytes is
 * the library's own default of 1000 bytes.
 */
const CAPS: DossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** How many files a tree holds and how many bytes their contents come to. */
interface Count {
  files: number;
  bytes: number;
}

/** Every file under `dir`, counted (directories cost no bytes). */
function measure(dir: string): Count {
  let files = 0;
  let bytes = 0;
  const stack: string[] = [''];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    for (const entry of readdirSync(rel === '' ? dir : join(dir, rel), { withFileTypes: true })) {
      const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile()) {
        files++;
        bytes += statSync(join(dir, path)).size;
      }
    }
  }
  return { files, bytes };
}

/** Copies `from` to `to`, replacing whatever `to` held, and returns the copy's count. */
function copy(from: string, to: string): Count {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return measure(to);
}

const line = (label: string, count: Count): string =>
  `${label}: ${count.files} file${count.files === 1 ? '' : 's'}, ${count.bytes} bytes`;

try {
  mkdirSync(out, { recursive: true });
  const app = copy(join(root, 'app'), join(out, 'app'));
  const screenshots = copy(join(root, 'screenshots'), join(out, 'screenshots'));

  // The dossier is built from the copied tree, exactly as the scorer builds it from what we hand in.
  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  const dossierCount: Count = { files: 1, bytes: dossier.length };

  console.log(line('app/', app));
  console.log(line('screenshots/', screenshots));
  console.log(line('dossier.json', dossierCount));
  console.log(line('total', {
    files: app.files + screenshots.files + dossierCount.files,
    bytes: app.bytes + screenshots.bytes + dossierCount.bytes,
  }));
  console.log(`wrote ${join(out, 'dossier.json')}`);
} catch (err) {
  if (err instanceof DossierError) {
    console.error(`main: ${err.message}${err.limit === null ? '' : ` (limit: ${err.limit})`}`);
    process.exitCode = 1;
  } else {
    throw err;
  }
}