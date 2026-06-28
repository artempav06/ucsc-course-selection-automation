const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function buildContext() {
  const alerts = [];
  const context = {
    console,
    Date,
    alert(message) { alerts.push(String(message)); },
    window: {},
    document: {
      createElement() { return { click() {} }; }
    },
    URL: {
      createObjectURL() { return 'blob:test'; },
      revokeObjectURL() {}
    },
    AppState: {
      schedule: [{ label: 'Freshman', academicStart: 2026, quarters: { F: ['CSE 20'] } }],
      validation: {
        allMet: true,
        totalUnits: 180,
        totalUnitsMet: true,
        upperDivUnits: 60,
        upperDivMet: true,
        majorReqs: { name: 'Computer Science B.S.', totalUnitsRequired: 180, minUpperDivUnits: 60 },
        major: [], ge: [], uc: []
      }
    },
    CS_BA_REQUIREMENTS: { name: 'Computer Science B.A.', totalUnitsRequired: 180, minUpperDivUnits: 60 },
    QUARTER_LABELS: { F: 'Fall', W: 'Winter', S: 'Spring', SU: 'Summer' },
    COURSES: {
      'CSE 20': { title: 'Beginning Programming in Python', units: 5, ge: null, section: ['CSE'] }
    },
    SECTION_COLORS: { CSE: { label: 'CSE' } },
    __alerts: alerts
  };
  context.globalThis = context;
  return context;
}

function loadExports(context) {
  const exportPath = path.join(__dirname, 'js/export.js');
  const code = fs.readFileSync(exportPath, 'utf8') + '\n;globalThis.__exports = { exportPDF, exportExcel, exportDOCX };';
  vm.runInNewContext(code, context, { filename: 'js/export.js' });
  return context.__exports;
}

function assertMissingToolAlert(context, expectedTool) {
  assert.strictEqual(context.__alerts.length, 1, `expected one alert for ${expectedTool}`);
  assert(context.__alerts[0].includes(expectedTool), `alert should name missing ${expectedTool}; got ${context.__alerts[0]}`);
  assert(context.__alerts[0].includes('refresh'), `alert should suggest a recovery action; got ${context.__alerts[0]}`);
}

function testPdfExportShowsHelpfulAlertWhenLibraryUnavailable() {
  const context = buildContext();
  const { exportPDF } = loadExports(context);
  assert.doesNotThrow(() => exportPDF(), 'PDF export should not crash when jsPDF CDN is unavailable');
  assertMissingToolAlert(context, 'PDF export');
}

function testExcelExportShowsHelpfulAlertWhenLibraryUnavailable() {
  const context = buildContext();
  const { exportExcel } = loadExports(context);
  assert.doesNotThrow(() => exportExcel(), 'Excel export should not crash when SheetJS/XLSX CDN is unavailable');
  assertMissingToolAlert(context, 'Excel export');
}

function testWordExportShowsHelpfulAlertWhenLibraryUnavailable() {
  const context = buildContext();
  const { exportDOCX } = loadExports(context);
  assert.doesNotThrow(() => exportDOCX(), 'Word export should not crash when docx CDN is unavailable');
  assertMissingToolAlert(context, 'Word export');
}

const tests = [
  testPdfExportShowsHelpfulAlertWhenLibraryUnavailable,
  testExcelExportShowsHelpfulAlertWhenLibraryUnavailable,
  testWordExportShowsHelpfulAlertWhenLibraryUnavailable
];
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${test.name}: ${err.message}`);
    console.error(err.stack);
  }
}
if (failed) {
  console.error(`\nExport availability tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nExport availability tests passed: ${tests.length}/${tests.length}`);
