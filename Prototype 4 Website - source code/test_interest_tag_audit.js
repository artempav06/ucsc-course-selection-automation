#!/usr/bin/env node
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

function runAudit(scriptName) {
  const output = execFileSync(process.execPath, [path.join(__dirname, 'scripts', scriptName), '--json'], { encoding: 'utf8' });
  return JSON.parse(output);
}

function testInterestTagAuditHasNoHardErrors() {
  const result = runAudit('audit_interest_tags.js');
  assert.strictEqual(result.hardErrors.length, 0, `interest tag hard errors: ${JSON.stringify(result.hardErrors.slice(0, 10))}`);
  assert(result.summary.majorInterestGroups > 0, 'expected major interest groups to be audited');
  assert(result.summary.geInterestGroups > 0, 'expected GE interest groups to be audited');
}

function testGECandidateAuditHasNoHardErrors() {
  const result = runAudit('audit_ge_candidates.js');
  assert.strictEqual(result.hardErrors.length, 0, `GE candidate hard errors: ${JSON.stringify(result.hardErrors.slice(0, 10))}`);
  assert(result.summary.geRequirements > 0, 'expected GE requirements to be audited');
  assert(result.summary.checkedCourses > 0, 'expected GE candidate courses to be checked');
}

const tests = [testInterestTagAuditHasNoHardErrors, testGECandidateAuditHasNoHardErrors];
let failed = 0;
for (const test of tests) {
  try { test(); console.log(`PASS ${test.name}`); }
  catch (err) { failed++; console.error(`FAIL ${test.name}: ${err.message}`); console.error(err.stack); }
}
if (failed) {
  console.error(`\nInterest/tag audit tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nInterest/tag audit tests passed: ${tests.length}/${tests.length}`);
