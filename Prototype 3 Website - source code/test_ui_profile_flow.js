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
    this._innerHTML = '';
  }
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
    'modal-course-detail', 'detail-content', 'grad-duration-hint'
  ];
  const document = makeDocument(ids);
  const captures = { generated: null, validated: null, add: null, swap: null };

  const context = {
    console,
    Date,
    setTimeout,
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
    __captures: captures
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

  assertProfileFlow(context.__captures.generated, 'generated schedule');
  assertProfileFlow(context.__captures.validated, 'generated validation');

  AppState.schedule = [{ label: 'Senior', academicStart: 2026, quarters: { W: ['CSE 186'], S: [] } }];
  openAddCourseModal(0, 'W');
  openSwapModal('CSE 186', 'W', 0);

  assertProfileFlow(context.__captures.add, 'add-course suggestions');
  assertProfileFlow(context.__captures.swap, 'swap suggestions');
}

const tests = [testWizardProfileFlowsIntoGeneratedScheduleAndManualRecommendations];
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
  console.error(`\nUI profile-flow tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nUI profile-flow tests passed: ${tests.length}/${tests.length}`);
