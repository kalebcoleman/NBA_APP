import fs from 'node:fs';
import path from 'node:path';

const ROOT_MARKERS = ['pnpm-workspace.yaml', 'AGENTS.md'];

export function findWorkspaceRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const hasMarker = ROOT_MARKERS.some((marker) => fs.existsSync(path.join(current, marker)));
    if (hasMarker) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
}

export const workspaceRoot = findWorkspaceRoot();
