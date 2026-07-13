const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
  toggle(v, force) {
    if (force === true) { this.values.add(v); return true; }
    if (force === false) { this.values.delete(v); return false; }
    if (this.values.has(v)) { this.values.delete(v); return false; }
    this.values.add(v); return true;
  }
}

class FakeElement {
  constructor(id = null, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.classList = new FakeClassList();
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.textContent = '';
    this._innerHTML = '';
  }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { this.listeners[type] = this.listeners[type] || []; this.listeners[type].push(fn); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  querySelector() { return { addEventListener() {}, checked: false, value: '' }; }
  querySelectorAll() { return []; }
  set innerHTML(v) { this._innerHTML = String(v); }
  get innerHTML() { return this._innerHTML; }
}

function buildContext() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement(tag) { return new FakeElement(null, tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const context = { console, document, window: { scrollTo() {} }, setTimeout, clearTimeout };
  context.globalThis = context;
  return context;
}

function loadApp() {
  const context = buildContext();
  for (const file of ['js/courses.js', 'js/majors.js', 'js/data.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
  }
  const appCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8') + `
    ;globalThis.__p5 = {
      AppState,
      COURSES,
      quartersBetween,
      commonLowerDivisionSuggestionsForMajor,
      courseVisualType,
      courseTypeColors,
      createCourseCard,
      openCourseDetail
    };`;
  vm.runInNewContext(appCode, context, { filename: 'js/app.js' });
  return context;
}

function testGraduationDurationCountsOnlyFallWinterSpring() {
  const { __p5 } = loadApp();
  assert.strictEqual(__p5.quartersBetween('F', 2026, 'S', 2027), 3, 'Fall→Spring should be one academic year / 3 planning quarters');
  assert.strictEqual(__p5.quartersBetween('W', 2027, 'S', 2027), 2, 'Winter→Spring should be 2 planning quarters');
  assert.strictEqual(__p5.quartersBetween('F', 2026, 'F', 2027), 4, 'Fall→next Fall should skip Summer and count 4 F/W/S terms');
  assert.strictEqual(__p5.quartersBetween('SU', 2027, 'S', 2028), 3, 'Summer starts should not add a fourth planning quarter');
}

function testMajorSpecificLowerDivisionSuggestionsDifferByMajor() {
  const { __p5 } = loadApp();
  const cs = __p5.commonLowerDivisionSuggestionsForMajor('CS_BA');
  const ee = __p5.commonLowerDivisionSuggestionsForMajor('EE_BS');
  assert(cs.includes('CSE 16') && cs.includes('CSE 40'), `CS suggestions should include CS math/core classes: ${cs.join(', ')}`);
  assert(!cs.includes('PHYS 5A'), `CS suggestions should not be polluted by EE physics: ${cs.join(', ')}`);
  assert(ee.includes('PHYS 5A') && ee.includes('ECE 13'), `EE suggestions should include EE lower-div requirements: ${ee.join(', ')}`);
  assert(!ee.includes('CSE 16'), `EE suggestions should not show CS-specific discrete math by default: ${ee.join(', ')}`);
}

function testCourseCardsUseRequirementTypeColors() {
  const context = loadApp();
  const { __p5 } = context;
  __p5.AppState.schedule = { courseTypeMap: new Map([
    ['CSE 20', 'major_core'],
    ['WRIT 2', 'ge'],
    ['CSE 115D', 'major_elective'],
    ['FREE 5', 'filler']
  ]) };
  assert.strictEqual(__p5.courseVisualType('CSE 20'), 'required');
  assert.strictEqual(__p5.courseVisualType('WRIT 2'), 'ge');
  assert.strictEqual(__p5.courseVisualType('CSE 115D'), 'elective');
  assert.strictEqual(__p5.courseVisualType('FREE 5'), 'free');
  assert.strictEqual(__p5.courseTypeColors('CSE 20').bg, '#FFEBEE', 'required classes should be light red');
  assert.strictEqual(__p5.courseTypeColors('WRIT 2').bg, '#E3F2FD', 'GE classes should be blue');
  assert.strictEqual(__p5.courseTypeColors('CSE 115D').bg, '#FFF8E1', 'electives should be yellow');
  assert.strictEqual(__p5.courseTypeColors('FREE 5').bg, '#F5F5F5', 'free classes should stay grey');
}

function testCourseDetailUsesDatabaseCatalogUrlAndNoRmpUi() {
  const context = loadApp();
  const { __p5, document } = context;
  const { COURSES } = __p5;
  COURSES['CSE 20'].rmpScore = 4.9;
  __p5.openCourseDetail('CSE 20', 'F', 0);
  const html = document.getElementById('detail-content').innerHTML;
  assert(html.includes(COURSES['CSE 20'].catalogUrl), `detail link should use COURSES catalogUrl; got ${html}`);
  assert(!html.includes('Rate My Professor'), `detail popup should not render Rate My Professor button; got ${html}`);
  assert(!html.includes('RMP Score'), `detail popup should not render RMP score; got ${html}`);
}

function testProfessorPreferenceSectionRemovedFromHtml() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(!html.includes('select-prof-importance'), 'graduation preferences should not ask about professor rating importance');
  assert(!html.includes('professor preferences'), 'loading copy should not mention professor preferences');
}

const tests = [
  testGraduationDurationCountsOnlyFallWinterSpring,
  testMajorSpecificLowerDivisionSuggestionsDifferByMajor,
  testCourseCardsUseRequirementTypeColors,
  testCourseDetailUsesDatabaseCatalogUrlAndNoRmpUi,
  testProfessorPreferenceSectionRemovedFromHtml
];

let passed = 0;
for (const test of tests) {
  test();
  passed++;
  console.log(`✓ ${test.name}`);
}
console.log(`\n${passed}/${tests.length} Prototype 5 UI upgrade tests passed`);
