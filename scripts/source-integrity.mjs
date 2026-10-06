import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function sourceFingerprint(root, additionalFiles = []) {
  async function files(directory) {
    const entries = await readdir(resolve(root, directory), { withFileTypes: true });
    const groups = await Promise.all(entries.map(entry => {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error('Source fingerprints do not follow symlinks.');
      return entry.isDirectory() ? files(path) : [path];
    }));
    return groups.flat();
  }
  const hash = createHash('sha256');
  const paths = [...await files('src'), 'package.json', ...additionalFiles].sort();
  for (const path of paths) {
    hash.update(path + '\0');
    hash.update(createHash('sha256').update(await readFile(resolve(root, path))).digest());
  }
  return hash.digest('hex');
}

export async function fileHash(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}
