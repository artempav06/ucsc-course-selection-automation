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
      openCourseDetail,
      moveCourseToQuarter,
      refreshScheduleAfterManualEdit,
      showValidationAlerts
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

function testCourseDetailCatalogLinksComeFromCourseDatabaseOnly() {
  const context = loadApp();
  const { __p5, document } = context;
  const { COURSES } = __p5;
  const representativeCodes = [
    'AM 3', 'WRIT 1', 'MATH 19A', 'CSE 20', 'CSE 101', 'ECE 13',
    'BME 110', 'TIM 50', 'PSYC 1', 'HIS 10B', 'ECON 110', 'CMPM 120'
  ];

  for (const code of representativeCodes) {
    assert(COURSES[code]?.catalogUrl, `${code} should have a database catalogUrl fixture`);
    __p5.openCourseDetail(code, 'F', 0);
    const html = document.getElementById('detail-content').innerHTML;
    assert(
      html.includes(`href="${COURSES[code].catalogUrl}"`),
      `${code} detail popup should use exact COURSES[code].catalogUrl instead of generated fallback; got ${html}`
    );
  }

  const original = COURSES['CSE 20'].catalogUrl;
  COURSES['CSE 20'].catalogUrl = '';
  __p5.openCourseDetail('CSE 20', 'F', 0);
  const missingHtml = document.getElementById('detail-content').innerHTML;
  assert(!missingHtml.includes('View in UCSC Catalog'), `missing DB URL should not render a guessed/broken catalog link; got ${missingHtml}`);
  assert(!missingHtml.includes('/courses/cse/cse-20'), `detail popup should not fall back to generated legacy URL; got ${missingHtml}`);
  COURSES['CSE 20'].catalogUrl = original;
}

function testAllRealCoursesHaveDatabaseCatalogUrlsForDetailPopup() {
  const { __p5 } = loadApp();
  const missing = Object.entries(__p5.COURSES)
    .filter(([code, course]) => !code.startsWith('FREE') && !(course.catalogUrl || '').trim())
    .map(([code]) => code);
  assert.deepStrictEqual(missing, [], `every real course should have a DB catalogUrl before rendering detail links; missing: ${missing.slice(0, 20).join(', ')}`);
}

function testProfessorPreferenceSectionRemovedFromHtml() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(!html.includes('select-prof-importance'), 'graduation preferences should not ask about professor rating importance');
  assert(!html.includes('professor preferences'), 'loading copy should not mention professor preferences');
}

function testDragMoveCourseMutatesScheduleOnceAndRevalidates() {
  const context = loadApp();
  const { __p5 } = context;
  let validateCalls = 0;
  let renderCalls = [];
  context.Validator = {
    validateAll(schedule, profile) {
      validateCalls += 1;
      assert.strictEqual(schedule, __p5.AppState.schedule, 'manual move should validate the edited schedule object');
      assert.strictEqual(profile, __p5.AppState.profile, 'manual move should preserve the active student profile');
      return { allMet: false, major: [], ge: [], uc: [], totalUnits: 0, totalUnitsMet: false, upperDivMet: false };
    }
  };
  context.renderSchedule = () => renderCalls.push('schedule');
  context.renderRequirements = () => renderCalls.push('requirements');
  context.showValidationAlerts = () => renderCalls.push('alerts');
  __p5.AppState.schedule = [
    { academicStart: 2026, quarters: { F: ['CSE 20', 'WRIT 2'], W: ['MATH 19A'], S: [] } }
  ];

  const moved = __p5.moveCourseToQuarter('CSE 20', 'F', 0, 'W', 0);

  assert.strictEqual(moved, true, 'dragging a real course to a new quarter should report success');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['WRIT 2'], 'source quarter should lose exactly the moved course');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.W, ['MATH 19A', 'CSE 20'], 'target quarter should receive the moved course at the end');
  assert.strictEqual(validateCalls, 1, 'drag/drop moves must trigger live schedule validation');
  assert.deepStrictEqual(renderCalls, ['schedule', 'requirements', 'alerts'], 'drag/drop should refresh schedule, requirements, and validation alerts');
}

function testDragMoveIgnoresSameQuarterAndGapTargets() {
  const { __p5 } = loadApp();
  __p5.AppState.schedule = [
    { academicStart: 2026, quarters: { F: ['CSE 20'], W: ['_GAP'], S: [] } }
  ];

  assert.strictEqual(__p5.moveCourseToQuarter('CSE 20', 'F', 0, 'F', 0), false, 'dropping onto the same quarter should be a no-op');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['CSE 20']);
  assert.strictEqual(__p5.moveCourseToQuarter('CSE 20', 'F', 0, 'W', 0), false, 'planned gap quarters should not accept dropped courses');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['CSE 20']);
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.W, ['_GAP']);
}

function testCourseCardsAndQuarterColumnsExposeDragDropUx() {
  const css = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
  assert(css.includes('.course-card[draggable="true"]'), 'course cards should advertise draggable affordance styling');
  assert(css.includes('.quarter-column.drag-over'), 'quarter columns should have a satisfying drag-over drop target state');
  assert(css.includes('.schedule-edit-toast'), 'drag/drop edits should have a visible confirmation toast style');
}

function testValidationAlertsSurfacePrerequisiteViolationsAfterManualMoves() {
  const context = loadApp();
  const { __p5, document } = context;
  __p5.AppState.validation = {
    allMet: false,
    major: [],
    ge: [],
    uc: [],
    totalUnits: 180,
    totalUnitsMet: true,
    upperDivMet: true,
    prereqViolations: [{ course: 'CSE 101', missing: ['CSE 30'], quarter: 'Fall 2026' }]
  };

  __p5.showValidationAlerts();

  const html = document.getElementById('alert-box').innerHTML;
  assert(html.includes('Prerequisite order'), `manual move prerequisite violations should be visible in alerts; got ${html}`);
  assert(html.includes('CSE 101'), `violating course should be named in alert; got ${html}`);
  assert(html.includes('CSE 30'), `missing prerequisite should be named in alert; got ${html}`);
}

function testDragMoveBlockedWhenPrerequisitesWouldBeMissing() {
  const context = loadApp();
  const { __p5, document } = context;
  context.Validator = { validateAll() { throw new Error('blocked prerequisite drops should not mutate or revalidate the schedule'); } };
  __p5.AppState.profile = { completedCourses: [] };
  __p5.AppState.schedule = [
    { academicStart: 2026, label: 'Year 1 (Freshman)', quarters: { F: ['WRIT 1'], W: ['CSE 30'], S: ['CSE 101'] } }
  ];

  const moved = __p5.moveCourseToQuarter('CSE 101', 'S', 0, 'F', 0);

  assert.strictEqual(moved, false, 'drop should be rejected when the target quarter is before required prerequisites');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['WRIT 1'], 'target quarter should stay unchanged after blocked drop');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.S, ['CSE 101'], 'dragged class should snap back to its source quarter');
  const modal = document.getElementById('modal-warning');
  const html = document.getElementById('warning-content').innerHTML;
  assert(modal.classList.contains('active'), 'blocked prerequisite drop should open a warning pop-up');
  assert(html.includes('CSE 101'), `warning should name the dragged course; got ${html}`);
  assert(html.includes('CSE 30'), `warning should explain which prerequisite must be completed first; got ${html}`);
  assert(html.includes('first'), `warning should explain the order problem in student-friendly language; got ${html}`);
}

function testDragMoveAllowedButWarnsWhenQuarterExceedsNineteenCredits() {
  const context = loadApp();
  const { __p5, document } = context;
  let validateCalls = 0;
  context.Validator = {
    validateAll() {
      validateCalls += 1;
      return { allMet: true, major: [], ge: [], uc: [], totalUnits: 180, totalUnitsMet: true, upperDivMet: true, prereqViolations: [] };
    }
  };
  context.renderSchedule = () => {};
  context.renderRequirements = () => {};
  context.showValidationAlerts = () => {};
  __p5.AppState.profile = { completedCourses: [] };
  __p5.AppState.schedule = [
    { academicStart: 2026, label: 'Year 1 (Freshman)', quarters: { F: ['CSE 20'], W: ['MATH 19A', 'WRIT 2', 'CSE 30'], S: [] } }
  ];

  const moved = __p5.moveCourseToQuarter('CSE 20', 'F', 0, 'W', 0);

  assert.strictEqual(moved, true, 'overload drops should be allowed so students can customize intentionally');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, []);
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.W, ['MATH 19A', 'WRIT 2', 'CSE 30', 'CSE 20']);
  assert.strictEqual(validateCalls, 1, 'allowed overload move should still revalidate requirements, credits, and prerequisites');
  const modal = document.getElementById('modal-warning');
  const html = document.getElementById('warning-content').innerHTML;
  assert(modal.classList.contains('active'), 'over-19 credit drop should open a warning pop-up');
  assert(/\b2\d credits\b/.test(html), `warning should name the overloaded credit total; got ${html}`);
  assert(html.includes('19'), `warning should mention the normal 19-credit limit; got ${html}`);
  assert(html.includes('advising'), `warning should recommend checking with advising; got ${html}`);
  assert(html.includes('special permission'), `warning should mention possible special permission; got ${html}`);
}

function testDragMoveAllowedButWarnsWhenSourceDropsBelowTwelveCredits() {
  const context = loadApp();
  const { __p5, document } = context;
  let validateCalls = 0;
  context.Validator = {
    validateAll() {
      validateCalls += 1;
      return { allMet: true, major: [], ge: [], uc: [], totalUnits: 180, totalUnitsMet: true, upperDivMet: true, prereqViolations: [] };
    }
  };
  context.renderSchedule = () => {};
  context.renderRequirements = () => {};
  context.showValidationAlerts = () => {};
  __p5.AppState.profile = { completedCourses: [] };
  __p5.AppState.schedule = [
    { academicStart: 2026, label: 'Year 1 (Freshman)', quarters: { F: ['CSE 20', 'WRIT 2', 'MATH 19A'], W: ['CSE 30'], S: [] } }
  ];

  const moved = __p5.moveCourseToQuarter('CSE 20', 'F', 0, 'W', 0);

  assert.strictEqual(moved, true, 'under-minimum drops should be allowed so students can customize intentionally');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['WRIT 2', 'MATH 19A']);
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.W, ['CSE 30', 'CSE 20']);
  assert.strictEqual(validateCalls, 1, 'allowed under-minimum move should still revalidate requirements, credits, and prerequisites');
  const modal = document.getElementById('modal-warning');
  const html = document.getElementById('warning-content').innerHTML;
  assert(modal.classList.contains('active'), 'under-12 credit source quarter should open a warning pop-up');
  assert(html.includes('10 credits'), `warning should name the under-loaded credit total; got ${html}`);
  assert(html.includes('12'), `warning should mention the 12-credit full-time minimum; got ${html}`);
  assert(html.includes('academic advising'), `warning should tell students to contact UCSC academic advising; got ${html}`);
  assert(html.includes('special permission'), `warning should mention possible special permission; got ${html}`);
}

const tests = [
  testGraduationDurationCountsOnlyFallWinterSpring,
  testMajorSpecificLowerDivisionSuggestionsDifferByMajor,
  testCourseCardsUseRequirementTypeColors,
  testCourseDetailUsesDatabaseCatalogUrlAndNoRmpUi,
  testCourseDetailCatalogLinksComeFromCourseDatabaseOnly,
  testAllRealCoursesHaveDatabaseCatalogUrlsForDetailPopup,
  testProfessorPreferenceSectionRemovedFromHtml,
  testDragMoveCourseMutatesScheduleOnceAndRevalidates,
  testDragMoveIgnoresSameQuarterAndGapTargets,
  testCourseCardsAndQuarterColumnsExposeDragDropUx,
  testValidationAlertsSurfacePrerequisiteViolationsAfterManualMoves,
  testDragMoveBlockedWhenPrerequisitesWouldBeMissing,
  testDragMoveAllowedButWarnsWhenQuarterExceedsNineteenCredits,
  testDragMoveAllowedButWarnsWhenSourceDropsBelowTwelveCredits
];

let passed = 0;
for (const test of tests) {
  test();
  passed++;
  console.log(`✓ ${test.name}`);
}
console.log(`\n${passed}/${tests.length} Prototype 5 UI upgrade tests passed`);
