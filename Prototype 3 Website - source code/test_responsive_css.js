const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function compact(text) {
  return text.replace(/\s+/g, ' ');
}

function assertContains(haystack, needle, message) {
  assert(haystack.includes(needle), `${message}\nMissing: ${needle}`);
}

function testResponsiveViewportAndMobileBreakpointExist() {
  assertContains(html, '<meta name="viewport" content="width=device-width, initial-scale=1.0">', 'HTML should opt into mobile viewport sizing');
  assertContains(css, '@media (max-width: 480px)', 'CSS should include a phone-sized breakpoint beyond tablet rules');
}

function testPhoneBreakpointStacksPrimaryControls() {
  const normalized = compact(css);
  assertContains(normalized, '@media (max-width: 480px)', 'phone breakpoint should exist before checking control rules');
  assertContains(normalized, '.navbar-links { width: 100%; justify-content: center; flex-wrap: wrap;', 'phone nav links should wrap instead of overflowing horizontally');
  assertContains(normalized, '.wizard-buttons { flex-direction: column-reverse; gap: 10px;', 'wizard next/back buttons should stack with the primary action closest to the form');
  assertContains(normalized, '.btn-wizard { width: 100%; min-height: 44px;', 'wizard buttons should be full-width touch targets on phones');
  assertContains(normalized, '.schedule-actions { width: 100%; flex-direction: column;', 'schedule action/export buttons should stack on phones');
  assertContains(normalized, '.schedule-actions button { width: 100%; min-height: 44px;', 'schedule action/export buttons should be full-width touch targets on phones');
}

function testPhoneBreakpointKeepsModalsWithinViewport() {
  const normalized = compact(css);
  assertContains(normalized, '.modal-overlay { padding: 12px;', 'phone modals should use small viewport padding');
  assertContains(normalized, '.modal-content { max-height: calc(100vh - 24px); overflow-y: auto;', 'phone modal cards should scroll inside the viewport');
  assertContains(normalized, '.detail-header { padding: 16px;', 'phone modal headers should reduce side padding');
  assertContains(normalized, '.modal-search-input { width: calc(100% - 32px); margin: 0 16px 12px;', 'phone modal search inputs should fit inside reduced padding');
  assertContains(normalized, '.swap-list { padding: 0 16px 16px;', 'phone modal lists should use reduced padding');
  assertContains(normalized, '.btn-close-modal { min-width: 44px; min-height: 44px;', 'modal close button should be a touch-sized target');
}

const tests = [
  testResponsiveViewportAndMobileBreakpointExist,
  testPhoneBreakpointStacksPrimaryControls,
  testPhoneBreakpointKeepsModalsWithinViewport
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${test.name}: ${err.message}`);
  }
}

if (failed) {
  console.error(`\nResponsive CSS tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nResponsive CSS tests passed: ${tests.length}/${tests.length}`);
