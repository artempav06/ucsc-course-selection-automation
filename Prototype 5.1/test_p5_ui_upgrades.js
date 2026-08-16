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
  const context = { console, document, window: { scrollTo() {}, open(url, target, features) { context.__openedUrl = { url, target, features }; } }, setTimeout, clearTimeout };
  context.Scheduler = {
    buildYearSkeleton(curTerm, curYear, gradTerm, gradYear, startLevel, studentType, includeSummer, summerYears = []) {
      const termOrder = includeSummer ? ['F', 'W', 'S', 'SU'] : ['F', 'W', 'S'];
      const selectedSummerYears = Array.isArray(summerYears) && summerYears.length > 0
        ? new Set(summerYears.map(y => parseInt(y, 10)).filter(Number.isFinite))
        : null;
      const academicYearOf = (term, year) => term === 'F' ? year : year - 1;
      const startAcad = academicYearOf(curTerm, curYear);
      const gradAcad = academicYearOf(gradTerm, gradYear);
      const levelNames = { 1: 'Freshman', 2: 'Sophomore', 3: 'Junior', 4: 'Senior', 5: '5th Year' };
      const schedule = [];
      for (let acad = startAcad; acad <= gradAcad; acad++) {
        const levelNum = acad - startAcad + startLevel;
        const quarters = { F: [], W: [], S: [] };
        const summerCalendarYear = acad + 1;
        if (includeSummer && (!selectedSummerYears || selectedSummerYears.has(summerCalendarYear))) quarters.SU = [];
        const year = { label: `Year ${levelNum} (${levelNames[levelNum] || 'Year ' + levelNum})`, academicStart: acad, levelNum, quarters };
        if (acad === startAcad) {
          const startIdx = termOrder.indexOf(curTerm);
          for (let i = 0; i < Math.max(0, startIdx); i++) delete year.quarters[termOrder[i]];
        }
        if (acad === gradAcad) {
          const gradIdx = termOrder.indexOf(gradTerm);
          for (let i = (gradIdx >= 0 ? gradIdx : termOrder.length - 1) + 1; i < termOrder.length; i++) delete year.quarters[termOrder[i]];
          if (year.quarters.SU && gradTerm !== 'SU') delete year.quarters.SU;
        }
        schedule.push(year);
      }
      return schedule;
    }
  };
  context.globalThis = context;
  return context;
}

function loadApp() {
  const context = buildContext();
  for (const file of ['js/courses.js', 'js/graduate-courses.js', 'js/majors.js', 'js/data.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
  }
  const appCode = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8') + `
    ;globalThis.__p5 = {
      AppState,
      COURSES,
      GRADUATE_COURSES: (typeof GRADUATE_COURSES !== 'undefined' ? GRADUATE_COURSES : undefined),
      MAJOR_REQUIREMENTS,
      searchCourses,
      addCompletedCourse,
      allSearchableCourses: (typeof allSearchableCourses === 'function' ? allSearchableCourses : undefined),
      courseByCode: (typeof courseByCode === 'function' ? courseByCode : undefined),
      restrictionWarningHtmlForCourse: (typeof restrictionWarningHtmlForCourse === 'function' ? restrictionWarningHtmlForCourse : undefined),
      quartersBetween,
      commonLowerDivisionSuggestionsForMajor,
      courseVisualType,
      courseTypeColors,
      createCourseCard,
      openCourseDetail,
      moveCourseToQuarter,
      refreshScheduleAfterManualEdit,
      showValidationAlerts,
      majorRequirementCatalogUrl,
      showScheduleAccuracyWarning,
      reviewFormUrl,
      isReviewFormConfigured,
      openReviewForm,
      showStudentReviewPrompt,
      promptForReviewAfterDownload,
      scheduleReviewPromptAfterGeneration: (typeof scheduleReviewPromptAfterGeneration === 'function' ? scheduleReviewPromptAfterGeneration : undefined),
      setPlanningMode: (typeof setPlanningMode === 'function' ? setPlanningMode : undefined),
      buildBlankScheduleForProfile: (typeof buildBlankScheduleForProfile === 'function' ? buildBlankScheduleForProfile : undefined),
      startBlankScheduleConstructor: (typeof startBlankScheduleConstructor === 'function' ? startBlankScheduleConstructor : undefined),
      showBlankScheduleRules: (typeof showBlankScheduleRules === 'function' ? showBlankScheduleRules : undefined),
      refreshGradYearDefault,
      collectSelectedSummerYears: (typeof collectSelectedSummerYears === 'function' ? collectSelectedSummerYears : undefined),
      summerCalendarYearsInWindow: (typeof summerCalendarYearsInWindow === 'function' ? summerCalendarYearsInWindow : undefined),
      validateCollegeAffiliationBeforeNext: (typeof validateCollegeAffiliationBeforeNext === 'function' ? validateCollegeAffiliationBeforeNext : undefined)
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

function testGraduationDefaultAutoSelectsFourYearSpringTarget() {
  const context = loadApp();
  const { __p5, document } = context;
  document.getElementById('select-current-term').value = 'F';
  document.getElementById('select-current-year').value = '2026';
  document.getElementById('select-grad-term').value = 'W';
  document.getElementById('select-grad-year').value = '2028';

  __p5.refreshGradYearDefault({ force: true });

  assert.strictEqual(document.getElementById('select-grad-term').value, 'S', 'default target term should be Spring');
  assert.strictEqual(document.getElementById('select-grad-year').value, '2030', 'Fall 2026 default should target Spring 2030');
}

function testSummerPickerLetsStudentsChooseSpecificSummerYears() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
  assert(html.includes('id="summer-quarter-panel"'), 'graduation step should include a specific summer-quarter chooser panel');
  assert(html.includes('id="summer-quarter-options"'), 'summer chooser should have a dynamic options container');
  assert(app.includes('summerYears'), 'profile collection should store selected summer years');
  assert(app.includes('collectSelectedSummerYears()'), 'Step 3 should collect selected summer years when summer is enabled');
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

function testNavbarIncludesUcscRateMyProfessorsResourceButton() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
  assert(html.includes('href="https://www.ratemyprofessors.com/school/1078"'), 'navbar should link directly to the UC Santa Cruz Rate My Professors school page');
  assert(html.includes('class="nav-rmp-link"'), 'Rate My Professors should be a visible navbar resource link');
  assert(html.includes('target="_blank"'), 'external Rate My Professors link should open in a new tab');
  assert(html.includes('rel="noopener noreferrer"'), 'external Rate My Professors link should use safe noopener/noreferrer rel');
  assert(html.includes('aria-label="Open UC Santa Cruz on Rate My Professors"'), 'RMP navbar button should have a clear accessible label');
  assert(css.includes('.navbar-links button.nav-review-link'), 'review button should keep explicit highlighted styling');
  assert(css.includes('.navbar-links button.nav-review-link {\n  background: #FDC700'), 'review button should use UCSC gold highlight styling');
  assert(!css.includes('.navbar-links a.nav-rmp-link,\n.navbar-links button.nav-review-link'), 'RMP link should not be grouped with highlighted review button styling');
}

function testWordExportOptionIsRemovedFromScheduleAndLanding() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(!html.includes('Export Word'), 'schedule download actions should no longer offer Word export');
  assert(!html.includes('exportDOCX()'), 'schedule UI should not wire a Word export button');
  assert(!html.includes('docx@'), 'page should not load the Word/docx CDN once Word export is removed');
  assert(!html.includes('PDF, Word, or Excel'), 'landing copy should not advertise Word download');
  assert(html.includes('PDF or Excel'), 'landing copy should advertise only the remaining two download formats');
}

function testLandingDoesNotClaimQuarterAvailabilityIsRespected() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(!html.includes('respecting prerequisites, quarter availability'), 'landing copy must not claim the app considers real quarter availability');
  assert(html.includes('does not check which quarter each class is offered'), 'landing copy should warn that offering-quarter availability must be checked separately');
}

function testGeneratedScheduleWarningUsesSelectedMajorCatalogLinkAndAvailabilityCaveat() {
  const context = loadApp();
  const { __p5, document } = context;

  for (const [majorId, reqs] of Object.entries(__p5.MAJOR_REQUIREMENTS)) {
    assert((reqs.catalogUrl || '').startsWith('https://catalog.ucsc.edu/en/current/general-catalog/'), `${majorId} should have an official UCSC catalog requirements link`);
    assert.strictEqual(__p5.majorRequirementCatalogUrl(majorId), reqs.catalogUrl, `${majorId} warning link should come from the major database`);
  }

  __p5.AppState.profile.major = 'EE_BS';

  assert.strictEqual(
    __p5.majorRequirementCatalogUrl('EE_BS'),
    __p5.MAJOR_REQUIREMENTS.EE_BS.catalogUrl,
    'EE_BS should resolve to its official UCSC major requirement catalog page'
  );

  __p5.showScheduleAccuracyWarning();

  const modal = document.getElementById('modal-warning');
  const html = document.getElementById('warning-content').innerHTML;
  assert(modal.classList.contains('active'), 'schedule generation should open a warning pop-up');
  assert(html.includes('not perfect'), `warning should clearly say the generated schedule is not perfect; got ${html}`);
  assert(html.includes('Academic Advising'), `warning should recommend Academic Advising; got ${html}`);
  assert(html.includes('Electrical Engineering B.S.'), `warning should name the selected major; got ${html}`);
  assert(html.includes('https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/electrical-and-computer-engineering/electrical-engineering-bs'), `warning should link to the selected major's official requirement page; got ${html}`);
  assert(html.includes('does not check which quarter each class is offered'), `warning should mention quarter availability limitation; got ${html}`);
}

function testAcademicHistoryCheckboxSectionsAreProminentAndIncludeAhiOptions() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
  assert(html.includes('id="check-ahi"'), 'Academic History should ask whether AH&I was fulfilled before UCSC');
  assert(html.includes('id="ahi-options"'), 'AH&I checkbox should reveal an unfoldable options section');
  assert(html.includes('check-ahi-us-history-full-year'), 'AH&I options should include one-year U.S. history');
  assert(html.includes('check-ahi-us-history-half-year'), 'AH&I options should include half-year U.S. history');
  assert(html.includes('check-ahi-american-government-half-year'), 'AH&I options should include half-year American government');
  assert(html.includes('id="select-college-affiliation"'), 'Academic History should ask for the student\'s UCSC college affiliation');
  assert(html.includes('id="select-college-affiliation" class="college-affiliation-select" required'), 'College affiliation should be marked required in the form');
  assert(html.includes('id="college-affiliation-error"'), 'Academic History should include an inline error for missing college affiliation');
  assert(html.includes('id="check-college-core-completed"'), 'Academic History should ask whether required college core courses are completed');
  assert(html.includes('Stevenson College'), 'college affiliation choices should include Stevenson for the Fall + Winter core sequence');
  assert(html.includes('John R. Lewis College / College Ten'), 'college affiliation choices should include College Ten / John R. Lewis');
  assert(html.includes('checkbox-card'), 'Academic History checkboxes should use the more-visible card styling hook');
  assert(css.includes('.checkbox-card'), 'checkbox-card styling should exist for easy-to-miss checkbox sections');
  assert(css.includes('border: 2px solid'), 'checkbox cards should have a visible border');
  assert(css.includes('.checkbox-card:has(input[type="checkbox"]:checked)'), 'checked checkbox cards should get a stronger selected state');
  assert(css.includes('.form-error'), 'required college affiliation validation should have visible inline error styling');
}

function testCollegeAffiliationBlocksAcademicHistoryNextUntilSelected() {
  const context = loadApp();
  const { __p5, document } = context;
  const select = document.getElementById('select-college-affiliation');
  const error = document.getElementById('college-affiliation-error');

  assert.strictEqual(typeof __p5.validateCollegeAffiliationBeforeNext, 'function', 'Academic History should expose college-affiliation validation');
  select.value = '';
  assert.strictEqual(__p5.validateCollegeAffiliationBeforeNext(), false, 'missing college affiliation should block the Step 2 Next button');
  assert(error.innerHTML.includes('College affiliation is required'), `missing college should show a clear error; got ${error.innerHTML}`);

  select.value = 'cowell';
  assert.strictEqual(__p5.validateCollegeAffiliationBeforeNext(), true, 'selected college affiliation should allow the student to continue');
  assert.strictEqual(error.innerHTML, '', 'valid college selection should clear the inline error');
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

function testDragCanReorderCoursesWithinSameQuarter() {
  const context = loadApp();
  const { __p5 } = context;
  let validateCalls = 0;
  context.Validator = { validateAll() { validateCalls += 1; return { allMet: true, major: [], ge: [], uc: [], prereqViolations: [] }; } };
  context.renderSchedule = () => {};
  context.renderRequirements = () => {};
  context.showValidationAlerts = () => {};
  __p5.AppState.schedule = [
    { academicStart: 2026, quarters: { F: ['HIS 10B', 'MATH 19A', 'WRIT 2'], W: [], S: [] } }
  ];

  const movedToTop = __p5.moveCourseToQuarter('MATH 19A', 'F', 0, 'F', 0, 0);
  assert.strictEqual(movedToTop, true, 'same-quarter drag with a target index should reorder the course');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['MATH 19A', 'HIS 10B', 'WRIT 2'], 'MATH 19A should move above HIS 10B');

  const movedToBottom = __p5.moveCourseToQuarter('HIS 10B', 'F', 0, 'F', 0, 2);
  assert.strictEqual(movedToBottom, true, 'same-quarter drag should also support moving a course downward');
  assert.deepStrictEqual(__p5.AppState.schedule[0].quarters.F, ['MATH 19A', 'WRIT 2', 'HIS 10B'], 'HIS 10B should move to the bottom of the quarter');
  assert.strictEqual(validateCalls, 2, 'quarter reordering should still revalidate and refresh the plan');
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

function testNavbarReviewButtonOpensGoogleFormDirectly() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');

  assert(html.includes('class="nav-review-link"'), 'navbar should include a visible Leave Review button');
  assert(html.includes('onclick="openReviewForm()"'), 'navbar review button should send students straight to the Google Form');
  assert(!html.includes("showStudentReviewPrompt('navbar')"), 'navbar review button should not open the review pop-up anymore');
  assert(css.includes('.nav-review-link'), 'review navbar button should have explicit styling');
}

function testReviewPromptIsShortAnonymousAndActionFocused() {
  const context = loadApp();
  const { __p5, document } = context;

  __p5.showStudentReviewPrompt('pdf');
  const modal = document.getElementById('modal-warning');
  const body = document.getElementById('warning-content').innerHTML;
  assert(modal.classList.contains('active'), 'download-triggered review action should open a modal');
  assert(body.includes('Thanks for downloading your schedule'), `download prompt should keep the first thank-you paragraph; got ${body}`);
  assert(body.includes('fully anonymous'), `review prompt should tell students the form is fully anonymous; got ${body}`);
  assert(body.includes('review-primary-action'), `review prompt should keep a clear form-opening button; got ${body}`);
  assert(!body.includes('The review form asks for'), `review prompt should not explain every form question; got ${body}`);
  assert(!body.includes('Overall rating'), `review prompt should not list the rating question anymore; got ${body}`);
  assert(!body.includes('Privacy reminder'), `review prompt should not show the old privacy-reminder label; got ${body}`);
}

function testReviewPromptSchedulesOneMinuteAfterScheduleGeneration() {
  const app = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf8');
  assert(app.includes('scheduleReviewPromptAfterGeneration()'), 'schedule generation should arm a delayed review prompt');
  assert(/setTimeout\(\(\)\s*=>\s*showStudentReviewPrompt\("generated"\),\s*60_?000\)/.test(app), 'generated-schedule prompt should wait one minute before showing');
}

function testReviewPromptUsesLiveGoogleFormUrlByDefault() {
  const context = loadApp();
  const { __p5, document } = context;
  assert.strictEqual(__p5.isReviewFormConfigured(), true, 'live Google Form URL should count as configured');
  __p5.showStudentReviewPrompt('pdf');
  const body = document.getElementById('warning-content').innerHTML;
  assert(body.includes('Thanks for downloading your schedule'), `download-triggered prompt should thank student after export; got ${body}`);
  assert(!body.includes('Review form setup needed'), `configured form should not show setup instructions; got ${body}`);
  __p5.openReviewForm();
  assert.strictEqual(
    context.__openedUrl.url,
    'https://docs.google.com/forms/d/e/1FAIpQLSeffqrzPxMwABSSrgUZ7IIN3n43IUoyhx0LmVSFYf2WFc7_mg/viewform?usp=dialog',
    'default review action should open Artem\'s live Google Form'
  );
}

function testConfiguredReviewFormOpensSafelyInNewTab() {
  const context = loadApp();
  const { __p5 } = context;
  context.window.UCSC_REVIEW_FORM_URL = 'https://forms.gle/abc123ReviewForm';
  assert.strictEqual(__p5.isReviewFormConfigured(), true, 'forms.gle URL should count as configured');
  __p5.openReviewForm();
  assert.deepStrictEqual(context.__openedUrl, {
    url: 'https://forms.gle/abc123ReviewForm',
    target: '_blank',
    features: 'noopener,noreferrer'
  }, 'review form should open safely in a new tab');
}

function testLandingOffersPlanForMeAndBuildFromScratchChoices() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(html.includes('id="btn-plan-for-me"'), 'landing page should expose a Plan for Me choice');
  assert(html.includes('id="btn-build-from-scratch"'), 'landing page should expose a Build from Scratch choice');
  assert(html.includes('Build from Scratch'), 'landing copy should name the blank-schedule constructor option');
  assert(html.includes('Plan for Me'), 'landing copy should name the automatic schedule option');
}

function testPlanningModeButtonsSelectWizardMode() {
  const context = loadApp();
  const { __p5 } = context;
  assert.strictEqual(typeof __p5.setPlanningMode, 'function', 'app should expose planning-mode selection helper');
  __p5.setPlanningMode('blank');
  assert.strictEqual(__p5.AppState.planningMode, 'blank', 'blank option should store constructor mode');
  __p5.setPlanningMode('auto');
  assert.strictEqual(__p5.AppState.planningMode, 'auto', 'auto option should store generated-schedule mode');
}

function testBlankScheduleConstructorKeepsSelectedWindowAndGapQuartersEmpty() {
  const context = loadApp();
  const { __p5 } = context;
  assert.strictEqual(typeof __p5.buildBlankScheduleForProfile, 'function', 'blank constructor helper should exist');
  const profile = {
    ...__p5.AppState.profile,
    currentTerm: 'F',
    currentYear: 2026,
    currentLevel: 1,
    studentType: 'undergrad',
    targetGradTerm: 'S',
    targetGradYear: 2028,
    includeSummer: true,
    summerYears: [2027],
    gapEnabled: true,
    gapType: 'quarter',
    gapTerm: 'W',
    gapYear: 2027
  };
  const blank = __p5.buildBlankScheduleForProfile(profile);
  const flat = [];
  blank.forEach((year, yearIdx) => {
    Object.entries(year.quarters).forEach(([term, courses]) => flat.push({ yearIdx, academicStart: year.academicStart, term, courses }));
  });
  assert(flat.some(q => q.term === 'SU' && q.academicStart === 2026), 'selected Summer 2027 should be present as an empty constructor quarter');
  assert(flat.some(q => q.term === 'W' && q.academicStart === 2026 && q.courses[0] === '_GAP'), 'selected Winter 2027 gap should be preserved');
  assert(flat.every(q => q.courses.length === 0 || q.courses[0] === '_GAP'), 'constructor schedule should contain no preplanned classes');
}

function testBlankScheduleRulesPopupIsShortAndActionable() {
  const context = loadApp();
  const { __p5, document } = context;
  assert.strictEqual(typeof __p5.showBlankScheduleRules, 'function', 'constructor should show a basic-rules popup');
  __p5.showBlankScheduleRules();
  const body = document.getElementById('warning-content').innerHTML;
  assert(body.includes('Start with prerequisites'), `rules should mention prerequisites; got ${body}`);
  assert(body.includes('Aim for 15–17 credits'), `rules should mention Artem's credit-first target; got ${body}`);
  assert(body.includes('Use + Add Course'), `rules should tell students how to start adding courses; got ${body}`);
  assert(body.includes('requirements tracker'), `rules should point to live requirement tracking; got ${body}`);
}

function testGraduateCatalogIsSeparateSearchOnlyAndVisibleInManualSearch() {
  const { __p5 } = loadApp();
  assert(__p5.COURSES['CSE 136'], 'reviewed undergrad CSE 136 should be merged into the undergraduate scheduler catalog');
  assert(!__p5.COURSES['CSE 196A'], 'CSE 196A should stay out for now because permission text needs warning QA');
  assert(!__p5.COURSES['CSE 245'], 'graduate CSE 245 must not be in the undergraduate scheduler COURSES object');
  assert(__p5.GRADUATE_COURSES && __p5.GRADUATE_COURSES['CSE 245'], 'graduate CSE 245 should live in the separate graduate catalog');
  assert.strictEqual(__p5.GRADUATE_COURSES['CSE 245'].searchOnly, true, 'graduate courses should be marked searchOnly');

  const results = __p5.searchCourses('CSE 245');
  assert(results.some(result => result.code === 'CSE 245' && result.source === 'graduate'), 'manual academic-history search should include graduate catalog courses');
}

function testGraduateRestrictionWarningsUseOfficialCatalogText() {
  const { __p5 } = loadApp();
  const course = __p5.courseByCode('CSE 245');
  assert(course, 'courseByCode should find separate graduate catalog records');
  const html = __p5.restrictionWarningHtmlForCourse('CSE 245');
  assert(html.includes('Graduate/search-only course'), `warning should label graduate/search-only courses; got ${html}`);
  assert(html.includes('Enrollment is restricted to graduate students.'), `warning should preserve official enrollment text; got ${html}`);
  assert(html.includes('official UCSC Catalog'), `warning should tell students to verify official catalog/advising; got ${html}`);
}

function testAddingGraduateCompletedCourseWarnsButDoesNotMergeIntoSchedulerCatalog() {
  const context = loadApp();
  const { __p5, document } = context;
  __p5.addCompletedCourse('CSE 245');
  assert(__p5.AppState.profile.completedCourses.includes('CSE 245'), 'student can manually add searched graduate courses to completed history');
  assert(!__p5.COURSES['CSE 245'], 'adding a graduate course to history must not mutate undergraduate scheduler COURSES');
  const selectedHtml = document.getElementById('selected-courses-list').innerHTML;
  assert(selectedHtml.includes('Computational Models of Discourse and Dialogue'), `completed-course chip should render graduate title from searchable catalog; got ${selectedHtml}`);
  const warningHtml = document.getElementById('warning-content').innerHTML;
  assert(warningHtml.includes('Graduate/search-only course'), `manual add should show a warning; got ${warningHtml}`);
}

const tests = [
  testGraduationDurationCountsOnlyFallWinterSpring,
  testGraduationDefaultAutoSelectsFourYearSpringTarget,
  testSummerPickerLetsStudentsChooseSpecificSummerYears,
  testMajorSpecificLowerDivisionSuggestionsDifferByMajor,
  testCourseCardsUseRequirementTypeColors,
  testCourseDetailUsesDatabaseCatalogUrlAndNoRmpUi,
  testCourseDetailCatalogLinksComeFromCourseDatabaseOnly,
  testAllRealCoursesHaveDatabaseCatalogUrlsForDetailPopup,
  testProfessorPreferenceSectionRemovedFromHtml,
  testNavbarIncludesUcscRateMyProfessorsResourceButton,
  testWordExportOptionIsRemovedFromScheduleAndLanding,
  testLandingDoesNotClaimQuarterAvailabilityIsRespected,
  testGeneratedScheduleWarningUsesSelectedMajorCatalogLinkAndAvailabilityCaveat,
  testAcademicHistoryCheckboxSectionsAreProminentAndIncludeAhiOptions,
  testCollegeAffiliationBlocksAcademicHistoryNextUntilSelected,
  testDragMoveCourseMutatesScheduleOnceAndRevalidates,
  testDragCanReorderCoursesWithinSameQuarter,
  testDragMoveIgnoresSameQuarterAndGapTargets,
  testCourseCardsAndQuarterColumnsExposeDragDropUx,
  testValidationAlertsSurfacePrerequisiteViolationsAfterManualMoves,
  testDragMoveBlockedWhenPrerequisitesWouldBeMissing,
  testDragMoveAllowedButWarnsWhenQuarterExceedsNineteenCredits,
  testDragMoveAllowedButWarnsWhenSourceDropsBelowTwelveCredits,
  testNavbarReviewButtonOpensGoogleFormDirectly,
  testReviewPromptIsShortAnonymousAndActionFocused,
  testReviewPromptSchedulesOneMinuteAfterScheduleGeneration,
  testReviewPromptUsesLiveGoogleFormUrlByDefault,
  testConfiguredReviewFormOpensSafelyInNewTab,
  testLandingOffersPlanForMeAndBuildFromScratchChoices,
  testPlanningModeButtonsSelectWizardMode,
  testBlankScheduleConstructorKeepsSelectedWindowAndGapQuartersEmpty,
  testBlankScheduleRulesPopupIsShortAndActionable,
  testGraduateCatalogIsSeparateSearchOnlyAndVisibleInManualSearch,
  testGraduateRestrictionWarningsUseOfficialCatalogText,
  testAddingGraduateCompletedCourseWarnsButDoesNotMergeIntoSchedulerCatalog
];

let passed = 0;
for (const test of tests) {
  test();
  passed++;
  console.log(`✓ ${test.name}`);
}
console.log(`\n${passed}/${tests.length} Prototype 5 UI upgrade tests passed`);
