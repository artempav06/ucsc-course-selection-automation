#!/usr/bin/env node
const path = require('path');
const { loadRuntimeData, validateData, summarizeWarnings, summarizeWarningImpact } = require('./data-validator');

const rootDir = path.resolve(__dirname, '..');
const data = loadRuntimeData(rootDir);
const result = validateData(data, {
  // The imported UCSC-wide course catalog intentionally contains many courses
  // outside Prototype 4's supported-major subset. Missing prerequisite/GE refs
  // are warnings for now; supported-major requirement refs remain hard errors.
  strictPrereqReferences: false,
  strictGeReferences: false
});

if (result.warnings.length) {
  console.log(`Data validation warnings: ${result.warnings.length}`);
  const summary = summarizeWarnings(result.warnings);
  for (const [bucket, info] of Object.entries(summary.buckets).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`WARN_BUCKET ${bucket}: ${info.count}`);
  }
  const impact = summarizeWarningImpact(result.warnings, data);
  for (const [bucket, info] of Object.entries(impact.buckets).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`WARN_IMPACT ${bucket}: directSupportedMajor=${info.directSupportedMajor.count} outsideSupportedMajor=${info.outsideSupportedMajor.count}`);
  }
  const previewLimit = 25;
  result.warnings.slice(0, previewLimit).forEach(warning => console.log(`WARN ${warning}`));
  if (result.warnings.length > previewLimit) console.log(`WARN ... ${result.warnings.length - previewLimit} more warnings omitted`);
}

if (result.errors.length) {
  console.error(`Data validation failed: ${result.errors.length} error(s)`);
  result.errors.forEach(error => console.error(`ERROR ${error}`));
  process.exit(1);
}

console.log(`Data validation passed: ${Object.keys(data.courses).length} courses, ${Object.keys(data.majors).length} majors, ${Array.isArray(data.geRequirements) ? data.geRequirements.length : Object.keys(data.geRequirements || {}).length} GE requirements`);
