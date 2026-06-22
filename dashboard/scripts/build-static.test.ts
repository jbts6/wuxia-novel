import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readBookData, sumHtmlFileSizes } from './build-static.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'build-static-'));
}

describe('build-static helpers', () => {
  it('uses empty arrays for missing files', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'characters.json'), JSON.stringify([{ id: 'char_x' }]));

    const data = readBookData(root);

    expect(data.characters).toEqual([{ id: 'char_x' }]);
    expect(data.skills).toEqual([]);
    expect(data.dialogues).toEqual([]);
  });

  it('fails on invalid json instead of hiding corrupt data', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, 'characters.json'), '{bad json');

    expect(() => readBookData(root)).toThrow(/Invalid JSON in characters\.json/);
  });

  it('includes nested author html files when summing output size', () => {
    const root = tempDir();
    fs.mkdirSync(path.join(root, '金庸'), { recursive: true });
    fs.mkdirSync(path.join(root, '古龙'), { recursive: true });
    fs.writeFileSync(path.join(root, '金庸', '天龙八部.html'), '12345');
    fs.writeFileSync(path.join(root, '古龙', '多情剑客无情剑.html'), '123');
    fs.writeFileSync(path.join(root, '古龙', 'ignore.txt'), '123456789');

    expect(sumHtmlFileSizes(root)).toBe(8);
  });
});
