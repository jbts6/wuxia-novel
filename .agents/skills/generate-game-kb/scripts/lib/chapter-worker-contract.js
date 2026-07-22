'use strict';

const WORKER_CONTRACT_VERSION = 1;

const YAML_SKELETON = `characters:
  - name: "<chapter_text 中逐字出现的人物名>"
    aliases: []
    identities: []
    level: null
    rank: null
    description: null
    factions: []
    skills: []
    source_refs:
      - text: "<chapter_text 中逐字出现的原文>"
        line_start: 1
        line_end: 1

skills:
  - name: "<chapter_text 中逐字出现的武功名>"
    aliases: []
    types: []
    factions: []
    rank: null
    description: null
    techniques:
      - name: "<chapter_text 中逐字出现的技法名>"
        description: null
    source_refs:
      - text: "<chapter_text 中逐字出现的原文>"
        line_start: 1
        line_end: 1

items:
  - name: "<chapter_text 中逐字出现的物品名>"
    aliases: []
    types: []
    description: null
    source_refs:
      - text: "<chapter_text 中逐字出现的原文>"
        line_start: 1
        line_end: 1

factions:
  - name: "<chapter_text 中逐字出现的势力名>"
    aliases: []
    types: []
    description: null
    source_refs:
      - text: "<chapter_text 中逐字出现的原文>"
        line_start: 1
        line_end: 1

chapter_summary:
  summary: "<非空章节摘要>"
  source_refs:
    - text: "<chapter_text 中逐字出现的原文>"
      line_start: 1
      line_end: 1
`;

function createWorkerContract() {
  return {
    version: WORKER_CONTRACT_VERSION,
    output: {
      format: 'yaml-single-document',
      markdown_fences: false,
      top_level_fields: [
        'characters', 'skills', 'items', 'factions', 'chapter_summary'
      ],
      yaml_skeleton: YAML_SKELETON
    },
    required_fields: {
      characters: [
        'name', 'aliases', 'identities', 'level', 'rank', 'description',
        'factions', 'skills', 'source_refs'
      ],
      skills: [
        'name', 'aliases', 'types', 'factions', 'rank', 'description',
        'techniques', 'source_refs'
      ],
      skill_technique: ['name', 'description'],
      items: ['name', 'aliases', 'types', 'description', 'source_refs'],
      factions: ['name', 'aliases', 'types', 'description', 'source_refs'],
      chapter_summary: ['summary', 'source_refs'],
      source_ref: ['text']
    },
    optional_fields: {
      source_ref: ['line_start', 'line_end']
    },
    nullable_fields: {
      characters: ['level', 'rank', 'description'],
      skills: ['rank', 'description'],
      skill_technique: ['description'],
      items: ['description'],
      factions: ['description']
    },
    forbidden_fields: {
      top_level: [
        'schema_version', 'chapter', 'title', 'source_hash', 'unit', 'cycle',
        'attempt', 'input_hash', 'output_file', 'source_file', 'run_id',
        'normalizations', 'envelope'
      ],
      entity: [
        'id', 'local_key', 'candidate_key', 'schema_version', 'chapter',
        'title', 'source_hash', 'unit', 'cycle', 'attempt', 'input_hash',
        'output_file', 'type'
      ],
      recursive_patterns: ['id', '*_id', '*_ids']
    },
    grounding: {
      applies_to: ['chapter-worker'],
      entity_name_check: 'chapter_text.includes(entity.name)',
      technique_name_check: 'chapter_text.includes(technique.name)',
      source_ref_text_check: 'chapter_text.includes(source_ref.text)',
      entity_name_evidence_check:
        'entity.source_refs.some(source_ref => source_ref.text.includes(entity.name))',
      technique_name_evidence_check:
        'entity.source_refs.some(source_ref => source_ref.text.includes(technique.name))',
      name_miss_action: 'omit_candidate',
      quote_miss_action: 'omit_source_ref',
      record_without_source_refs_action: 'omit_candidate',
      allow_description_as_formal_name: false,
      allow_quote_rewrite: false
    },
    summary: {
      non_empty_check: 'chapter_summary.summary.trim() !== ""',
      source_refs_minimum: 1
    },
    taxonomy: {
      applies_to: ['chapter-worker'],
      mode: 'closed',
      fields: {
        'skills[].types': 'taxonomies.skills',
        'items[].types': 'taxonomies.items',
        'factions[].types': 'taxonomies.factions'
      },
      unknown_value_action: 'do_not_guess'
    },
    reference_closure: {
      fields: {
        'characters[].skills': 'skills[].name',
        'characters[].factions': 'factions[].name',
        'skills[].factions': 'factions[].name'
      },
      match: 'exact_name',
      unresolved_action: 'omit_relation_or_extract_grounded_candidate'
    },
    preflight: {
      recursive_targets: [
        'characters[]', 'skills[]', 'skills[].techniques[]', 'items[]',
        'factions[]', 'chapter_summary', '**.source_refs[]'
      ],
      common: [
        'reread_output_yaml',
        'single_document',
        'exact_top_level_fields',
        'required_fields_recursive',
        'forbidden_fields_recursive',
        'source_refs_recursive',
        'non_empty_summary'
      ],
      producers: {
        'chapter-worker': [
          'exact_names_and_quotes_in_chapter_text',
          'each_name_covered_by_own_source_refs',
          'closed_taxonomies_only',
          'all_relationship_names_resolve',
          'omit_ungrounded_candidates'
        ],
        'main-agent-repair': [
          'only_allowed_repair_codes',
          'preserve_all_semantic_content',
          'do_not_add_delete_or_rewrite_meaning'
        ]
      }
    }
  };
}

module.exports = { WORKER_CONTRACT_VERSION, createWorkerContract };
