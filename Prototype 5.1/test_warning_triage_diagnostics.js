#!/usr/bin/env node
// Regression coverage for read-only scheduler warning triage diagnostics.
// This keeps warning-family investigation reproducible before behavior changes.

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const root = __dirname;
const result = spawnSync(process.execPath, [path.join(root, 'scripts/phase_c_warning_triage.js')], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);

assert(report.noGapLengthTriage, 'phase_c_warning_triage should expose a noGapLengthTriage section');
assert.strictEqual(
  report.noGapLengthTriage.count,
  report.topBucketByGap['schedule length exceeds selected window :: no-gap'],
  'no-gap length triage count should match the aggregate no-gap length warning bucket'
);
assert(report.noGapLengthTriage.count > 0, 'expected current baseline to include no-gap length warnings');
assert(report.noGapLengthTriage.byPref['low-max-units'] > report.noGapLengthTriage.byPref.standard,
  'low max-unit no-gap warnings should remain separated from standard-load warnings');
assert(report.noGapLengthTriage.rootCauseCounts.lowMaxUnits > 0,
  'triage should classify low max-unit no-gap length warnings explicitly');
assert(report.noGapLengthTriage.rootCauseCounts.compressedStart > 0,
  'triage should classify late/compressed start no-gap length warnings explicitly');
assert(report.noGapLengthTriage.rootCauseByPref['standard :: compressedStart'] > 0,
  'triage should split standard-load no-gap warnings by root-cause clue');
assert(report.noGapLengthTriage.standardExamples.length > 0,
  'triage should include representative standard-load no-gap examples separately');
assert(report.noGapLengthTriage.representativeExamples.length > 0,
  'triage should include representative no-gap length examples');
assert(report.noGapLengthTriage.representativeExamples.every(example => example.scenario.includes('/no-gap')),
  'representative no-gap examples should come only from no-gap profiles');

console.log('Warning triage diagnostics tests passed');
