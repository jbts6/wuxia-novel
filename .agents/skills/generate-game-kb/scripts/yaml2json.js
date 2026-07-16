#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Simple YAML parser (handles common cases)
// For production, use js-yaml package

function parseYaml(text) {
  // Try to use js-yaml if available
  try {
    const yaml = require('js-yaml');
    return yaml.load(text);
  } catch (e) {
    // Fallback: simple line-based parser for basic YAML
    return parseSimpleYaml(text);
  }
}

function parseSimpleYaml(text) {
  const lines = text.split('\n');
  const result = {};
  const stack = [{ obj: result, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (content.startsWith('- ')) {
      // Array item
      const value = content.slice(2).trim();
      if (!Array.isArray(parent)) {
        // Convert to array if needed
        const key = Object.keys(parent).pop();
        if (key && !Array.isArray(parent[key])) {
          parent[key] = [];
        }
      }
      if (Array.isArray(parent)) {
        parent.push(parseValue(value));
      }
    } else if (content.includes(':')) {
      const [key, ...valueParts] = content.split(':');
      const value = valueParts.join(':').trim();

      if (value) {
        parent[key.trim()] = parseValue(value);
      } else {
        // Nested object or array
        parent[key.trim()] = {};
        stack.push({ obj: parent[key.trim()], indent });
      }
    }
  }

  return result;
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return parseInt(value);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: yaml2json <input.yaml> [output.json]');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/\.ya?ml$/, '.json');

try {
  const yamlContent = fs.readFileSync(inputFile, 'utf8');
  const data = parseYaml(yamlContent);
  const jsonContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputFile, jsonContent, 'utf8');
  console.log(`Converted: ${inputFile} -> ${outputFile}`);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
