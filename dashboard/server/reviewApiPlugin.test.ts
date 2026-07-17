import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { handleReviewApiRequest } from './reviewApiPlugin';

const temporaryDirectories: string[] = [];

function createRoot(): { root: string; bookPath: string; dataDirectory: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuxia-review-api-'));
  temporaryDirectories.push(root);

  const bookPath = '古龙/测试书';
  const bookDirectory = path.join(root, bookPath);
  const dataDirectory = path.join(bookDirectory, 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(bookDirectory, '测试书.txt'), '正文', 'utf-8');

  return { root, bookPath, dataDirectory };
}

function postBody(body: Record<string, unknown>): string {
  return JSON.stringify(body);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('handleReviewApiRequest', () => {
  it('lists only .yaml review files', () => {
    const { root, bookPath, dataDirectory } = createRoot();
    fs.writeFileSync(path.join(dataDirectory, 'characters.yaml'), '- id: character-1\n', 'utf-8');
    fs.writeFileSync(path.join(dataDirectory, 'characters.json'), '[]', 'utf-8');
    fs.writeFileSync(path.join(dataDirectory, 'characters.yml'), '[]', 'utf-8');
    fs.writeFileSync(path.join(dataDirectory, 'notes.yaml'), '[]', 'utf-8');

    expect(
      handleReviewApiRequest(root, 'GET', `/api/review/list?bookPath=${encodeURIComponent(bookPath)}`),
    ).toEqual({
      status: 200,
      body: {
        files: [
          {
            name: 'characters.yaml',
            path: path.join(bookPath, 'data', 'characters.yaml'),
            type: 'characters',
          },
        ],
      },
    });
  });

  it('reads, writes, and backs up YAML inside a discovered book data directory', () => {
    const { root, bookPath, dataDirectory } = createRoot();
    const sourcePath = `${bookPath}/data/characters.yaml`;
    const targetPath = `${bookPath}/data/backups/characters.backup.2026-07-17.yaml`;
    fs.writeFileSync(path.join(dataDirectory, 'characters.yaml'), '- id: before\n', 'utf-8');

    expect(
      handleReviewApiRequest(root, 'GET', `/api/review/read?path=${encodeURIComponent(sourcePath)}`),
    ).toEqual({ status: 200, body: { content: '- id: before\n' } });

    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/write',
        postBody({ path: sourcePath, content: '- id: after\n' }),
      ),
    ).toEqual({ status: 200, body: { success: true } });
    expect(fs.readFileSync(path.join(dataDirectory, 'characters.yaml'), 'utf-8')).toBe('- id: after\n');

    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/backup',
        postBody({ source: sourcePath, target: targetPath }),
      ),
    ).toEqual({ status: 200, body: { success: true, backupPath: targetPath } });
    expect(fs.readFileSync(path.join(root, targetPath), 'utf-8')).toBe('- id: after\n');
  });

  it('rejects reads outside discovered YAML data paths', () => {
    const { root, bookPath, dataDirectory } = createRoot();
    fs.writeFileSync(path.join(root, 'outside.yaml'), '- id: outside\n', 'utf-8');
    fs.writeFileSync(path.join(dataDirectory, 'characters.json'), '[]', 'utf-8');

    expect(
      handleReviewApiRequest(root, 'GET', `/api/review/read?path=${encodeURIComponent('outside.yaml')}`),
    ).toMatchObject({ status: 400 });
    expect(
      handleReviewApiRequest(
        root,
        'GET',
        `/api/review/read?path=${encodeURIComponent(`${bookPath}/data/characters.json`)}`,
      ),
    ).toMatchObject({ status: 400 });
  });

  it('rejects writes outside discovered YAML data paths', () => {
    const { root, bookPath, dataDirectory } = createRoot();
    const outsideDataPath = `${bookPath}/notes.yaml`;
    const nonYamlPath = `${bookPath}/data/skills.yml`;

    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/write',
        postBody({ path: outsideDataPath, content: '[]\n' }),
      ),
    ).toMatchObject({ status: 400 });
    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/write',
        postBody({ path: nonYamlPath, content: '[]\n' }),
      ),
    ).toMatchObject({ status: 400 });
    expect(fs.existsSync(path.join(root, outsideDataPath))).toBe(false);
    expect(fs.existsSync(path.join(dataDirectory, 'skills.yml'))).toBe(false);
  });

  it('rejects backup sources and targets outside discovered YAML data paths', () => {
    const { root, bookPath, dataDirectory } = createRoot();
    const sourcePath = `${bookPath}/data/characters.yaml`;
    fs.writeFileSync(path.join(dataDirectory, 'characters.yaml'), '- id: character-1\n', 'utf-8');

    const outsideTarget = `${bookPath}/reports/characters.backup.yaml`;
    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/backup',
        postBody({ source: sourcePath, target: outsideTarget }),
      ),
    ).toMatchObject({ status: 400 });
    expect(fs.existsSync(path.join(root, outsideTarget))).toBe(false);

    const nonYamlTarget = `${bookPath}/data/backups/characters.backup.json`;
    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/backup',
        postBody({ source: sourcePath, target: nonYamlTarget }),
      ),
    ).toMatchObject({ status: 400 });
    expect(fs.existsSync(path.join(root, nonYamlTarget))).toBe(false);

    const nonYamlSource = `${bookPath}/data/characters.json`;
    fs.writeFileSync(path.join(dataDirectory, 'characters.json'), '[]', 'utf-8');
    expect(
      handleReviewApiRequest(
        root,
        'POST',
        '/api/review/backup',
        postBody({
          source: nonYamlSource,
          target: `${bookPath}/data/backups/characters.backup.yaml`,
        }),
      ),
    ).toMatchObject({ status: 400 });
  });
});
