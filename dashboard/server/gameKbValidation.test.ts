import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectInstalledGameKb } from './gameKbValidation';
import { writeInstalledV7Fixture } from './testSupport/gameKbV7Fixture';

const temporaryDirectories: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gkb-v7-test-'));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const dir = temporaryDirectories.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('inspectInstalledGameKb', () => {
  it('returns null when no v7 markers exist', () => {
    const bookDir = createTempDir();
    fs.mkdirSync(path.join(bookDir, 'data'), { recursive: true });
    expect(inspectInstalledGameKb(bookDir)).toBeNull();
  });

  it('returns passed with contract generate-game-kb-v7 for complete fixture', () => {
    const bookDir = createTempDir();
    writeInstalledV7Fixture(bookDir);
    const result = inspectInstalledGameKb(bookDir);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('passed');
    expect(result!.semanticContractVersion).toBe(7);
    expect(result!.blockingErrors).toEqual([]);
    expect(result!.warnings).toEqual([]);
    expect(result!.runId).toBe('test_run_001');
  });

  it('reports the installed semantic contract version instead of assuming v7', () => {
    const bookDir = createTempDir();
    writeInstalledV7Fixture(bookDir, { semanticContractVersion: 6 });

    const result = inspectInstalledGameKb(bookDir);

    expect(result?.semanticContractVersion).toBe(6);
  });

  it('returns failed with INSTALL_DATA_FILE_HASH_MISMATCH when YAML is corrupted', () => {
    const bookDir = createTempDir();
    writeInstalledV7Fixture(bookDir, { corruptDataFile: 'characters.yaml' });
    const result = inspectInstalledGameKb(bookDir);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.blockingErrors.some((e) => e.includes('INSTALL_DATA_FILE_HASH_MISMATCH'))).toBe(true);
  });

  it('returns failed when receipt is missing but verification-report exists', () => {
    const bookDir = createTempDir();
    writeInstalledV7Fixture(bookDir, { omitReceipt: true });
    const result = inspectInstalledGameKb(bookDir);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.blockingErrors.some((e) => e.includes('INSTALL_RECEIPT_MISSING'))).toBe(true);
  });

  it('returns passed with warning when id_plan_hash is missing', () => {
    const bookDir = createTempDir();
    writeInstalledV7Fixture(bookDir, { omitIdPlanHash: true });
    const result = inspectInstalledGameKb(bookDir);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('passed');
    expect(result!.warnings).toEqual([
      'INSTALL_ID_PLAN_HASH_MISSING | receipt.id_plan_hash',
    ]);
  });
});
