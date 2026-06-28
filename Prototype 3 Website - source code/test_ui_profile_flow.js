const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === true) { this.values.add(value); return true; }
    if (force === false) { this.values.delete(value); return false; }
    if (this.values.has(value)) { this.values.delete(value); return false; }
    this.values.add(value); return true;
  }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(id = null, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this.files = [];
    this.attributes = {};
    this._innerHTML = '';
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) {
    this.children.push(child);
    if (child.selected) this.value = String(child.value);
    if (!this.value && child.value !== undefined) this.value = String(child.value);
    return child;
  }
  addEventListener(type, fn) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }
  dispatchEvent(typeOrEvent) {
    const event = typeof typeOrEvent === 'string' ? { type: typeOrEvent, target: this } : typeOrEvent;
    (this.listeners[event.type] || []).forEach(fn => fn(event));
  }
  click() { this.dispatchEvent('click'); }
  focus() {}
  querySelectorAll() { return []; }
  set innerHTML(value) { this._innerHTML = String(value); }
  get innerHTML() { return this._innerHTML; }
}

function makeDocument(ids) {
  const elements = new Map(ids.map(id => [id, new FakeElement(id)]));
  const domContentLoaded = [];
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement(tag) { return new FakeElement(null, tag); },
    querySelector(selector) {
      if (selector === 'input[name="major-concentration"]:checked') {
        return { value: document.__majorConcentration || '' };
      }
      if (selector === 'input[name="ge-concentration"]:checked') {
        return { value: document.__geConcentration || '' };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.view') return ['landing', 'wizard', 'schedule'].map(name => document.getElementById(`view-${name}`));
      if (selector === '.wizard-step') return [1, 2, 3, 4].map(n => document.getElementById(`wizard-step-${n}`));
      if (selector === '.progress-dot') return [0, 1, 2, 3].map(i => document.getElementById(`progress-dot-${i}`));
      return [];
    },
    addEventListener(type, fn) {
      if (type === 'DOMContentLoaded') domContentLoaded.push(fn);
    },
    dispatchDOMContentLoaded() { domContentLoaded.forEach(fn => fn()); }
  };
  return document;
}

function cloneProfile(profile) {
  return JSON.parse(JSON.stringify(profile));
}

function buildContext() {
  const ids = [
    'btn-start', 'btn-wizard-next-1', 'btn-wizard-next-2', 'btn-wizard-next-3', 'btn-generate',
    'btn-wizard-back-2', 'btn-wizard-back-3', 'btn-wizard-back-4', 'progress-fill',
    'select-major', 'select-level', 'select-current-term', 'select-current-year',
    'check-elwr', 'input-prior-credits', 'select-grad-term', 'select-grad-year', 'check-summer',
    'input-max-units', 'select-prof-importance', 'check-gap', 'select-gap-type', 'select-gap-term',
    'select-gap-year', 'check-auto-suggest', 'concentration-grid', 'ge-concentration-grid',
    'completed-courses-list', 'course-search-input', 'course-search-results', 'transcript-drop-zone',
    'transcript-file-input', 'btn-transcript-browse', 'transcript-status', 'selected-courses-list',
    'gap-options', 'schedule-grid', 'requirements-panel', 'alert-box', 'modal-swap', 'swap-content',
    'modal-course-detail', 'detail-content', 'grad-duration-hint', 'loading-screen'
  ];
  const document = makeDocument(ids);
  const captures = { generated: null, validated: null, add: null, swap: null, consoleErrors: [] };
  const timers = [];

  const context = {
    console: { ...console, error(...args) { captures.consoleErrors.push(args); } },
    Date,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout,
    document,
    window: { scrollTo() {} },
    MAJOR_REQUIREMENTS: { CS_BS: { name: 'Computer Science B.S.' } },
    CONCENTRATIONS: {
      major: { CS_BS: [{ id: 'cs_web_software', name: 'Web Software' }] },
      ge: [{ id: 'ge_arts_humanities', name: 'Arts & Humanities', courses: [], geCodes: [] }]
    },
    COURSES: {
      'CSE 186': { title: 'Full Stack Web Development', units: 5, section: ['CSE'], quarters: ['S'], prereqs: [], desc: '', rmpScore: 0 },
      'CSE 187': { title: 'Fall Web Course', units: 5, section: ['CSE'], quarters: ['F'], prereqs: [], desc: '', rmpScore: 0 }
    },
    SECTION_COLORS: { CSE: { border: '#000', bg: '#fff', label: 'CSE' }, FREE: { border: '#000', bg: '#fff', label: 'Free' } },
    QUARTER_LABELS: { F: 'Fall', W: 'Winter', S: 'Spring', SU: 'Summer' },
    Scheduler: {
      generate(profile) {
        captures.generated = cloneProfile(profile);
        return [{ label: 'Senior', academicStart: 2026, quarters: { W: ['CSE 186'], S: [] } }];
      },
      getReplacements(courseCode, quarter, placedCodes, schedule, query, profile) {
        captures.swap = cloneProfile(profile);
        return [];
      },
      searchAddable(quarter, placedCodes, allPlanned, query, profile) {
        captures.add = cloneProfile(profile);
        return [];
      }
    },
    Validator: {
      validateAll(schedule, profile) {
        captures.validated = cloneProfile(profile);
        return { allMet: true, totalUnits: 0, totalUnitsMet: true, upperDivUnits: 0, upperDivMet: true, priorCredits: 0, completedUnits: 0, majorReqs: { totalUnitsRequired: 180, minUpperDivUnits: 60 }, major: [], ge: [], uc: [] };
      },
      prereqsMet() { return true; }
    },
    __captures: captures,
    __runTimers() {
      while (timers.length) timers.shift()();
    }
  };
  context.globalThis = context;
  return context;
}

function loadApp(context) {
  const appPath = path.join(__dirname, 'js/app.js');
  const code = fs.readFileSync(appPath, 'utf8') + '\n;globalThis.__appExports = { AppState, openAddCourseModal, openSwapModal };';
  vm.runInNewContext(code, context, { filename: 'js/app.js' });
  context.document.dispatchDOMContentLoaded();
  return context.__appExports;
}

function setWizardProfile(document) {
  document.getElementById('select-major').value = 'CS_BS';
  document.getElementById('select-level').value = 'UG_4';
  document.getElementById('select-current-term').value = 'W';
  document.getElementById('select-current-year').value = '2027';
  document.getElementById('check-elwr').checked = true;
  document.getElementById('input-prior-credits').value = '12';
  document.getElementById('select-grad-term').value = 'S';
  document.getElementById('select-grad-year').value = '2027';
  document.getElementById('check-summer').checked = false;
  document.getElementById('input-max-units').value = '15';
  document.getElementById('select-prof-importance').value = 'high';
  document.getElementById('check-gap').checked = true;
  document.getElementById('select-gap-type').value = 'quarter';
  document.getElementById('select-gap-term').value = 'S';
  document.getElementById('select-gap-year').value = '2027';
  document.getElementById('check-auto-suggest').checked = true;
  document.__majorConcentration = 'cs_web_software';
  document.__geConcentration = 'ge_arts_humanities';
}

function assertProfileFlow(profile, label) {
  assert(profile, `${label} should receive a profile`);
  assert.strictEqual(profile.major, 'CS_BS', `${label} major`);
  assert.strictEqual(profile.currentLevel, 4, `${label} current level`);
  assert.strictEqual(profile.currentTerm, 'W', `${label} current term`);
  assert.strictEqual(profile.currentYear, 2027, `${label} current year`);
  assert.strictEqual(profile.targetGradTerm, 'S', `${label} target grad term`);
  assert.strictEqual(profile.targetGradYear, 2027, `${label} target grad year`);
  assert.strictEqual(profile.gapEnabled, true, `${label} gap enabled`);
  assert.strictEqual(profile.gapType, 'quarter', `${label} gap type`);
  assert.strictEqual(profile.gapTerm, 'S', `${label} gap term`);
  assert.strictEqual(profile.gapYear, 2027, `${label} gap year`);
  assert.strictEqual(profile.concentration, 'cs_web_software', `${label} major concentration`);
  assert.strictEqual(profile.geConcentration, 'ge_arts_humanities', `${label} GE concentration`);
}

function testWizardProfileFlowsIntoGeneratedScheduleAndManualRecommendations() {
  const context = buildContext();
  const { AppState, openAddCourseModal, openSwapModal } = loadApp(context);
  setWizardProfile(context.document);

  context.document.getElementById('btn-wizard-next-1').click();
  context.document.getElementById('btn-wizard-next-2').click();
  context.document.getElementById('btn-wizard-next-3').click();
  context.document.getElementById('btn-generate').click();
  context.__runTimers();

  assertProfileFlow(context.__captures.generated, 'generated schedule');
  assertProfileFlow(context.__captures.validated, 'generated validation');

  AppState.schedule = [{ label: 'Senior', academicStart: 2026, quarters: { W: ['CSE 186'], S: [] } }];
  openAddCourseModal(0, 'W');
  openSwapModal('CSE 186', 'W', 0);

  assertProfileFlow(context.__captures.add, 'add-course suggestions');
  assertProfileFlow(context.__captures.swap, 'swap suggestions');
}

function testGenerateShowsBananaSlugLoadingBeforeScheduleIsReady() {
  const context = buildContext();
  loadApp(context);
  setWizardProfile(context.document);
  context.document.getElementById('btn-generate').textContent = 'Launch Banana Plan';

  context.document.getElementById('btn-wizard-next-1').click();
  context.document.getElementById('btn-wizard-next-2').click();
  context.document.getElementById('btn-wizard-next-3').click();
  context.document.getElementById('btn-generate').click();

  const loading = context.document.getElementById('loading-screen');
  const generateBtn = context.document.getElementById('btn-generate');
  assert.strictEqual(loading.classList.contains('active'), true, 'loading overlay should appear immediately after Generate');
  assert.strictEqual(loading.getAttribute('aria-busy'), 'true', 'loading overlay should mark the app busy while generating');
  assert.strictEqual(generateBtn.disabled, true, 'generate button should be disabled while generating');
  assert.strictEqual(generateBtn.textContent, 'Building your schedule…', 'generate button should show loading text');
  assert.strictEqual(context.__captures.generated, null, 'schedule generation should wait until the loading frame can render');

  context.__runTimers();

  assertProfileFlow(context.__captures.generated, 'generated schedule after loading');
  assert.strictEqual(loading.classList.contains('active'), false, 'loading overlay should hide after schedule render');
  assert.strictEqual(loading.getAttribute('aria-busy'), 'false', 'loading overlay should clear busy state after rendering');
  assert.strictEqual(generateBtn.disabled, false, 'generate button should be re-enabled after rendering');
  assert.strictEqual(generateBtn.textContent, 'Launch Banana Plan', 'generate button should restore its original label');
}

function testGenerateFailureShowsFriendlyErrorAndCleansUp() {
  const context = buildContext();
  const { AppState } = loadApp(context);
  setWizardProfile(context.document);
  context.Scheduler.generate = () => { throw new Error('synthetic scheduler failure'); };

  context.document.getElementById('btn-wizard-next-1').click();
  context.document.getElementById('btn-wizard-next-2').click();
  context.document.getElementById('btn-wizard-next-3').click();
  context.document.getElementById('btn-generate').click();

  assert.doesNotThrow(() => context.__runTimers(), 'generation failure should be handled in the UI instead of escaping');

  const loading = context.document.getElementById('loading-screen');
  const generateBtn = context.document.getElementById('btn-generate');
  const alertBox = context.document.getElementById('alert-box');
  assert.strictEqual(loading.classList.contains('active'), false, 'loading overlay should hide after generation failure');
  assert.strictEqual(loading.getAttribute('aria-busy'), 'false', 'busy state should clear after generation failure');
  assert.strictEqual(generateBtn.disabled, false, 'generate button should be re-enabled after generation failure');
  assert.strictEqual(AppState.currentView, 'schedule', 'generation errors should switch to the schedule view so the alert is visible');
  assert.strictEqual(alertBox.style.display, 'block', 'generation failure should show a visible alert');
  assert(alertBox.innerHTML.includes('We couldn\'t build your schedule'), `generation failure alert should be student-friendly; got ${alertBox.innerHTML}`);
}

function testManualSuggestionModalsRenderReasonChips() {
  const context = buildContext();
  const { AppState, openAddCourseModal, openSwapModal } = loadApp(context);
  AppState.profile = { major: 'CS_BS', concentration: 'cs_web_software', geConcentration: 'ge_arts_humanities' };
  AppState.schedule = [{ label: 'Senior', academicStart: 2026, quarters: { W: ['CSE 186'], S: [] } }];
  context.Scheduler.searchAddable = () => [{
    code: 'CSE 187', title: 'Fall Web Course', units: 5, desc: 'Useful course', ge: null,
    rmpScore: 4.2, section: ['CSE'], reasons: [
      { id: 'major_concentration', label: 'Matches major & focus' },
      { id: 'prerequisites_met', label: 'Prerequisites met' }
    ]
  }];
  context.Scheduler.getReplacements = () => [{
    code: 'CSE 187', title: 'Fall Web Course', units: 5, desc: 'Useful course', ge: null,
    rmpScore: 4.2, sections: ['CSE'], section: ['CSE'], reasons: [
      { id: 'offered_current_quarter', label: 'Offered in Winter' }
    ]
  }];

  openAddCourseModal(0, 'W');
  const addHtml = context.document.getElementById('swap-content').innerHTML;
  assert(addHtml.includes('suggestion-reasons'), 'add-course modal should render a reason-chip container');
  assert(addHtml.includes('Matches major &amp; focus'), `add-course reason labels should be escaped and visible; got ${addHtml}`);
  assert(addHtml.includes('Prerequisites met'), `add-course prerequisite reason should be visible; got ${addHtml}`);

  openSwapModal('CSE 186', 'W', 0);
  const swapHtml = context.document.getElementById('swap-content').innerHTML;
  assert(swapHtml.includes('suggestion-reasons'), 'swap modal should render a reason-chip container');
  assert(swapHtml.includes('Offered in Winter'), `swap reason label should be visible; got ${swapHtml}`);
}

async function testTranscriptFilePickerRejectsNonPdfBeforeParsing() {
  const context = buildContext();
  loadApp(context);
  let getDocumentCalls = 0;
  context.pdfjsLib = {
    GlobalWorkerOptions: {},
    getDocument() {
      getDocumentCalls++;
      return { promise: Promise.reject(new Error('parser should not run for non-PDF picker files')) };
    }
  };

  const fileInput = context.document.getElementById('transcript-file-input');
  fileInput.files = [{ name: 'courses.txt', type: 'text/plain', arrayBuffer: async () => new ArrayBuffer(0) }];
  fileInput.dispatchEvent('change');
  await Promise.resolve();

  const status = context.document.getElementById('transcript-status');
  assert.strictEqual(getDocumentCalls, 0, 'non-PDF picker files should be rejected before PDF.js parsing');
  assert.strictEqual(status.className, 'transcript-status error', 'non-PDF picker files should show an error status');
  assert(status.textContent.includes('PDF'), `non-PDF picker error should mention PDFs; got ${status.textContent}`);
}

function waitForMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

async function testTranscriptUploadSuccessAddsRecognizedCourses() {
  const context = buildContext();
  const { AppState } = loadApp(context);
  context.pdfjsLib = {
    GlobalWorkerOptions: {},
    getDocument() {
      return {
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({ items: [{ str: 'Completed CSE 186 and CSE 187 with passing grades.' }] })
          })
        })
      };
    }
  };

  const fileInput = context.document.getElementById('transcript-file-input');
  fileInput.files = [{ name: 'transcript.pdf', type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) }];
  fileInput.dispatchEvent('change');
  await waitForMicrotasks();

  const status = context.document.getElementById('transcript-status');
  assert.deepStrictEqual([...AppState.profile.completedCourses].sort(), ['CSE 186', 'CSE 187'], 'recognized transcript courses should be added to completedCourses');
  assert.strictEqual(status.className, 'transcript-status success', 'successful transcript parse should show success status');
  assert(status.textContent.includes('Found 2 courses'), `success status should summarize found courses; got ${status.textContent}`);
}

const tests = [
  testWizardProfileFlowsIntoGeneratedScheduleAndManualRecommendations,
  testGenerateShowsBananaSlugLoadingBeforeScheduleIsReady,
  testGenerateFailureShowsFriendlyErrorAndCleansUp,
  testManualSuggestionModalsRenderReasonChips,
  testTranscriptFilePickerRejectsNonPdfBeforeParsing,
  testTranscriptUploadSuccessAddsRecognizedCourses
];

(async () => {
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
    console.error(`\nUI profile-flow tests failed: ${failed}/${tests.length}`);
    process.exit(1);
  }
  console.log(`\nUI profile-flow tests passed: ${tests.length}/${tests.length}`);
})();
