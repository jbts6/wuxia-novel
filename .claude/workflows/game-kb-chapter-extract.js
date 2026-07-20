export const meta = {
  name: 'game-kb-chapter-extract',
  description: 'Extract controller-issued game-KB chapters with a bounded read-only worker pool',
  phases: [{ title: 'Extract', detail: 'One read-only structured-output agent per chapter' }],
}

const ENVELOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'batch_id', 'unit', 'attempt', 'input_hash', 'draft'],
  properties: {
    schema_version: { const: 1 },
    batch_id: { type: 'string', minLength: 1 },
    unit: { type: 'string', pattern: '^chapter:[0-9]{3}$' },
    attempt: { type: 'integer', minimum: 1, maximum: 2 },
    input_hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
    draft: { type: 'object' },
  },
}

function fail(message) {
  throw new Error(message)
}

function isAbsolute(file) {
  return typeof file === 'string' && /^(?:[A-Za-z]:[\\/]|\/)/.test(file)
}

function validateDescriptor(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) fail('descriptor must be an object')
  if (typeof job.batch_id !== 'string' || job.batch_id.length === 0) fail('descriptor batch_id is required')
  if (!Array.isArray(job.worker_write_paths) || job.worker_write_paths.length !== 0) {
    fail('descriptor worker_write_paths must be []')
  }
  if (!Array.isArray(job.chapters) || job.chapters.length !== 1) fail('descriptor must contain exactly one chapter')
  if (!Array.isArray(job.submissions) || job.submissions.length !== 1) fail('descriptor must contain exactly one submission')
  const chapter = job.chapters[0]
  const submission = job.submissions[0]
  if (!isAbsolute(chapter.source_file)) fail('chapter source_file must be absolute')
  for (const field of ['unit', 'attempt', 'input_hash']) {
    if (chapter[field] !== submission[field]) fail(`chapter/submission ${field} mismatch`)
  }
  return job
}

function validateArgs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('workflow args must be an object')
  if (typeof value.run_id !== 'string' || value.run_id.length === 0) fail('run_id is required')
  if (![5, 3].includes(value.concurrency_limit)) fail('concurrency_limit must be 5 or 3')
  if (!isAbsolute(value.prompt_file)) fail('prompt_file must be absolute')
  if (!Array.isArray(value.descriptors) || value.descriptors.length === 0) fail('descriptors must be non-empty')
  const descriptors = value.descriptors.map(validateDescriptor)
  const batches = [...new Set(descriptors.map(job => job.batch_id))]
  if (batches.length > value.concurrency_limit) fail('window exceeds concurrency_limit distinct batches')
  if (descriptors.length > value.concurrency_limit * 3) fail('window exceeds controller chapter bound')
  return { ...value, descriptors }
}

const config = validateArgs(args)
phase('Extract')
const results = Array(config.descriptors.length).fill(null)
let cursor = 0

async function consume() {
  while (cursor < config.descriptors.length) {
    const index = cursor
    cursor += 1
    const job = config.descriptors[index]
    const chapter = job.chapters[0]
    const controllerJob = { run_id: config.run_id, ...job }
    const prompt = [
      `Read the extraction contract at ${config.prompt_file}.`,
      `Read only the chapter source at ${chapter.source_file}.`,
      'Process exactly one chapter and return exactly one envelope.',
      `CONTROLLER_JOB=${JSON.stringify(controllerJob)}`,
    ].join('\n')
    results[index] = await agent(prompt, {
      label: `extract:${chapter.unit}`,
      phase: 'Extract',
      agentType: 'game-kb-chapter-worker',
      schema: ENVELOPE_SCHEMA,
    })
  }
}

const lanes = Math.min(config.concurrency_limit, config.descriptors.length)
await Promise.all(Array.from({ length: lanes }, () => consume()))
return results
