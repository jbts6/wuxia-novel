import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InstalledGameKbValidation {
  status: 'passed' | 'failed' | 'unsupported';
  semanticContractVersion: number;
  runId: string | null;
  blockingErrors: string[];
  warnings: string[];
}

interface VerifyIssue {
  code: string;
  path: string;
  target: string;
  actual_hash?: string;
}

interface VerifyResult {
  passed: boolean;
  blocking_errors: VerifyIssue[];
  warnings: VerifyIssue[];
}

const V7_MARKERS = [
  'reports/generate_game_kb_install.json',
  'reports/verification-report.json',
  'reports/game-kb-review.json',
] as const;

function formatIssue(issue: VerifyIssue): string {
  return [issue.code, issue.path, issue.target].filter(Boolean).join(' | ');
}

function loadVerifier(): ((dir: string) => VerifyResult) | null {
  try {
    const require = createRequire(import.meta.url);
    const installPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../.agents/skills/generate-game-kb/scripts/lib/install.js',
    );
    const mod = require(installPath) as { verifyInstalled: (dir: string) => VerifyResult };
    return mod.verifyInstalled;
  } catch {
    return null;
  }
}

function readReceiptMetadata(bookDirectory: string): {
  semanticContractVersion: number;
  runId: string | null;
} | null {
  try {
    const receiptPath = path.join(bookDirectory, 'reports/generate_game_kb_install.json');
    if (!fs.existsSync(receiptPath)) return null;
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
    if (typeof receipt.semantic_contract_version !== 'number') return null;
    return {
      semanticContractVersion: receipt.semantic_contract_version,
      runId: typeof receipt.run_id === 'string' && receipt.run_id !== '' ? receipt.run_id : null,
    };
  } catch {
    return null;
  }
}

export function inspectInstalledGameKb(bookDirectory: string): InstalledGameKbValidation | null {
  const hasV7Marker = V7_MARKERS.some((m) => fs.existsSync(path.join(bookDirectory, m)));
  if (!hasV7Marker) return null;

  const metadata = readReceiptMetadata(bookDirectory);
  if (metadata && metadata.semanticContractVersion !== 7) {
    return {
      status: 'unsupported',
      semanticContractVersion: metadata.semanticContractVersion,
      runId: metadata.runId,
      blockingErrors: [],
      warnings: [
        `UNSUPPORTED_SEMANTIC_CONTRACT | receipt.semantic_contract_version | ${metadata.semanticContractVersion}`,
      ],
    };
  }

  const verifyInstalled = loadVerifier();
  if (!verifyInstalled) {
    return {
      status: 'failed',
      semanticContractVersion: 7,
      runId: null,
      blockingErrors: ['V7_VERIFIER_UNAVAILABLE | failed to load generate-game-kb install verifier'],
      warnings: [],
    };
  }

  let result: VerifyResult;
  try {
    result = verifyInstalled(bookDirectory);
  } catch (error) {
    return {
      status: 'failed',
      semanticContractVersion: 7,
      runId: null,
      blockingErrors: [`V7_VERIFIER_UNAVAILABLE | ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
    };
  }

  return {
    status: result.passed ? 'passed' : 'failed',
    semanticContractVersion: metadata?.semanticContractVersion ?? 7,
    runId: metadata?.runId ?? null,
    blockingErrors: (result.blocking_errors ?? []).map(formatIssue),
    warnings: (result.warnings ?? []).map(formatIssue),
  };
}
