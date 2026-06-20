/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const allowedFiles = new Set(['components/common/InkTag.tsx']);

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

function toRelativeSourcePath(filePath: string): string {
  return path.relative(sourceRoot, filePath).split(path.sep).join('/');
}

describe('ink tag usage', () => {
  it('keeps business UI off antd Tag', () => {
    const offenders = listSourceFiles(sourceRoot).flatMap((filePath) => {
      const relativePath = toRelativeSourcePath(filePath);
      if (allowedFiles.has(relativePath)) return [];

      const source = fs.readFileSync(filePath, 'utf8');
      const importsAntdTag = /import\s+\{[^}]*\bTag\b[^}]*\}\s+from\s+['"]antd['"]/.test(source);
      const rendersAntdTag = new RegExp('<' + 'Tag[\\s>]').test(source);

      return importsAntdTag || rendersAntdTag ? [relativePath] : [];
    });

    expect(offenders).toEqual([]);
  });
});
