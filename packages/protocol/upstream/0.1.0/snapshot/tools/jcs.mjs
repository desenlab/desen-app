#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

function canonicalize(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'boolean' || type === 'number' || type === 'string') {
    if (type === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Non-finite numbers are not valid JSON/JCS values');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (type === 'object') {
    const keys = Object.keys(value).sort(); // ECMAScript UTF-16 code-unit order.
    return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalize(value[key])).join(',') + '}';
  }
  throw new TypeError(`Unsupported value type: ${type}`);
}

function project(mode, value) {
  const copy = structuredClone(value);
  if (mode === 'source') {
    delete copy.authoring;
  } else if (mode === 'bundle') {
    delete copy.revision;
    delete copy.publication;
  } else if (mode !== 'raw') {
    throw new Error(`Unknown mode: ${mode}`);
  }
  return copy;
}

export function digest(mode, value) {
  const canonical = canonicalize(project(mode, value));
  const hash = crypto.createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex');
  return `sha256:${hash}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, file] = process.argv.slice(2);
  if (!mode || !file) {
    console.error('Usage: node tools/jcs.mjs <source|bundle|raw> <json-file>');
    process.exit(2);
  }
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(digest(mode, value));
}
