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
  querySelector(selector) {
    if (selector === 'input') return this.children.find(child => child.tagName === 'INPUT') || null;
    return null;
  }
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
        const first = (document.__majorConcentrations && document.__majorConcentrations[0]) || document.__majorConcentration || '';
        return { value: first };
      }
      if (selector === 'input[name="ge-concentration"]:checked') {
        const first = (document.__geConcentrations && document.__geConcentrations[0]) || document.__geConcentration || '';
        return { value: first };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.view') return ['landing', 'wizard', 'schedule'].map(name => document.getElementById(`view-${name}`));
      if (selector === '.wizard-step') return [1, 2, 3, 4].map(n => document.getElementById(`wizard-step-${n}`));
      if (selector === '.progress-dot') return [0, 1, 2, 3].map(i => document.getElementById(`progress-dot-${i}`));
      if (selector === 'input[name="major-concentration"]:checked') {
        return (document.__majorConcentrations || (document.__majorConcentration ? [document.__majorConcentration] : []))
          .map(value => ({ value, checked: true }));
      }
      if (selector === 'input[name="ge-concentration"]:checked') {
        return (document.__geConcentrations || (document.__geConcentration ? [document.__geConcentration] : []))
          .map(value => ({ value, checked: true }));
      }
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
    'check-elwr', 'check-ahi', 'ahi-options', 'check-ahi-us-history-full-year',
    'check-ahi-us-history-half-year', 'check-ahi-american-government-half-year',
    'select-college-affiliation', 'check-college-core-completed', 'college-core-summary',
    'input-prior-credits', 'select-grad-term', 'select-grad-year', 'check-summer',
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
      major: { CS_BS: [
        { id: 'cs_web_software', name: 'Web Software' },
        { id: 'cs_ai_ml', name: 'AI/ML' }
      ] },
      ge: [
        { id: 'ge_arts_humanities', name: 'Arts & Humanities', courses: [], geCodes: [] },
        { id: 'ge_tech_society', name: 'Technology & Society', courses: [], geCodes: [] }
      ]
    },
    COURSES: {
      'COWL 1': { title: 'Academic Literacy and Ethos: Imagining Justice', units: 5, section: ['COLLEGE_CORE'], quarters: ['F'], prereqs: [], desc: '', rmpScore: 0 },
      'STEV 1': { title: 'Academic Literacy and Ethos: Self and Society', units: 5, section: ['COLLEGE_CORE'], quarters: ['F'], prereqs: [], desc: '', rmpScore: 0 },
      'STEV 2': { title: 'Self and Society 2', units: 5, section: ['COLLEGE_CORE'], quarters: ['W'], prereqs: [], desc: '', rmpScore: 0 },
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
  const code = fs.readFileSync(appPath, 'utf8') + '\n;globalThis.__appExports = { AppState, openAddCourseModal, openSwapModal, renderSchedule, renderRequirements, showValidationAlerts, collegeCoreCoursesForProfile };';
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
  document.getElementById('check-ahi').checked = true;
  document.getElementById('check-ahi-us-history-full-year').checked = false;
  document.getElementById('check-ahi-us-history-half-year').checked = true;
  document.getElementById('check-ahi-american-government-half-year').checked = true;
  document.getElementById('select-college-affiliation').value = 'cowell';
  document.getElementById('check-college-core-completed').checked = true;
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
  document.__majorConcentrations = ['cs_web_software', 'cs_ai_ml'];
  document.__geConcentrations = ['ge_arts_humanities', 'ge_tech_society'];
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
  assert.deepStrictEqual(profile.ahiFulfillment, {
    usHistoryFullYear: false,
    usHistoryHalfYear: true,
    americanGovernmentHalfYear: true
  }, `${label} AH&I fulfillment`);
  assert.strictEqual(profile.collegeAffiliation, 'cowell', `${label} college affiliation`);
  assert.strictEqual(profile.collegeCoreCompleted, true, `${label} college core completed flag`);
  assert(profile.completedCourses.includes('COWL 1'), `${label} completedCourses should include selected college core course`);
  assert.strictEqual(profile.concentration, 'cs_web_software', `${label} major concentration`);
  assert.strictEqual(profile.geConcentration, 'ge_arts_humanities', `${label} GE concentration`);
  assert.deepStrictEqual(profile.electiveInterests, ['cs_web_software', 'cs_ai_ml'], `${label} major/elective interest array`);
  assert.deepStrictEqual(profile.geConcentrations, ['ge_arts_humanities', 'ge_tech_society'], `${label} GE interest array`);
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

function testAmericanHistoryInstitutionCheckboxUnfoldsOptionsAndResetsWhenOff() {
  const context = buildContext();
  const { AppState } = loadApp(context);
  setWizardProfile(context.document);
  const ahiToggle = context.document.getElementById('check-ahi');
  const ahiOptions = context.document.getElementById('ahi-options');

  ahiToggle.checked = true;
  ahiToggle.dispatchEvent('change');
  assert.strictEqual(ahiOptions.style.display, 'block', 'checking AH&I should unfold the high-school fulfillment choices');

  context.document.getElementById('btn-wizard-next-1').click();
  context.document.getElementById('btn-wizard-next-2').click();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(AppState.profile.ahiFulfillment)), {
    usHistoryFullYear: false,
    usHistoryHalfYear: true,
    americanGovernmentHalfYear: true
  }, 'academic-history step should store AH&I choices in profile');

  ahiToggle.checked = false;
  ahiToggle.dispatchEvent('change');
  assert.strictEqual(ahiOptions.style.display, 'none', 'unchecking AH&I should collapse the choices');
  assert.strictEqual(context.document.getElementById('check-ahi-us-history-half-year').checked, false, 'collapsing AH&I should clear history half-year choice');
  assert.strictEqual(context.document.getElementById('check-ahi-american-government-half-year').checked, false, 'collapsing AH&I should clear government half-year choice');
}

function testCollegeCoreCompletionAddsSelectedCollegeCourses() {
  const context = buildContext();
  const { AppState, collegeCoreCoursesForProfile } = loadApp(context);
  setWizardProfile(context.document);

  assert.strictEqual(JSON.stringify(collegeCoreCoursesForProfile({ collegeAffiliation: 'stevenson' })), JSON.stringify(['STEV 1', 'STEV 2']), 'Stevenson should map to its two-quarter Fall/Winter college core sequence');

  context.document.getElementById('select-college-affiliation').value = 'stevenson';
  context.document.getElementById('check-college-core-completed').checked = true;
  context.document.getElementById('btn-wizard-next-1').click();
  context.document.getElementById('btn-wizard-next-2').click();

  assert.strictEqual(AppState.profile.collegeAffiliation, 'stevenson', 'academic-history step should store selected college affiliation');
  assert.strictEqual(AppState.profile.collegeCoreCompleted, true, 'academic-history step should store college core completion flag');
  assert(AppState.profile.completedCourses.includes('STEV 1'), 'completed Stevenson core should add STEV 1 to completedCourses');
  assert(AppState.profile.completedCourses.includes('STEV 2'), 'completed Stevenson core should add STEV 2 to completedCourses');
  assert(!AppState.profile.completedCourses.includes('COWL 1'), 'switching colleges should not keep a different college core as completed');
}

function testEarlyCompletionScheduleExplainsHiddenTargetQuarters() {
  const context = buildContext();
  const { AppState } = loadApp(context);
  AppState.profile = { includeSummer: true, targetGradTerm: 'S', targetGradYear: 2030 };
  AppState.validation = { allMet: true };
  AppState.schedule = [{
    label: 'Year 4 (Senior)',
    academicStart: 2029,
    quarters: { F: ['CSE 187'], W: ['CSE 186'] }
  }];

  context.__appExports.renderSchedule();

  const scheduleGrid = context.document.getElementById('schedule-grid');
  assert.strictEqual(scheduleGrid.children.length, 1, 'schedule should render one terminal year section');
  const yearSection = scheduleGrid.children[0];
  assert.strictEqual(yearSection.classList.contains('year-complete-partial'), true, 'partial terminal year should get an explicit styling hook');
  assert(yearSection.children[0].innerHTML.includes('Program complete after Winter 2030'), `year header should explain the actual graduation quarter; got ${yearSection.children[0].innerHTML}`);
  assert(yearSection.children[1].className.includes('partial-year-row'), 'partial terminal year should avoid rendering a blank unused column');
  assert(yearSection.children[2].className.includes('schedule-completion-callout'), 'early completion should render a status callout below the final row');
  assert(yearSection.children[2].innerHTML.includes('finishes earlier than your Spring 2030 target'), `early completion callout should distinguish early completion from extensions; got ${yearSection.children[2].innerHTML}`);
  assert(yearSection.children[2].innerHTML.includes('later target-quarter space is intentionally hidden'), `completion callout should explain why Spring/Summer are absent; got ${yearSection.children[2].innerHTML}`);
}

function testExtendedPartialFinalYearDoesNotClaimEarlyCompletion() {
  const context = buildContext();
  const { AppState } = loadApp(context);
  AppState.profile = { includeSummer: false, targetGradTerm: 'S', targetGradYear: 2030 };
  AppState.validation = { allMet: true };
  AppState.schedule = [{
    label: 'Year 5 (5th Year)',
    academicStart: 2030,
    quarters: { F: ['FREE 3'] }
  }];

  context.__appExports.renderSchedule();

  const yearSection = context.document.getElementById('schedule-grid').children[0];
  assert(yearSection.children[0].innerHTML.includes('Program complete after Fall 2030'), `header should still state the actual completion term; got ${yearSection.children[0].innerHTML}`);
  assert(yearSection.children[2].innerHTML.includes('needs an extra term beyond your Spring 2030 target'), `late partial final year should explain extension, not early completion; got ${yearSection.children[2].innerHTML}`);
  assert(!yearSection.children[2].innerHTML.includes('finishes earlier than your Spring 2030 target'), `late completion must not use early-completion copy; got ${yearSection.children[2].innerHTML}`);
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

function testValidationAlertsExplainLateButCompleteSchedules() {
  const context = buildContext();
  const { AppState, showValidationAlerts } = loadApp(context);
  AppState.profile = { targetGradTerm: 'S', targetGradYear: 2030 };
  AppState.validation = {
    allMet: true,
    totalUnits: 180,
    totalUnitsMet: true,
    upperDivUnits: 60,
    upperDivMet: true,
    priorCredits: 0,
    completedUnits: 0,
    majorReqs: { catalogUrl: 'https://catalog.ucsc.edu/test', totalUnitsRequired: 180, minUpperDivUnits: 60 },
    major: [], ge: [], uc: []
  };
  AppState.schedule = [{ label: 'Year 5', academicStart: 2030, quarters: { F: ['CSE 187'] } }];

  showValidationAlerts();

  const html = context.document.getElementById('alert-box').innerHTML;
  assert(html.includes('All requirements are met'), `complete schedule should still show success; got ${html}`);
  assert(html.includes('alert-timing-note'), `late complete schedule should include a timing note; got ${html}`);
  assert(html.includes('finishes in Fall 2030'), `timing note should name the actual completion term; got ${html}`);
  assert(html.includes('after your Spring 2030 target'), `timing note should compare against the target; got ${html}`);
  assert(html.includes('late start, gap quarters, low max units'), `timing note should explain likely student constraints; got ${html}`);
}

function testValidationWarningTextIsEscaped() {
  const context = buildContext();
  const { AppState, showValidationAlerts } = loadApp(context);
  AppState.profile = {};
  AppState.schedule = [];
  AppState.validation = {
    allMet: false,
    totalUnits: 50,
    totalUnitsMet: false,
    upperDivUnits: 0,
    upperDivMet: false,
    majorReqs: { totalUnitsRequired: 180, minUpperDivUnits: 60 },
    major: [{ name: '<script>alert(1)</script>', fulfilled: false }],
    ge: [], uc: []
  };

  showValidationAlerts();

  const html = context.document.getElementById('alert-box').innerHTML;
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), `warning text should be escaped; got ${html}`);
  assert(!html.includes('<script>alert(1)</script>'), `warning text must not render HTML; got ${html}`);
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

function testManualSuggestionEmptyStatesGiveActionableGuidance() {
  const context = buildContext();
  const { AppState, openAddCourseModal, openSwapModal } = loadApp(context);
  AppState.profile = { major: 'CS_BS', concentration: 'cs_web_software', geConcentration: 'ge_arts_humanities' };
  AppState.schedule = [{ label: 'Senior', academicStart: 2026, quarters: { W: ['CSE 186'], S: [] } }];
  context.Scheduler.searchAddable = () => [];
  context.Scheduler.getReplacements = () => [];

  openAddCourseModal(0, 'W');
  const addHtml = context.document.getElementById('swap-content').innerHTML;
  assert(addHtml.includes('suggestion-empty-state'), `add-course no-result state should use the product empty-state component; got ${addHtml}`);
  assert(addHtml.includes('No courses fit Winter right now'), `add-course empty state should name the quarter; got ${addHtml}`);
  assert(addHtml.includes('Try a different quarter'), `add-course empty state should suggest a next action; got ${addHtml}`);
  assert(addHtml.includes('role="status"'), `add-course empty state should be announced to assistive tech; got ${addHtml}`);

  const addSearch = context.document.getElementById('add-search-input');
  addSearch.value = '<script>alert(1)</script>';
  addSearch.dispatchEvent('input');
  const addSearchHtml = context.document.getElementById('add-list-container').innerHTML;
  assert(addSearchHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), `searched text should be escaped in add-course empty state; got ${addSearchHtml}`);
  assert(!addSearchHtml.includes('<script>alert(1)</script>'), `searched text must not render as HTML; got ${addSearchHtml}`);

  openSwapModal('CSE 186', 'W', 0);
  const swapHtml = context.document.getElementById('swap-content').innerHTML;
  assert(swapHtml.includes('suggestion-empty-state'), `swap no-result state should use the product empty-state component; got ${swapHtml}`);
  assert(swapHtml.includes('No replacement fits Winter right now'), `swap empty state should name the quarter; got ${swapHtml}`);
  assert(swapHtml.includes('Keep CSE 186'), `swap empty state should explain the safe fallback; got ${swapHtml}`);
  assert(swapHtml.includes('role="status"'), `swap empty state should be announced to assistive tech; got ${swapHtml}`);

  const swapSearch = context.document.getElementById('swap-search-input');
  swapSearch.value = 'biology & society';
  swapSearch.dispatchEvent('input');
  const swapSearchHtml = context.document.getElementById('swap-list-container').innerHTML;
  assert(swapSearchHtml.includes('biology &amp; society'), `searched text should be escaped in swap empty state; got ${swapSearchHtml}`);
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

function testRequirementsPanelShowsSelectedCollegeCoreRequirement() {
  const context = buildContext();
  const { AppState, renderRequirements } = loadApp(context);
  AppState.profile = { collegeAffiliation: 'stevenson', collegeCoreCompleted: false };
  AppState.validation = {
    allMet: false,
    totalUnits: 0,
    totalUnitsMet: true,
    upperDivUnits: 0,
    upperDivMet: true,
    priorCredits: 0,
    completedUnits: 0,
    majorReqs: { totalUnitsRequired: 180, minUpperDivUnits: 60 },
    major: [],
    ge: [],
    uc: [],
    collegeCore: [{
      id: 'COLLEGE_CORE',
      name: 'Stevenson College Core',
      fulfilled: false,
      selectedCourses: ['STEV 1'],
      missing: ['STEV 2'],
      neededCount: 2,
      fulfilledCount: 1
    }]
  };

  renderRequirements();
  const html = context.document.getElementById('requirements-panel').innerHTML;
  assert(html.includes('College Core'), `requirements panel should include a College Core section; got ${html}`);
  assert(html.includes('Stevenson College Core'), `requirements panel should name selected college core requirement; got ${html}`);
  assert(html.includes('STEV 1'), `requirements panel should show completed/selected Stevenson Fall core; got ${html}`);
  assert(html.includes('Missing: STEV 2'), `requirements panel should show missing Stevenson Winter core; got ${html}`);
}

const tests = [
  testWizardProfileFlowsIntoGeneratedScheduleAndManualRecommendations,
  testAmericanHistoryInstitutionCheckboxUnfoldsOptionsAndResetsWhenOff,
  testCollegeCoreCompletionAddsSelectedCollegeCourses,
  testEarlyCompletionScheduleExplainsHiddenTargetQuarters,
  testExtendedPartialFinalYearDoesNotClaimEarlyCompletion,
  testGenerateShowsBananaSlugLoadingBeforeScheduleIsReady,
  testGenerateFailureShowsFriendlyErrorAndCleansUp,
  testValidationAlertsExplainLateButCompleteSchedules,
  testValidationWarningTextIsEscaped,
  testManualSuggestionModalsRenderReasonChips,
  testManualSuggestionEmptyStatesGiveActionableGuidance,
  testTranscriptFilePickerRejectsNonPdfBeforeParsing,
  testTranscriptUploadSuccessAddsRecognizedCourses,
  testRequirementsPanelShowsSelectedCollegeCoreRequirement
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
