const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function buildContext() {
  const alerts = [];
  const createdAnchors = [];
  const context = {
    console,
    Date,
    alert(message) { alerts.push(String(message)); },
    window: {},
    document: {
      createElement(tagName) {
        const element = {
          tagName,
          clicked: false,
          click() { this.clicked = true; }
        };
        if (tagName === 'a') createdAnchors.push(element);
        return element;
      }
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
    __alerts: alerts,
    __createdAnchors: createdAnchors
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

function testPdfExportSuccessPathSavesSchedulePlan() {
  const context = buildContext();
  const pdfCalls = [];
  context.window.jspdf = {
    jsPDF: function FakePDF() {
      return {
        setFontSize(size) { pdfCalls.push(['setFontSize', size]); },
        setTextColor(...args) { pdfCalls.push(['setTextColor', ...args]); },
        text(text, x, y) { pdfCalls.push(['text', String(text), x, y]); },
        setFont(...args) { pdfCalls.push(['setFont', ...args]); },
        addPage() { pdfCalls.push(['addPage']); },
        save(filename) { pdfCalls.push(['save', filename]); }
      };
    }
  };

  const { exportPDF } = loadExports(context);
  assert.doesNotThrow(() => exportPDF(), 'PDF export should run when jsPDF is available');

  assert.deepStrictEqual(context.__alerts, [], 'successful PDF export should not alert');
  assert(pdfCalls.some(call => call[0] === 'text' && call[1] === 'UCSC Academic Schedule Plan'), 'PDF should include the plan title');
  assert(pdfCalls.some(call => call[0] === 'text' && call[1].includes('CSE 20 - Beginning Programming in Python')), 'PDF should include scheduled courses');
  assert(pdfCalls.some(call => call[0] === 'save' && call[1] === 'UCSC_Schedule_Plan.pdf'), 'PDF should save with the expected filename');
}

function testExcelExportSuccessPathWritesScheduleWorkbook() {
  const context = buildContext();
  const workbook = { sheets: [] };
  let capturedSheetData = null;
  let capturedFilename = null;
  context.XLSX = {
    utils: {
      book_new() { return workbook; },
      aoa_to_sheet(data) {
        capturedSheetData = data;
        return { data };
      },
      book_append_sheet(wb, ws, name) { wb.sheets.push({ ws, name }); }
    },
    writeFile(wb, filename) {
      capturedFilename = filename;
      assert.strictEqual(wb, workbook, 'Excel export should write the workbook it created');
    }
  };

  const { exportExcel } = loadExports(context);
  assert.doesNotThrow(() => exportExcel(), 'Excel export should run when SheetJS is available');

  assert.deepStrictEqual(context.__alerts, [], 'successful Excel export should not alert');
  assert.strictEqual(capturedFilename, 'UCSC_Schedule_Plan.xlsx');
  assert.deepStrictEqual(workbook.sheets.map(sheet => sheet.name), ['Schedule']);
  assert(capturedSheetData.some(row => row.includes('UCSC Academic Schedule Plan')), 'Excel workbook should include the plan title');
  assert(capturedSheetData.some(row => row.includes('CSE 20') && row.includes('Beginning Programming in Python')), 'Excel workbook should include scheduled courses');
}

async function testWordExportSuccessPathReturnsDownloadPromise() {
  const context = buildContext();
  const constructed = [];
  class FakeDocument { constructor(options) { this.options = options; constructed.push(['Document', options]); } }
  class FakeParagraph { constructor(options) { this.options = options; constructed.push(['Paragraph', options]); } }
  class FakeTextRun { constructor(options) { this.options = options; constructed.push(['TextRun', options]); } }
  class FakeTable { constructor(options) { this.options = options; constructed.push(['Table', options]); } }
  class FakeTableRow { constructor(options) { this.options = options; constructed.push(['TableRow', options]); } }
  class FakeTableCell { constructor(options) { this.options = options; constructed.push(['TableCell', options]); } }
  context.window.docx = {
    Document: FakeDocument,
    Paragraph: FakeParagraph,
    TextRun: FakeTextRun,
    Table: FakeTable,
    TableRow: FakeTableRow,
    TableCell: FakeTableCell,
    AlignmentType: {},
    WidthType: { DXA: 'DXA' },
    BorderStyle: { SINGLE: 'SINGLE' },
    ShadingType: { CLEAR: 'CLEAR' },
    Packer: { toBlob() { return Promise.resolve({ type: 'docx-test-blob' }); } }
  };

  const { exportDOCX } = loadExports(context);
  const result = exportDOCX();
  assert(result && typeof result.then === 'function', 'Word export should return its download promise so success-path smoke tests can await it');
  await result;

  assert.deepStrictEqual(context.__alerts, [], 'successful Word export should not alert');
  assert(constructed.some(([type, options]) => type === 'TextRun' && options.text === 'UCSC Academic Schedule Plan'), 'Word export should include the plan title');
  assert(constructed.some(([type, options]) => type === 'TextRun' && options.text === 'CSE 20'), 'Word export should include scheduled course codes');
  assert.strictEqual(context.__createdAnchors.length, 1, 'Word export should create one download anchor');
  assert.strictEqual(context.__createdAnchors[0].download, 'UCSC_Schedule_Plan.docx');
  assert.strictEqual(context.__createdAnchors[0].clicked, true, 'Word export should click the download anchor');
}

const tests = [
  testPdfExportShowsHelpfulAlertWhenLibraryUnavailable,
  testExcelExportShowsHelpfulAlertWhenLibraryUnavailable,
  testWordExportShowsHelpfulAlertWhenLibraryUnavailable,
  testPdfExportSuccessPathSavesSchedulePlan,
  testExcelExportSuccessPathWritesScheduleWorkbook,
  testWordExportSuccessPathReturnsDownloadPromise
];

(async function runTests() {
  let failed = 0;
  for (const test of tests) {
    try {
      await test();
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
})();
