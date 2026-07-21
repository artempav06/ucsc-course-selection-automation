// ============================================================
// engine.js — Prototype 2: Decision-Tree Schedule Generator
// Single walk() for all majors. Concentration-driven elective ranking.
// ============================================================

function profileSatisfiedVirtualCourses(profile) {
  const virtual = [];
  if (profile && profile.elwrSatisfied) virtual.push("WRIT 1");
  if (profile && profile.collegeCoreCompleted) virtual.push(...collegeCoreCoursesForProfile(profile));
  return virtual;
}

function collegeCoreRequirementMap() {
  if (typeof COLLEGE_CORE_REQUIREMENTS !== "undefined") return COLLEGE_CORE_REQUIREMENTS;
  return {
    cowell: { name: "Cowell College", courses: ["COWL 1"] },
    stevenson: { name: "Stevenson College", courses: ["STEV 1", "STEV 2"] },
    crown: { name: "Crown College", courses: ["CRWN 1"] },
    merrill: { name: "Merrill College", courses: ["MERR 1"] },
    porter: { name: "Porter College", courses: ["PRTR 1"] },
    kresge: { name: "Kresge College", courses: ["KRSG 1"] },
    oakes: { name: "Oakes College", courses: ["OAKS 1"] },
    rachel_carson: { name: "Rachel Carson College", courses: ["CRSN 1"] },
    college_nine: { name: "College Nine", courses: ["CLNI 1"] },
    john_r_lewis: { name: "John R. Lewis College / College Ten", courses: ["JRLC 1"] }
  };
}

function collegeCoreCoursesForProfile(profile = {}) {
  const req = collegeCoreRequirementMap()[profile?.collegeAffiliation || ""];
  return [...new Set((req?.courses || []).filter(code => typeof COURSES !== "undefined" && COURSES[code]))];
}

function collegeCoreRequirementForProfile(profile = {}) {
  const collegeId = profile?.collegeAffiliation || "";
  const req = collegeCoreRequirementMap()[collegeId];
  const courses = collegeCoreCoursesForProfile(profile);
  if (!req || courses.length === 0) return null;
  return {
    id: "PROFILE:COLLEGE_CORE",
    sourceId: "collegeAffiliation",
    domain: "college_core",
    name: `${req.name} Core`,
    type: "college_core_courses",
    collegeId,
    courses,
    options: [{ label: `${req.name} Core`, courses: courses.slice() }],
    minChoices: courses.length,
    metadata: {
      timing: collegeId === "stevenson"
        ? "Stevenson requires STEV 1 in freshman Fall and STEV 2 in freshman Winter."
        : "Residential college core should be taken in freshman Fall."
    },
    original: req
  };
}

function effectiveCompletedCourses(profile) {
  const completed = Array.isArray(profile?.completedCourses) ? profile.completedCourses : [];
  return [...new Set([...completed, ...profileSatisfiedVirtualCourses(profile)])];
}

function ahiFulfillmentFor(profile, reqId) {
  const ahi = profile?.ahiFulfillment || {};
  if (reqId === "AH") return !!(ahi.usHistoryFullYear || ahi.usHistoryHalfYear);
  if (reqId === "AI") return !!(ahi.usHistoryFullYear || ahi.americanGovernmentHalfYear);
  return false;
}

function buildNormalizedRequirementSet(profile) {
  const majorId = (profile && profile.major) || "CS_BA";
  const major = (typeof MAJOR_REQUIREMENTS !== "undefined" && MAJOR_REQUIREMENTS[majorId])
    || CS_BA_REQUIREMENTS;
  const normalizer = (typeof RequirementNormalizer !== "undefined") ? RequirementNormalizer : null;
  if (!normalizer || typeof normalizer.normalizeRequirementSet !== "function") return null;
  const normalizedProfile = {
    ...(profile || {}),
    maxUnitsPerQuarter: (profile && typeof profile.maxUnitsPerQuarter === "number")
      ? profile.maxUnitsPerQuarter
      : (profile ? profile.maxUnits : undefined),
    allowSummer: Boolean(profile && profile.includeSummer)
  };
  const set = normalizer.normalizeRequirementSet({
    major,
    geRequirements: (typeof GE_REQUIREMENTS !== "undefined") ? GE_REQUIREMENTS : [],
    ucRequirements: (typeof UC_REQUIREMENTS !== "undefined") ? UC_REQUIREMENTS : [],
    profile: normalizedProfile
  });
  const collegeCoreRequirement = collegeCoreRequirementForProfile(profile);
  if (set && collegeCoreRequirement) set.requirements.push(collegeCoreRequirement);
  return set;
}

const Validator = {

  prereqsMet(prereqs, completedCourses) {
    if (!prereqs || prereqs.length === 0) return true;
    return prereqs.every(orGroup =>
      orGroup.some(course => completedCourses.has(course))
    );
  },

  validateMajor(plannedCourses, requirements) {
    const results = [];
    const planned = new Set(plannedCourses);

    const pickOnePeers = new Map();
    for (const cat of requirements.categories) {
      if (cat.type === "pick_one") {
        for (const c of (cat.courses || [])) {
          if (!pickOnePeers.has(c)) pickOnePeers.set(c, new Set());
          for (const alt of cat.courses) pickOnePeers.get(c).add(alt);
        }
      }
    }

    for (const cat of requirements.categories) {
      const status = {
        id: cat.id, name: cat.name, description: cat.description,
        fulfilled: false, selectedCourses: [], neededCount: 0, fulfilledCount: 0
      };

      switch (cat.type) {
        case "all_required": {
          status.neededCount = cat.courses.length;
          const satisfied = [], missing = [];
          for (const c of cat.courses) {
            if (planned.has(c)) { satisfied.push(c); }
            else {
              const peers = pickOnePeers.get(c);
              const alt = peers && [...peers].find(a => a !== c && planned.has(a));
              alt ? satisfied.push(alt) : missing.push(c);
            }
          }
          status.selectedCourses = satisfied;
          status.fulfilledCount = satisfied.length;
          status.fulfilled = missing.length === 0;
          status.missing = missing;
          break;
        }
        case "choose_group":
          status.neededCount = 1;
          for (const group of cat.groups) {
            if (group.courses.every(c => planned.has(c))) {
              status.fulfilled = true;
              status.selectedCourses = group.courses;
              status.fulfilledCount = 1;
              break;
            }
          }
          if (!status.fulfilled) {
            for (const group of cat.groups) {
              const present = group.courses.filter(c => planned.has(c));
              if (present.length > status.selectedCourses.length) status.selectedCourses = present;
            }
            status.fulfilledCount = status.selectedCourses.length;
          }
          break;
        case "pick_one":
          status.neededCount = 1;
          status.selectedCourses = cat.courses.filter(c => planned.has(c));
          status.fulfilledCount = Math.min(status.selectedCourses.length, 1);
          status.fulfilled = status.selectedCourses.length >= 1;
          break;
        case "pick_n": {
          status.neededCount = cat.n;
          const allOptions = cat.courses || [];
          status.selectedCourses = allOptions.filter(c => planned.has(c));
          const dcCat = requirements.categories.find(r => r.id === "DC");
          if (dcCat && cat.id !== "DC" && !/capstone can count/i.test(cat.description || "")) {
            const usedDC = (dcCat.courses || []).filter(c => planned.has(c));
            status.selectedCourses = status.selectedCourses.filter(c => !usedDC.includes(c));
          }
          status.fulfilledCount = Math.min(status.selectedCourses.length, cat.n);
          status.fulfilled = status.selectedCourses.length >= cat.n;
          break;
        }
      }
      results.push(status);
    }
    return results;
  },

  validateGE(plannedCourses) {
    return GE_REQUIREMENTS.map(ge => {
      const satisfied = plannedCourses.filter(code => {
        const course = COURSES[code];
        if (!course) return false;
        if (course.ge === ge.id) return true;
        if (ge.subcategories && ge.subcategories.includes(course.ge)) return true;
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) return true;
        return false;
      });
      const fromList = (ge.courses || []).filter(c => plannedCourses.includes(c));
      const all = [...new Set([...satisfied, ...fromList])];
      return { id: ge.id, name: ge.name, fulfilled: all.length >= ge.needed, courses: all, note: ge.note };
    });
  },

  validateUC(plannedCourses, profile) {
    return UC_REQUIREMENTS.map(req => {
      let satisfied = req.courses.filter(c => plannedCourses.includes(c));
      for (const code of plannedCourses) {
        const course = COURSES[code];
        if (course && course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) {
          if (!satisfied.includes(code)) satisfied.push(code);
        }
      }
      let isFulfilled = satisfied.length >= req.needed;
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) {
        isFulfilled = true;
        if (!satisfied.includes("WRIT 1")) satisfied.push("WRIT 1");
      }
      if ((req.id === "AH" || req.id === "AI") && ahiFulfillmentFor(profile, req.id)) isFulfilled = true;
      return { id: req.id, name: req.name, fulfilled: isFulfilled, courses: satisfied, note: req.note };
    });
  },

  validateCollegeCore(plannedCourses, profile) {
    const req = collegeCoreRequirementForProfile(profile);
    if (!req) return [];
    const planned = new Set(plannedCourses);
    const selectedCourses = req.courses.filter(code => planned.has(code));
    const missing = req.courses.filter(code => !planned.has(code));
    return [{
      id: req.id,
      name: req.name,
      description: req.metadata.timing,
      fulfilled: missing.length === 0,
      selectedCourses,
      courses: selectedCourses,
      missing,
      neededCount: req.courses.length,
      fulfilledCount: selectedCourses.length
    }];
  },

  validatePrerequisiteChronology(schedule, completedCourses = []) {
    const completedBefore = new Set(completedCourses || []);
    const violations = [];
    for (const year of schedule || []) {
      for (const term of ["F", "W", "S", "SU"]) {
        const quarterCourses = (year.quarters && year.quarters[term]) || [];
        const sameQuarter = new Set(quarterCourses);
        const snapshot = new Set(completedBefore);
        for (const code of quarterCourses) {
          if (code === "_GAP" || String(code).startsWith("FREE")) continue;
          const course = COURSES[code];
          if (!course) continue;
          const coursePrereqs = Array.isArray(course.prereqs) ? course.prereqs : [];
          const concurrentPrereqs = Array.isArray(course.concurrentPrereqs) ? course.concurrentPrereqs : [];
          if (coursePrereqs.length === 0 && concurrentPrereqs.length === 0) continue;
          const priorContext = new Set(snapshot);
          if (course.labCoreq && sameQuarter.has(course.labCoreq)) priorContext.add(course.labCoreq);
          const concurrentContext = new Set(priorContext);
          for (const group of concurrentPrereqs) {
            for (const option of group || []) {
              if (sameQuarter.has(option)) concurrentContext.add(option);
            }
          }
          const missingGroups = [];
          for (const group of coursePrereqs) {
            if (!group.some(option => priorContext.has(option))) missingGroups.push(group.slice());
          }
          for (const group of concurrentPrereqs) {
            if (!group.some(option => concurrentContext.has(option))) missingGroups.push(group.slice());
          }
          if (missingGroups.length) {
            violations.push({
              course: code,
              term,
              year: year.label,
              quarter: `${year.label} ${term}`,
              missingGroups
            });
          }
        }
        for (const code of quarterCourses) completedBefore.add(code);
      }
    }
    return violations;
  },

  validateSchedule(schedule, profile) {
    const plannedFromSchedule = [];
    for (const year of schedule)
      for (const quarter of Object.values(year.quarters))
        plannedFromSchedule.push(...quarter);
    const completed = effectiveCompletedCourses(profile);
    const allCourses = [...plannedFromSchedule, ...completed];

    const majorId = (profile && profile.major) || "CS_BA";
    const majorReqs = (typeof MAJOR_REQUIREMENTS !== "undefined" && MAJOR_REQUIREMENTS[majorId])
      || CS_BA_REQUIREMENTS;

    const majorResults = this.validateMajor(allCourses, majorReqs);
    const geResults    = this.validateGE(allCourses);
    const ucResults    = this.validateUC(allCourses, profile);
    const collegeCoreResults = this.validateCollegeCore(allCourses, profile);
    const prereqViolations = this.validatePrerequisiteChronology(schedule, completed);

    let totalUnits = 0;
    plannedFromSchedule.forEach(c => { if (COURSES[c]) totalUnits += COURSES[c].units; });
    completed.forEach(c => { if (COURSES[c]) totalUnits += COURSES[c].units; });
    if (profile && profile.priorCredits) totalUnits += profile.priorCredits;

    let upperDivUnits = 0;
    [...plannedFromSchedule, ...completed].forEach(c => {
      const course = COURSES[c];
      if (course && course.division === "upper") upperDivUnits += course.units;
    });

    const result = {
      major: majorResults, ge: geResults, uc: ucResults,
      requirementSet: buildNormalizedRequirementSet(profile),
      totalUnits, upperDivUnits,
      priorCredits: profile ? (profile.priorCredits || 0) : 0,
      completedUnits: completed.reduce((s, c) => s + (COURSES[c]?.units || 0), 0),
      totalUnitsMet:  totalUnits    >= majorReqs.totalUnitsRequired,
      upperDivMet:    upperDivUnits >= majorReqs.minUpperDivUnits,
      allMajorMet: majorResults.every(r => r.fulfilled),
      allGEMet:    geResults.every(r => r.fulfilled),
      allUCMet:    ucResults.every(r => r.fulfilled),
      prereqViolations,
      prerequisitesMet: prereqViolations.length === 0,
      majorReqs
    };
    if (collegeCoreResults.length) {
      result.collegeCore = collegeCoreResults;
      result.allCollegeCoreMet = collegeCoreResults.every(r => r.fulfilled);
    }
    result.allMet = result.allMajorMet && result.allGEMet && result.allUCMet
                    && (!collegeCoreResults.length || result.allCollegeCoreMet)
                    && result.totalUnitsMet && result.upperDivMet && result.prerequisitesMet;
    return result;
  },

  validateAll(schedule, profile) {
    return this.validateSchedule(schedule, profile);
  }
};


// ------------------------------------------------------------
// SCHEDULER
// ------------------------------------------------------------

const Scheduler = {

  collegeCoreCoursesForProfile(profile = {}) {
    return collegeCoreCoursesForProfile(profile);
  },

  buildRequirementSet(profile) {
    return buildNormalizedRequirementSet(profile);
  },

  collectRequirements(profile) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.collect !== "function") return null;
    return collector.collect(this.buildRequirementSet(profile));
  },

  profileGEInterests(profile) {
    const values = [];
    if (profile && Array.isArray(profile.geConcentrations)) values.push(...profile.geConcentrations);
    if (profile && profile.geConcentration) values.push(profile.geConcentration);
    return [...new Set(values.filter(Boolean))].slice(0, 2);
  },

  profileElectiveInterests(profile) {
    const values = [];
    if (profile && Array.isArray(profile.electiveInterests)) values.push(...profile.electiveInterests);
    if (profile && profile.concentration) values.push(profile.concentration);
    return [...new Set(values.filter(Boolean))].slice(0, 2);
  },

  normalMaxUnits(profile) {
    const requested = profile && Number.isFinite(parseInt(profile.maxUnits, 10)) ? parseInt(profile.maxUnits, 10) : 19;
    if (requested > 19) return (profile && profile.allowSoftOverload) ? requested : 19;
    return requested;
  },

  effectiveMaxUnits(profile) {
    const cap = this.normalMaxUnits(profile);
    const engineeringSoft20Majors = new Set(["CE_BS", "EE_BS", "RE_BS"]);
    if (cap === 19 && profile && engineeringSoft20Majors.has(profile.major)) return 20;
    return cap;
  },

  creditLoadBand(units, profile) {
    const min = profile && Number.isFinite(parseInt(profile.minUnits, 10)) ? parseInt(profile.minUnits, 10) : 12;
    const cap = this.effectiveMaxUnits(profile);
    if (units < min) return "under_min";
    if (units <= 14) return "low";
    if (units <= 17) return "target";
    if (units <= cap) return "acceptable_high";
    return "over_cap";
  },

  quarterUnits(courses) {
    return (courses || []).reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
  },

  quarterTypeUnits(courses, courseTypeMap) {
    const out = {};
    for (const code of courses || []) {
      const type = (courseTypeMap && courseTypeMap.get(code)) || "other";
      out[type] = (out[type] || 0) + (COURSES[code]?.units || 0);
    }
    return out;
  },

  isLowUnitCompanion(code) {
    const course = COURSES[code];
    if (!course) return false;
    if ((course.units || 0) <= 2) return true;
    if (/lab|laboratory|seminar|practicum/i.test(course.title || "")) return true;
    return Boolean(course.labCoreq || Object.values(COURSES).some(c => c && c.labCoreq === code));
  },

  distributionRequirements() {
    return [
      ...((typeof GE_REQUIREMENTS !== "undefined") ? GE_REQUIREMENTS : []),
      ...((typeof UC_REQUIREMENTS !== "undefined") ? UC_REQUIREMENTS : [])
    ];
  },

  geRequirementForFamily(familyId) {
    return this.distributionRequirements()
      .find(ge => ge.id === familyId || (ge.subcategories || []).includes(familyId));
  },

  geFamilyOfCode(geCode) {
    if (!geCode) return null;
    const req = this.geRequirementForFamily(geCode);
    return req ? req.id : geCode;
  },

  geFamiliesOfCourse(code) {
    const course = COURSES[code];
    const families = new Set();
    if (!course) return families;
    if (course.ge) families.add(this.geFamilyOfCode(course.ge));
    for (const ge of this.distributionRequirements()) {
      if ((ge.courses || []).includes(code) || (ge.autoSatisfiedBy || []).includes(code)) families.add(ge.id);
      if (course.alsoSatisfies && course.alsoSatisfies.includes(ge.id)) families.add(ge.id);
      if (course.alsoSatisfies && (ge.subcategories || []).some(sub => course.alsoSatisfies.includes(sub))) families.add(ge.id);
    }
    families.delete(null);
    return families;
  },

  geFamilyOfCourse(code) {
    return [...this.geFamiliesOfCourse(code)][0] || null;
  },

  geFamiliesSatisfiedBy(courses) {
    const families = new Set();
    for (const code of courses || []) {
      for (const family of this.geFamiliesOfCourse(code)) families.add(family);
    }
    return families;
  },

  courseSatisfiesGEFamily(code, familyId) {
    return this.geFamiliesOfCourse(code).has(this.geFamilyOfCode(familyId));
  },

  majorRequiredCourseSet(profile) {
    const majorId = (profile && profile.major) || "CS_BA";
    const reqs = (typeof MAJOR_REQUIREMENTS !== "undefined" && MAJOR_REQUIREMENTS[majorId]) || CS_BA_REQUIREMENTS;
    const required = new Set();
    const visitCat = cat => {
      if (!cat) return;
      if (cat.type === "all_required") (cat.courses || []).forEach(c => required.add(c));
      if (cat.type === "choose_group") (cat.groups || []).forEach(g => (g.courses || []).forEach(c => required.add(c)));
    };
    (reqs.categories || []).forEach(visitCat);
    return required;
  },

  stillNeededGEFamilies(plannedOrCompletedCourses, profile) {
    const satisfied = this.geFamiliesSatisfiedBy(plannedOrCompletedCourses || []);
    const needed = new Set();
    for (const ge of this.distributionRequirements()) {
      if (!satisfied.has(ge.id)) needed.add(ge.id);
    }
    return needed;
  },

  isRedundantGE(code, plannedOrCompletedCourses, profile) {
    const families = this.geFamiliesOfCourse(code);
    if (families.size === 0) return false;
    if (this.majorRequiredCourseSet(profile).has(code)) return false;
    const needed = this.stillNeededGEFamilies(plannedOrCompletedCourses, profile);
    return ![...families].some(family => needed.has(family));
  },

  courseInterestMatches(code, profile) {
    const concs = COURSES[code]?.concentrations || [];
    const electiveMatches = this.profileElectiveInterests(profile).filter(id => concs.includes(id));
    const geMatches = this.profileGEInterests(profile).filter(id => concs.includes(id));
    return { elective: electiveMatches, ge: geMatches };
  },

  geInterestMatches(code, profile) {
    const matches = this.courseInterestMatches(code, profile).ge.slice();
    if (typeof CONCENTRATIONS !== "undefined") {
      for (const id of this.profileGEInterests(profile)) {
        const group = (CONCENTRATIONS.ge || []).find(g => g.id === id);
        if (!group) continue;
        if ((group.courses || []).includes(code) || [...this.geFamiliesOfCourse(code)].some(f => (group.geCodes || []).some(g => this.geFamilyOfCode(g) === f))) {
          matches.push(id);
        }
      }
    }
    return [...new Set(matches)];
  },

  interestScore(code, profile, context = {}) {
    const course = COURSES[code];
    if (!course) return 0;
    let score = 0;
    const concs = course.concentrations || [];
    const electiveMatches = this.profileElectiveInterests(profile).filter(id => concs.includes(id));
    const geMatches = this.geInterestMatches(code, profile);
    score += electiveMatches.length * 120;
    score += geMatches.length * 80;
    if (context.geGroup && (context.geGroup.courses || []).includes(code)) score += 100;
    if (context.geGroup && course.ge && (context.geGroup.geCodes || []).some(geCode => this.courseSatisfiesGEFamily(code, geCode))) score += 50;
    if ((electiveMatches.length + geMatches.length) >= 2 || (electiveMatches.length && geMatches.length)) score += 40;
    return score;
  },

  selectMajorCourses(profile) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectMajorCourses !== "function") return null;
    const collected = this.collectRequirements(profile);
    return collector.selectMajorCourses(collected, profile, {
      courses: COURSES,
      rankByConcentration: (pool, concentration, selectionProfile, usedSet, virtuallyPresent) =>
        this.rankByConcentration(
          pool,
          concentration,
          { ...(selectionProfile || {}), ignoreCurrentLevelRestrictionsForPlanning: true },
          usedSet,
          virtuallyPresent
        )
    });
  },

  selectGECourses(profile, used, completedSet) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectGECourses !== "function") return null;
    return collector.selectGECourses(this.collectRequirements(profile), profile, { used, completedSet }, {
      courses: COURSES,
      geRequirements: GE_REQUIREMENTS,
      ucRequirements: UC_REQUIREMENTS,
      concentrations: (typeof CONCENTRATIONS !== "undefined") ? CONCENTRATIONS : {}
    });
  },

  selectUCCourses(profile, used) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectUCCourses !== "function") return null;
    return collector.selectUCCourses(this.collectRequirements(profile), profile, { used }, {
      courses: COURSES,
      ucRequirements: UC_REQUIREMENTS
    });
  },

  selectPrerequisiteCourses(profile, selected, completedSet, used, virtuallyPresent) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectPrerequisiteCourses !== "function") return null;
    return collector.selectPrerequisiteCourses(this.collectRequirements(profile), profile, {
      selected,
      completedSet,
      used,
      virtuallyPresent
    }, {
      courses: COURSES
    });
  },

  selectUpperDivisionSupplement(profile, used, completedSet, virtuallyPresent) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectUpperDivisionSupplement !== "function") return null;
    return collector.selectUpperDivisionSupplement(this.collectRequirements(profile), profile, {
      used,
      completedSet,
      virtuallyPresent
    }, {
      courses: COURSES,
      prereqsMet: (prereqs, prereqContext) => Validator.prereqsMet(prereqs, prereqContext)
    });
  },

  selectFreePaddingCourses(profile, selected, completedSet, used) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectFreePaddingCourses !== "function") return null;
    return collector.selectFreePaddingCourses(this.collectRequirements(profile), profile, {
      selected,
      completedSet,
      used
    }, {
      courses: COURSES,
      countUnits: (selectedCourses, completedCourses, countProfile) => this._countUnits(selectedCourses, completedCourses, countProfile)
    });
  },

  buildNormalizedFillerPool(profile, used, virtuallyPresent) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.buildFillerPool !== "function") return null;
    return collector.buildFillerPool(this.collectRequirements(profile), profile, {
      used,
      virtuallyPresent
    }, {
      courses: COURSES,
      concentrations: (typeof CONCENTRATIONS !== "undefined") ? CONCENTRATIONS : {}
    });
  },

  placeSelectedCourses(profile, remaining, courseTypeMap, fillerPool, completedSet) {
    return this.placeIntoQuarters(remaining, courseTypeMap, fillerPool, completedSet, profile);
  },

  courseUrgency(code, profile, slot = {}, selectedSet = new Set()) {
    const course = COURSES[code];
    if (!course) return 0;
    const levelNum = Number.isFinite(parseInt(slot.levelNum, 10)) ? parseInt(slot.levelNum, 10) : 1;
    const earlyWindow = levelNum <= 2;
    let score = 0;
    if (code === "WRIT 1" || code === "WRIT 2") score += earlyWindow ? 500 : 180;
    if (course.division === "lower" && earlyWindow) score += 160;
    if (course.division === "upper" && earlyWindow) score -= 70;
    if (Array.isArray(course.quarters) && course.quarters.filter(q => q !== "SU").length <= 1) score += 45;
    const selected = selectedSet || new Set();
    for (const candidate of selected) {
      const prereqGroups = [
        ...(Array.isArray(COURSES[candidate]?.prereqs) ? COURSES[candidate].prereqs : []),
        ...(Array.isArray(COURSES[candidate]?.concurrentPrereqs) ? COURSES[candidate].concurrentPrereqs : [])
      ];
      if (prereqGroups.some(group => Array.isArray(group) && group.includes(code))) score += 120;
    }
    const m = code.match(/(\d+)/);
    if (m) score -= Math.floor(parseInt(m[1], 10) / 100);
    score += this.availabilityScore(code, profile) * 0.01;
    return score;
  },

  generate(profile) {
    return this.generateWithExplanation(profile, { includeValidation: false }).schedule;
  },

  generateWithExplanation(profile, options = {}) {
    const completedSet = new Set(effectiveCompletedCourses(profile));
    const used = new Set(completedSet);
    const geConcentration = profile.geConcentration || null;

    const majorId = (profile && profile.major) || "CS_BA";
    const reqs = (typeof MAJOR_REQUIREMENTS !== "undefined" && MAJOR_REQUIREMENTS[majorId])
      || CS_BA_REQUIREMENTS;
    const phaseUnits = courses => (courses || []).reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
    const courseTypeCounts = map => {
      const counts = {};
      for (const type of map.values()) counts[type] = (counts[type] || 0) + 1;
      return counts;
    };

    // --- Phase 1: Select major courses via normalized collector wrapper ---
    const majorSelection = this.selectMajorCourses(profile) || {
      selected: [],
      courseTypes: [],
      virtuallyPresent: []
    };
    const selected = (majorSelection.selected || []).slice();
    selected.forEach(code => used.add(code));
    const courseTypeMap = new Map(majorSelection.courseTypes || []);
    const virtuallyPresent = new Set(majorSelection.virtuallyPresent || []);
    const explanation = {
      phases: {
        majorSelection: {
          courses: selected.slice(),
          count: selected.length,
          units: phaseUnits(selected),
          courseTypes: courseTypeCounts(courseTypeMap),
          virtuallyPresent: [...virtuallyPresent].sort()
        }
      }
    };
    const pushTagged = (code, type) => {
      if (code && COURSES[code] && !used.has(code)) {
        selected.push(code); used.add(code); courseTypeMap.set(code, type);
      }
    };

    // --- Phase 2: GE courses ---
    const geCourses = this.selectGECourses(profile, used, completedSet) || this.pickGE(used, completedSet, geConcentration, profile);
    geCourses.forEach(c => {
      if (c && COURSES[c]) { selected.push(c); courseTypeMap.set(c, "ge"); }
    });
    const geAvailabilityCodes = new Set(geCourses);
    if (geConcentration && typeof CONCENTRATIONS !== "undefined") {
      const geConcGroup = (CONCENTRATIONS.ge || []).find(group => group.id === geConcentration);
      if (geConcGroup) (geConcGroup.courses || []).forEach(code => geAvailabilityCodes.add(code));
    }
    const geAvailabilityScores = {};
    for (const code of geAvailabilityCodes) {
      if (COURSES[code]) geAvailabilityScores[code] = this.availabilityScore(code, profile);
    }
    explanation.phases.geSelection = {
      courses: geCourses.slice(),
      count: geCourses.length,
      units: phaseUnits(geCourses),
      availabilityWindow: this.planningQuarterWindow(profile) || [],
      availabilityScores: geAvailabilityScores
    };

    // --- Phase 3: UC courses ---
    const ucCourses = this.selectUCCourses(profile, used) || this.pickUC(used, profile);
    ucCourses.forEach(c => {
      selected.push(c); used.add(c); courseTypeMap.set(c, "uc");
    });
    explanation.phases.ucSelection = {
      courses: ucCourses.slice(),
      count: ucCourses.length,
      units: phaseUnits(ucCourses)
    };

    // --- Phase 3b: College core courses ---
    const collegeCoreCourses = this.collegeCoreCoursesForProfile(profile);
    collegeCoreCourses.forEach(c => pushTagged(c, "college_core"));
    explanation.phases.collegeCoreSelection = {
      college: profile?.collegeAffiliation || "",
      courses: collegeCoreCourses.slice(),
      count: collegeCoreCourses.length,
      completed: Boolean(profile?.collegeCoreCompleted),
      units: phaseUnits(collegeCoreCourses)
    };

    // --- Phase 4: Expand prereqs ---
    const prereqCourses = this.selectPrerequisiteCourses(profile, selected, completedSet, used, virtuallyPresent)
      || this.expandPrereqs(selected, completedSet, used, virtuallyPresent);
    prereqCourses.forEach(c => pushTagged(c, "prereq"));
    explanation.phases.prerequisiteExpansion = {
      courses: prereqCourses.slice(),
      count: prereqCourses.length,
      units: phaseUnits(prereqCourses)
    };

    // --- Phase 5: Upper-div supplement ---
    const normalizedUDSupplement = this.selectUpperDivisionSupplement(profile, used, completedSet, virtuallyPresent);
    const udAdded = normalizedUDSupplement || [];
    if (!normalizedUDSupplement) this.supplementUpperDiv(udAdded, [], used, completedSet, reqs, majorId, virtuallyPresent);
    udAdded.forEach(c => { selected.push(c); courseTypeMap.set(c, "filler"); });
    explanation.phases.upperDivisionSupplement = {
      courses: udAdded.slice(),
      count: udAdded.length,
      units: phaseUnits(udAdded),
      upperDivUnits: phaseUnits(udAdded.filter(c => COURSES[c]?.division === "upper"))
    };

    // --- Phase 6: FREE pad to unit target ---
    const normalizedFreePadding = this.selectFreePaddingCourses(profile, selected, completedSet, used);
    const freePadding = normalizedFreePadding || [];
    if (!normalizedFreePadding) {
      const targetUnits = reqs.totalUnitsRequired || 180;
      let total = this._countUnits(selected, completedSet, profile);
      for (let i = 1; i <= 30 && total < targetUnits; i++) {
        const code = `FREE ${i}`;
        if (COURSES[code] && !used.has(code)) {
          freePadding.push(code);
          used.add(code);
          total += COURSES[code].units;
        }
      }
    }
    freePadding.forEach(c => { selected.push(c); courseTypeMap.set(c, "filler"); });
    explanation.phases.freePadding = {
      courses: freePadding.slice(),
      count: freePadding.length,
      units: phaseUnits(freePadding),
      targetUnits: reqs.totalUnitsRequired || 180,
      policy: "last-resort unit padding after real major/GE/UC requirements and upper-division supplement have been selected"
    };

    // --- Phase 7: Build filler pool ---
    const normalizedFillerPool = this.buildNormalizedFillerPool(profile, used, virtuallyPresent);
    const fillerPool = normalizedFillerPool || this.buildFillerPool(profile, used, virtuallyPresent);
    const fillerAvailabilityCodes = new Set(fillerPool);
    if (profile && profile.concentration && typeof CONCENTRATIONS !== "undefined") {
      const majorGroups = CONCENTRATIONS.major && CONCENTRATIONS.major[majorId];
      const activeGroup = Array.isArray(majorGroups)
        ? majorGroups.find(group => group.id === profile.concentration)
        : null;
      if (activeGroup) (activeGroup.courses || []).forEach(code => fillerAvailabilityCodes.add(code));
    }
    const fillerAvailabilityScores = {};
    for (const code of fillerAvailabilityCodes) {
      if (COURSES[code]) fillerAvailabilityScores[code] = this.availabilityScore(code, profile);
    }
    explanation.phases.fillerPool = {
      candidates: fillerPool.slice(),
      count: fillerPool.length,
      availabilityWindow: this.planningQuarterWindow(profile) || [],
      availabilityScores: fillerAvailabilityScores
    };

    // --- Phase 8: Place into quarters ---
    const remaining = selected.filter(c => !completedSet.has(c));
    let schedule = this.placeSelectedCourses(profile, remaining, courseTypeMap, fillerPool, completedSet);
    const beforePolicyAudit = this.auditSchedulePolicy(schedule, profile, courseTypeMap);
    const policyRepair = this.repairSchedulePolicy(schedule, profile, courseTypeMap, beforePolicyAudit);
    if (policyRepair.repairsApplied.length > 0) schedule = policyRepair.schedule;
    const afterPolicyAudit = policyRepair.afterRepair;
    schedule.courseTypeMap = courseTypeMap;
    const plannedFromSchedule = [];
    for (const year of schedule) {
      for (const quarter of Object.values(year.quarters)) {
        plannedFromSchedule.push(...quarter.filter(c => c !== "_GAP"));
      }
    }
    explanation.phases.placement = {
      remaining: remaining.slice(),
      remainingCount: remaining.length,
      scheduledCourses: plannedFromSchedule.slice(),
      scheduledCount: plannedFromSchedule.length,
      years: schedule.length,
      courseTypes: courseTypeCounts(courseTypeMap)
    };
    explanation.policyAudit = {
      beforeRepair: beforePolicyAudit,
      repairsApplied: policyRepair.repairsApplied,
      afterRepair: afterPolicyAudit
    };
    if (options.includeValidation !== false) {
      explanation.validation = Validator.validateSchedule(schedule, profile);
      explanation.totals = {
        selectedUnitsBeforePlacement: this._countUnits(selected, completedSet, profile),
        scheduledUnits: explanation.validation.totalUnits - (profile ? (profile.priorCredits || 0) : 0),
        totalUnits: explanation.validation.totalUnits,
        upperDivUnits: explanation.validation.upperDivUnits,
        completedUnits: explanation.validation.completedUnits,
        priorCredits: explanation.validation.priorCredits
      };
    } else {
      explanation.totals = {
        selectedUnitsBeforePlacement: this._countUnits(selected, completedSet, profile),
        scheduledUnits: phaseUnits(plannedFromSchedule) + phaseUnits(profile.completedCourses || []),
        totalUnits: null,
        upperDivUnits: null,
        completedUnits: phaseUnits(profile.completedCourses || []),
        priorCredits: profile ? (profile.priorCredits || 0) : 0
      };
    }
    return { schedule, explanation };
  },

  // --- Schedule policy audit / repair ---

  auditSchedulePolicy(schedule, profile = {}, courseTypeMap = new Map()) {
    const hardErrors = [];
    const warnings = [];
    const quarterDiagnostics = [];
    const completed = new Set(profile.completedCourses || []);
    const seenCourses = new Set(completed);
    const seenGEFamilies = this.geFamiliesSatisfiedBy([...completed]);
    const cap = this.effectiveMaxUnits(profile);
    const majorTypes = new Set(["major_core", "major_elective", "prereq"]);
    const fillerTypes = new Set(["filler", "elective"]);
    const addIssue = (bucket, issue) => bucket.push(issue);

    for (const year of (schedule || [])) {
      for (const [term, quarter] of Object.entries(year.quarters || {})) {
        if (!Array.isArray(quarter) || quarter[0] === "_GAP") continue;
        const courses = quarter.filter(code => code !== "_GAP");
        const units = this.quarterUnits(courses);
        const typeUnits = this.quarterTypeUnits(courses, courseTypeMap);
        const majorUnits = [...majorTypes].reduce((sum, type) => sum + (typeUnits[type] || 0), 0);
        const geUnits = (typeUnits.ge || 0) + (typeUnits.uc || 0);
        const electiveUnits = [...fillerTypes].reduce((sum, type) => sum + (typeUnits[type] || 0), 0);
        const neededBefore = this.stillNeededGEFamilies([...seenCourses], profile);
        const redundantGECourses = [];
        const localGEFamilies = new Set();
        for (const code of courses) {
          const families = this.geFamiliesOfCourse(code);
          for (const family of families) {
            if ((seenGEFamilies.has(family) || localGEFamilies.has(family)) && !this.majorRequiredCourseSet(profile).has(code)) redundantGECourses.push(code);
            localGEFamilies.add(family);
          }
        }
        const diagnostic = {
          yearLabel: year.label,
          term,
          units,
          majorUnits,
          geUnits,
          electiveUnits,
          loadBand: this.creditLoadBand(units, profile),
          neededGEBeforeQuarter: [...neededBefore],
          redundantGECourses: [...new Set(redundantGECourses)],
          earlyLowerDivisionMissing: [],
          fixSuggestions: []
        };
        if (units > cap) {
          const issue = { rule: "over_cap", yearLabel: year.label, term, units, cap };
          addIssue(hardErrors, issue);
          diagnostic.fixSuggestions.push("remove or move flexible filler/GE until the quarter is <= cap");
        }
        if (diagnostic.redundantGECourses.length > 0) {
          addIssue(warnings, { rule: "duplicate_ge_family", yearLabel: year.label, term, courses: diagnostic.redundantGECourses.slice() });
          diagnostic.fixSuggestions.push("swap redundant GE family with a still-needed GE family when one fits");
        }
        const hasFillerBeforeGE = neededBefore.size > 0 && courses.some(code => String(code).startsWith("FREE") || fillerTypes.has(courseTypeMap.get(code)));
        if (hasFillerBeforeGE) {
          addIssue(warnings, { rule: "filler_before_ge_complete", yearLabel: year.label, term, neededGEFamilies: [...neededBefore] });
          diagnostic.fixSuggestions.push("delay filler/FREE until GE/UC families are complete");
        }
        if ((year.levelNum || 1) <= 2) {
          const hasUpperElective = courses.some(code => COURSES[code]?.division === "upper" && courseTypeMap.get(code) === "major_elective");
          if (hasUpperElective) {
            addIssue(warnings, { rule: "early_upper_division_pressure", yearLabel: year.label, term });
            diagnostic.earlyLowerDivisionMissing.push("upper-division elective appears in first two years; verify lower-division foundation is complete or blocked");
          }
        }
        quarterDiagnostics.push(diagnostic);
        for (const code of courses) {
          seenCourses.add(code);
          for (const family of this.geFamiliesOfCourse(code)) seenGEFamilies.add(family);
        }
      }
    }
    return { hardErrors, warnings, quarterDiagnostics };
  },

  repairSchedulePolicy(schedule, profile = {}, courseTypeMap = new Map(), audit = null) {
    const clone = (schedule || []).map(year => ({
      ...year,
      quarters: Object.fromEntries(Object.entries(year.quarters || {}).map(([term, arr]) => [term, Array.isArray(arr) ? [...arr] : arr]))
    }));
    const repairsApplied = [];
    const cap = this.effectiveMaxUnits(profile);
    for (const year of clone) {
      for (const [term, arr] of Object.entries(year.quarters || {})) {
        if (!Array.isArray(arr) || arr[0] === "_GAP") continue;
        let units = this.quarterUnits(arr);
        for (let i = arr.length - 1; i >= 0 && units > cap; i--) {
          const code = arr[i];
          if (!String(code).startsWith("FREE")) continue;
          units -= COURSES[code]?.units || 0;
          arr.splice(i, 1);
          repairsApplied.push({ action: "remove_overflow_free_padding", yearLabel: year.label, term, course: code });
        }
      }
    }
    return {
      schedule: clone,
      repairsApplied,
      beforeRepair: audit || this.auditSchedulePolicy(schedule, profile, courseTypeMap),
      afterRepair: this.auditSchedulePolicy(clone, profile, courseTypeMap)
    };
  },

  // --- Unified category walker ---

  walk(cat, completedSet, used, concentration, chooseGroupCourses, pushTagged, virtuallyPresent, profile) {
    switch (cat.type) {
      case "all_required":
        (cat.courses || []).filter(c => !chooseGroupCourses.has(c)).forEach(c => pushTagged(c, "major_core"));
        break;

      case "choose_group": {
        const groups = cat.groups || [];
        const best = groups.find(g => g.courses.some(c => completedSet.has(c)))
          || groups.find(g => /strongly preferred/i.test(g.label || "") && g.courses.every(c => COURSES[c]))
          || groups.find(g => g.courses.every(c => COURSES[c]))
          || groups[0];
        if (best) best.courses.filter(c => COURSES[c] && !completedSet.has(c)).forEach(c => pushTagged(c, "major_core"));
        break;
      }

      case "pick_one": {
        if ((cat.courses || []).some(c => completedSet.has(c) || used.has(c))) break;
        const pool = (cat.courses || []).filter(c => COURSES[c] && !completedSet.has(c));
        const ranked = this.rankByConcentration(pool, concentration, profile, used, virtuallyPresent || new Set());
        const first = ranked[0];
        if (first) pushTagged(first, "major_core");
        break;
      }

      case "pick_n": {
        const vp = virtuallyPresent || new Set();
        const pool = cat.courses.filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c));
        const alreadySatisfied = cat.courses.filter(c => completedSet.has(c) || used.has(c)).length;
        const needed = Math.max(0, (cat.n || 1) - alreadySatisfied);
        if (needed === 0) break;
        const ranked = this.rankByConcentration(pool, concentration, profile, used, vp);
        ranked.slice(0, needed).forEach(c => pushTagged(c, "major_elective"));
        break;
      }
    }
  },

  coursePreferenceScore(code, profile) {
    if (!profile) return 0;
    const preferred = new Set(profile.preferredCourses || []);
    const avoided = new Set(profile.avoidedCourses || []);
    let score = 0;
    if (preferred.has(code)) score += 1000;
    if (avoided.has(code)) score -= 1000;

    // Professor/RMP preference is a student preference, but it should not dominate
    // hard requirement/path fit. Scale it only when the user says it matters.
    const rmp = COURSES[code]?.rmpScore || 0;
    const importance = profile.profImportance || "medium";
    if (importance === "high") score += rmp * 3;
    else if (importance === "medium") score += rmp;
    else if (importance === "low") score += rmp * 0.25;
    return score;
  },

  planningQuarterWindow(profile) {
    if (typeof RequirementCollector !== "undefined" && RequirementCollector.planningQuarterWindow) {
      return RequirementCollector.planningQuarterWindow(profile);
    }
    if (!profile) return [];
    const termOrder = ["F", "W", "S", "SU"];
    const startYear = this.academicYear(profile.currentTerm || "F", profile.currentYear || 2026);
    const endYear = this.academicYear(profile.targetGradTerm || "S", profile.targetGradYear || (startYear + 4));
    const window = [];
    for (let academicStart = startYear; academicStart <= endYear; academicStart++) {
      for (const term of termOrder) {
        if (term === "SU" && !profile.includeSummer) continue;
        const calYear = this.calendarYear(term, academicStart);
        if (this.compareTerm(term, calYear, profile.currentTerm || "F", profile.currentYear || 2026) < 0) continue;
        if (this.compareTerm(term, calYear, profile.targetGradTerm || "S", profile.targetGradYear || (startYear + 4)) > 0) continue;
        if (this.isGapTerm(profile, term, calYear)) continue;
        window.push(term);
      }
    }
    return window;
  },

  availabilityScore(code, profile) {
    if (typeof RequirementCollector !== "undefined" && RequirementCollector.availabilityScore) {
      return RequirementCollector.availabilityScore(code, profile, COURSES);
    }
    const window = this.planningQuarterWindow(profile);
    const offered = COURSES[code] && COURSES[code].quarters;
    if (!window) return 0;
    if (!offered || offered.length === 0) return -20000;
    const firstIndex = window.findIndex(q => offered.includes(q));
    if (firstIndex === -1) return -10000;
    const offeredSet = new Set(offered);
    const inWindowOfferings = window.filter(q => offeredSet.has(q)).length;
    const termFlexibility = new Set(offered.filter(q => window.includes(q))).size;
    return 1000 - (firstIndex * 2) + (inWindowOfferings * 0.05) + (termFlexibility * 0.25);
  },

  isCourseAllowedForProfile(code, profile) {
    const course = COURSES[code];
    if (!course) return false;
    const major = profile && profile.major;
    const excludedMajors = Array.isArray(course.excludedMajors) ? course.excludedMajors : [];
    if (major && excludedMajors.includes(major)) return false;
    const restrictedMajors = Array.isArray(course.restrictedMajors) ? course.restrictedMajors : [];
    if (restrictedMajors.length > 0 && major && !restrictedMajors.includes(major)) return false;
    const restrictedLevels = Array.isArray(course.restrictedLevels) ? course.restrictedLevels : [];
    if (restrictedLevels.length > 0 && profile && profile.currentLevel != null && !profile.ignoreCurrentLevelRestrictionsForPlanning) {
      const rawLevel = parseInt(profile.currentLevel, 10);
      // Course-selection can opt out while planning across future quarters, but
      // direct availability checks and quarter placement should honor the class
      // standing being evaluated.
      const level = Number.isFinite(rawLevel) ? Math.min(rawLevel, 4) : rawLevel;
      if (!restrictedLevels.includes(level)) return false;
    }
    return true;
  },

  missingPrereqCost(code, knownSet, virtuallyPresent, visiting = new Set()) {
    const course = COURSES[code];
    if (!course || !course.prereqs || visiting.has(code)) return 0;
    visiting.add(code);
    let cost = 0;
    const vp = virtuallyPresent || new Set();
    for (const orGroup of course.prereqs) {
      if (orGroup.some(p => knownSet.has(p) || vp.has(p))) continue;
      const candidates = orGroup.filter(p => COURSES[p] && !vp.has(p));
      if (candidates.length === 0) continue;
      const cheapest = Math.min(...candidates.map(p =>
        (knownSet.has(p) ? 0 : (COURSES[p]?.units || 5)) + this.missingPrereqCost(p, knownSet, vp, new Set(visiting))
      ));
      cost += cheapest;
    }
    return cost;
  },

  rankByConcentration(pool, concentration, profile, usedSet, virtuallyPresent) {
    const known = usedSet || new Set();
    const vp = virtuallyPresent || new Set();
    return pool
      .filter(code => this.isCourseAllowedForProfile(code, profile))
      .map(code => {
        let score = 0;
        score += this.interestScore(code, profile, { mode: "major" });
        if (concentration) {
          const concs = COURSES[code]?.concentrations || [];
          if (concs.includes(concentration)) score += 100;
        }
        score += this.availabilityScore(code, profile);
        const termFlexibility = new Set((COURSES[code]?.quarters || []).filter(term => term !== "SU")).size;
        score += termFlexibility * 20;
        const missingPrereqUnits = this.missingPrereqCost(code, known, vp);
        score -= missingPrereqUnits * 8;
        const prereqGroups = COURSES[code]?.prereqs || [];
        score -= prereqGroups.length * 2;
        if ((COURSES[code]?.units || 0) > 7) score -= 25;
        score += this.coursePreferenceScore(code, profile);
        return { code, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(s => s.code);
  },

  // --- GE selection (concentration-aware) ---

  estimateMissingPrereqBurden(code, knownSet, visiting) {
    const course = COURSES[code];
    if (!course || !Array.isArray(course.prereqs) || course.prereqs.length === 0) return 0;
    const seen = visiting || new Set();
    if (seen.has(code)) return 0;
    seen.add(code);
    let burden = 0;
    for (const group of course.prereqs) {
      const options = Array.isArray(group) ? group.filter(p => COURSES[p]) : [];
      if (options.some(p => knownSet.has(p))) continue;
      if (options.length === 0) continue;
      const optionCosts = options.map(p => 1 + this.estimateMissingPrereqBurden(p, new Set([...knownSet, p]), new Set(seen)));
      burden += Math.min(...optionCosts);
    }
    seen.delete(code);
    return burden;
  },

  isUnrelatedLabScienceGE(code, ge, profile) {
    if (!ge || ge.id !== "SI") return false;
    if (profile && profile.geConcentration === "ge_natural_sciences") return false;
    if (profile && profile.geConcentration === "ge_health_wellness") return false;
    return /^(CHEM|BIOL|BIOE|PHYS)\s/.test(code);
  },

  pickGE(used, completedSet, geConcentration, profile) {
    const picks = [];
      const geConcIds = this.profileGEInterests(profile);
      const geConcGroups = (typeof CONCENTRATIONS !== "undefined")
        ? geConcIds.map(id => CONCENTRATIONS.ge.find(g => g.id === id)).filter(Boolean)
        : [];
      const geConcCourses = new Set();
      geConcGroups.forEach(group => (group.courses || []).forEach(code => geConcCourses.add(code)));

    // Compute needed UC requirements for multi-coverage scoring
    const neededUC = new Map();
    for (const req of UC_REQUIREMENTS) {
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) continue;
      let sat = false;
      for (const code of used) {
        if (req.courses.includes(code)) { sat = true; break; }
        const c = COURSES[code];
        if (c && c.alsoSatisfies && c.alsoSatisfies.includes(req.id)) { sat = true; break; }
      }
      if (!sat) neededUC.set(req.id, req);
    }

    for (const ge of GE_REQUIREMENTS) {
      let satisfied = false;
      for (const code of used) {
        const c = COURSES[code];
        if (!c) continue;
        if (this.courseSatisfiesGEFamily(code, ge.id)) { satisfied = true; break; }
        if ((ge.courses || []).includes(code)) { satisfied = true; break; }
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) { satisfied = true; break; }
      }
      if (satisfied) continue;

      const candidates = [];
      for (const [code, c] of Object.entries(COURSES)) {
        if (used.has(code) || completedSet.has(code)) continue;
        if (code.startsWith("FREE")) continue;
        if (!this.isCourseAllowedForProfile(code, profile)) continue;
        if (this.isRedundantGE(code, [...used, ...completedSet, ...picks], profile)) continue;
        if (this.courseSatisfiesGEFamily(code, ge.id)) { candidates.push(code); continue; }
        if ((ge.courses || []).includes(code)) candidates.push(code);
      }
      const fallback = (ge.courses || []).filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c) && this.isCourseAllowedForProfile(c, profile));
      const pool = candidates.length > 0 ? candidates : fallback;

      const scored = pool
        .map(code => {
          let score = 0;
          // Prefer the regular WRIT 2 path for Composition. Summer-only/global
          // seminar variants can be valid catalog C courses, but they are easy
          // to strand when the student starts in summer or has a low unit cap.
          if (ge.id === "C" && code === "WRIT 2") score += 500;
          if (geConcCourses.has(code)) score += 100;
          for (const group of geConcGroups) score += this.interestScore(code, profile, { geGroup: group });
          score += [...this.geFamiliesOfCourse(code)].filter(family => this.stillNeededGEFamilies([...used, ...completedSet, ...picks], profile).has(family)).length * 220;
          score += this.availabilityScore(code, profile);
          const prereqBurden = this.estimateMissingPrereqBurden(code, new Set([...used, ...completedSet]));
          score -= prereqBurden * 50;
          // Do not choose chemistry/biology/physics prerequisite chains as a
          // generic SI GE for non-lab majors just because the course is highly
          // rated or available. These are valid only when required by the major
          // or when the student explicitly asks for a science/health GE focus.
          if (this.isUnrelatedLabScienceGE(code, ge, profile)) score -= 1200;
          // Multi-coverage bonus: +200 per UC requirement this course also satisfies
          for (const [ucId, ucReq] of neededUC) {
            if (ucReq.courses.includes(code)) score += 200;
            else if (COURSES[code]?.alsoSatisfies?.includes(ucId)) score += 200;
          }
          const m = code.match(/(\d+)/);
          if (m) score -= Math.floor(parseInt(m[1], 10) / 100);
          score += (COURSES[code]?.rmpScore || 0);
          return { code, score };
        })
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        picks.push(scored[0].code);
        used.add(scored[0].code);
        // Update neededUC: remove requirements satisfied by this pick
        const picked = scored[0].code;
        for (const [ucId, ucReq] of neededUC) {
          if (ucReq.courses.includes(picked) ||
              (COURSES[picked]?.alsoSatisfies?.includes(ucId))) {
            neededUC.delete(ucId);
          }
        }
      }
    }
    return picks;
  },

  // --- UC selection ---

  pickUC(used, profile) {
    const picks = [];
    const completedSet = new Set(effectiveCompletedCourses(profile));
    for (const req of UC_REQUIREMENTS) {
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) continue;
      if ((req.id === "AH" || req.id === "AI") && ahiFulfillmentFor(profile, req.id)) continue;
      let satisfied = false;
      // used is a superset of completedSet, so checking used alone suffices
      for (const code of used) {
        if (req.courses.includes(code)) { satisfied = true; break; }
        const course = COURSES[code];
        if (course && course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) { satisfied = true; break; }
      }
      if (!satisfied) {
        for (const c of req.courses) {
          if (!used.has(c) && COURSES[c] && this.isCourseAllowedForProfile(c, profile)) { picks.push(c); used.add(c); break; }
        }
      }
    }
    return picks;
  },

  // --- Expand missing prereqs ---

  expandPrereqs(planCodes, completedSet, usedSet, virtuallyPresent) {
    const allKnown = new Set([...planCodes, ...usedSet, ...completedSet]);
    const toAdd = [];
    for (let pass = 0; pass < 6; pass++) {
      let added = false;
      for (const code of [...allKnown]) {
        const course = COURSES[code];
        if (!course) continue;
        const labCode = course.labCoreq;
        if (labCode && COURSES[labCode] && !allKnown.has(labCode)) {
          toAdd.push(labCode); allKnown.add(labCode); added = true;
        }
        const prereqGroups = [
          ...(Array.isArray(course.prereqs) ? course.prereqs : []),
          ...(Array.isArray(course.concurrentPrereqs) ? course.concurrentPrereqs : [])
        ];
        for (const orGroup of prereqGroups) {
          if (orGroup.some(p => allKnown.has(p))) continue;
          const candidate = orGroup
            .filter(p => COURSES[p] && !allKnown.has(p))
            .sort((a, b) => (COURSES[a].division === "lower" ? 0 : 1) - (COURSES[b].division === "lower" ? 0 : 1))[0];
          if (candidate) { toAdd.push(candidate); allKnown.add(candidate); added = true; }
        }
      }
      if (!added) break;
    }
    return toAdd;
  },

  // --- Upper-div supplement ---

  supplementUpperDiv(target, _unused, used, completedSet, reqs, majorId, virtuallyPresent) {
    const minUD = reqs.minUpperDivUnits || 60;
    const DEPT_MAP = { AM: "AM", CE: "CE", CS: "CSE", EE: "ECE", CSGD: "CMPM", NDT: "GAME", BMEB: "BIOL", BIOTECH: "BIOL" };
    const majKey = majorId.split("_")[0];
    const deptPfx = DEPT_MAP[majKey] || majKey;
    const vp = virtuallyPresent || new Set();

    let curUD = [...used, ...completedSet].reduce(
      (s, c) => s + (COURSES[c]?.division === "upper" ? COURSES[c].units : 0), 0);
    if (curUD >= minUD) return;

    const prereqContext = new Set([...used, ...completedSet]);
    const isSafeSupplement = c => COURSES[c].division === "upper"
      && this.isCourseAllowedForProfile(c, { major: majorId })
      && !c.startsWith("FREE")
      && Array.isArray(COURSES[c].quarters)
      && COURSES[c].quarters.length > 0
      && !used.has(c)
      && !completedSet.has(c)
      && !vp.has(c)
      // A standalone upper-division supplement must be independently schedulable.
      // Courses with required lab/coreq partners need prerequisite expansion support
      // after supplement selection; until then, skip them here instead of counting
      // an unplaced lecture toward the upper-division minimum.
      && (!COURSES[c].labCoreq || prereqContext.has(COURSES[c].labCoreq))
      && Validator.prereqsMet(COURSES[c].prereqs, prereqContext);

    const udPool = Object.keys(COURSES)
      .filter(c => isSafeSupplement(c) && c.startsWith(deptPfx))
      .concat(Object.keys(COURSES).filter(c => isSafeSupplement(c) && !c.startsWith(deptPfx)));

    for (const code of udPool) {
      if (curUD >= minUD) break;
      target.push(code); used.add(code); prereqContext.add(code);
      curUD += COURSES[code].units;
    }
  },

  // --- Filler pool for gap-filling under-loaded quarters ---

  buildFillerPool(profile, usedSet, virtuallyPresent) {
    const prereqFor = new Set();
    for (const code of usedSet) {
      const c = COURSES[code];
      if (!c || !c.prereqs) continue;
      for (const orG of c.prereqs) orG.forEach(p => prereqFor.add(p));
    }

    const concentration = profile.concentration || null;
    const geConcentration = profile.geConcentration || null;
    const geConc = geConcentration && typeof CONCENTRATIONS !== "undefined"
      ? CONCENTRATIONS.ge.find(g => g.id === geConcentration) : null;
    const geConcSet = geConc ? new Set(geConc.courses) : null;
    const vp = virtuallyPresent || new Set();

    const candidates = [];
    for (const [code, c] of Object.entries(COURSES)) {
      if (usedSet.has(code) || code.startsWith("FREE") || vp.has(code)) continue;
      if (!this.isCourseAllowedForProfile(code, profile)) continue;
      if (c.units < 1 || c.units > 5) continue;
      if (!c.quarters || c.quarters.length === 0) continue;
      if (prereqFor.has(code)) continue;
      let score = 0;
      score += this.interestScore(code, profile, { mode: "filler" });
      if (concentration && (c.concentrations || []).includes(concentration)) score += 50;
      if (geConcSet && geConcSet.has(code)) score += 30;
      score += this.availabilityScore(code, profile);
      if (c.ge) score += 20;
      score += (c.rmpScore || 0);
      if (c.division === "lower") score += 5;
      candidates.push({ code, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 60).map(c => c.code);
  },

  // --- Quarter placement (balanced, type-aware) ---

  placeIntoQuarters(courses, courseTypeMap, fillerPool, completedCourses, profile) {
    const placed = new Set(completedCourses);
    const includeSummer = profile.includeSummer || false;
    // UCSC's normal maximum load is effectively 20 credits. The UI historically
    // defaulted to 19 to avoid accidental overloads, but many official engineering
    // planners require an occasional 20-credit quarter; treating 19 as a soft
    // default cap prevents a single 5-credit GE from creating a fake fifth year.
    const maxUnits = this.effectiveMaxUnits(profile);
    const minUnits = profile.minUnits || 12;

    const curTerm    = profile.currentTerm    || "F";
    const curYear    = profile.currentYear    || new Date().getFullYear();
    const gradTerm   = profile.targetGradTerm || "S";
    const gradYear   = profile.targetGradYear || (curYear + 4);
    const startLevel = profile.currentLevel   || 1;
    const studentType = profile.studentType   || "undergrad";

    const schedule = this.buildYearSkeleton(curTerm, curYear, gradTerm, gradYear, startLevel, studentType, includeSummer);
    if (schedule.length === 0) return schedule;

    // GAP quarter handling. gapYear is a calendar year from the UI, so
    // "Winter 2027" must map to 2027-W (not the next academic year). For a
    // full-year gap, honor the selected starting term and mark the next 3 or 4
    // quarters in calendar order.
    const gapKeys = new Set();
    if (profile.gapEnabled && profile.gapTerm && profile.gapYear) {
      const gapBaseYear = parseInt(profile.gapYear, 10);
      const termCycle = includeSummer ? ["F","W","S","SU"] : ["F","W","S"];
      const addGapQuarter = (term, year) => gapKeys.add(`${year}-${term}`);
      const nextQuarter = (term, year) => {
        if (term === "F") return { term: "W", year: year + 1 };
        if (term === "W") return { term: "S", year };
        if (term === "S" && includeSummer) return { term: "SU", year };
        if (term === "S") return { term: "F", year };
        if (term === "SU") return { term: "F", year };
        return { term: "F", year };
      };

      if (profile.gapType === "year") {
        let cur = { term: profile.gapTerm, year: gapBaseYear };
        for (let i = 0; i < termCycle.length; i++) {
          addGapQuarter(cur.term, cur.year);
          cur = nextQuarter(cur.term, cur.year);
        }
      } else {
        addGapQuarter(profile.gapTerm, gapBaseYear);
      }
    }

    const calYearOf = (q, sched) => (q === "F") ? sched.academicStart : sched.academicStart + 1;

    const sorted = this.topoSort(courses, completedCourses, courseTypeMap);
    const remaining = [...sorted];
    const fillerR = [...fillerPool];
    const MAJOR_TYPES = new Set(["major_core", "major_elective", "prereq"]);
    const courseNumber = code => {
      const match = String(code || "").match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };
    const isLowerDivisionCourse = code => {
      const course = COURSES[code];
      const num = courseNumber(code);
      return Boolean(course) && (course.division === "lower" || (Number.isFinite(num) && num <= 99));
    };
    const isUpperDivisionCourse = code => {
      const course = COURSES[code];
      const num = courseNumber(code);
      return Boolean(course) && (course.division === "upper" || (Number.isFinite(num) && num >= 100));
    };
    const isRequiredMajorWork = code => MAJOR_TYPES.has(courseTypeMap.get(code));
    const lowerRequiredMajorCodes = new Set(
      sorted.filter(code => isRequiredMajorWork(code) && isLowerDivisionCourse(code) && !placed.has(code))
    );
    const lowerFoundationGateApplies = !(profile && profile.gapEnabled)
      && this.normalMaxUnits(profile) >= 18;
    const lowerRequiredMajorCompleteBefore = completedBefore =>
      !lowerFoundationGateApplies || [...lowerRequiredMajorCodes].every(code => completedBefore.has(code));

    const allQuarters = [];
    for (let yi = 0; yi < schedule.length; yi++) {
      for (const q of Object.keys(schedule[yi].quarters)) {
        if (q === "SU" && !includeSummer) continue;
        const key = `${calYearOf(q, schedule[yi])}-${q}`;
        if (gapKeys.has(key)) {
          schedule[yi].quarters[q] = ["_GAP"];
          schedule[yi].gapQuarters = schedule[yi].gapQuarters || new Set();
          schedule[yi].gapQuarters.add(q);
          continue;
        }
        allQuarters.push({ yi, q });
      }
    }

    const canPlace = (code, q, completedBefore, unitsUsed, levelNum = 1) => {
      const course = COURSES[code];
      if (!course) return false;
      if (isRequiredMajorWork(code) && isUpperDivisionCourse(code) && !lowerRequiredMajorCompleteBefore(completedBefore)) return false;
      if (!this.isCourseAllowedForProfile(code, { ...profile, currentLevel: levelNum })) return false;
      if (/restricted to seniors/i.test(course.enrollmentRestrictions || "") && levelNum < 4) return false;
      if (!course.quarters.includes(q)) return false;
      if (!Validator.prereqsMet(course.prereqs, completedBefore)) return false;
      if (unitsUsed + course.units > maxUnits) return false;

      const labCode = course.labCoreq;
      if (labCode && COURSES[labCode] && !completedBefore.has(labCode)) {
        const labCourse = COURSES[labCode];
        const labAvailable = remaining.includes(labCode) || fillerR.includes(labCode);
        const prereqContext = new Set(completedBefore);
        prereqContext.add(code);
        if (!labAvailable) return false;
        if (!labCourse.quarters.includes(q)) return false;
        if (!Validator.prereqsMet(labCourse.prereqs, prereqContext)) return false;
        if (unitsUsed + course.units + labCourse.units > maxUnits) return false;
      }
      return true;
    };

    const placeWithCoreq = (code, quarterArr, completedBefore) => {
      quarterArr.push(code);
      let units = COURSES[code].units;
      const tryPlaceCoreqLab = labCode => {
        if (!labCode || !COURSES[labCode] || placed.has(labCode) || quarterArr.includes(labCode)) return;
        const labInRemaining = remaining.indexOf(labCode);
        const labInFiller = fillerR.indexOf(labCode);
        if (labInRemaining < 0 && labInFiller < 0) return;
        const prereqContext = new Set(completedBefore);
        prereqContext.add(code);
        if (COURSES[labCode].quarters.includes(quarterArr._q) &&
            Validator.prereqsMet(COURSES[labCode].prereqs, prereqContext) &&
            units + COURSES[labCode].units + quarterArr._unitsUsed <= maxUnits) {
          quarterArr.push(labCode);
          units += COURSES[labCode].units;
          placed.add(labCode);
          if (!courseTypeMap.has(labCode)) courseTypeMap.set(labCode, "prereq");
          if (labInRemaining >= 0) remaining.splice(labInRemaining, 1);
          if (labInFiller >= 0) fillerR.splice(labInFiller, 1);
        }
      };
      tryPlaceCoreqLab(COURSES[code].labCoreq);
      for (const [candidate, course] of Object.entries(COURSES)) {
        if (course?.labCoreq === code) tryPlaceCoreqLab(candidate);
      }
      return units;
    };

    // Main placement loop
    for (const { yi, q } of allQuarters) {
      const quarterArr = schedule[yi].quarters[q];
      quarterArr._q = q;
      quarterArr._unitsUsed = 0;
      let unitsUsed = 0;
      let majorCount = 0;
      const completedBefore = new Set(placed);

      // Phase 0: writing/composition is a declaration/progress gate. If WRIT 1
      // or WRIT 2 is still needed, place it as early as prerequisites/capacity
      // allow before major courses consume all available room.
      if (schedule[yi].levelNum <= 4) {
        const writingCandidates = ["WRIT 1", "WRIT 2"];
        for (const writingCode of writingCandidates) {
          const wi = remaining.indexOf(writingCode);
          if (wi < 0) continue;
          if (!canPlace(writingCode, q, completedBefore, unitsUsed, schedule[yi].levelNum)) continue;
          remaining.splice(wi, 1);
          quarterArr._unitsUsed = unitsUsed;
          const added = placeWithCoreq(writingCode, quarterArr, completedBefore);
          unitsUsed += added;
          break;
        }
      }

      // Phase 0b: residential college core is a first-year college requirement.
      // Put the affiliated college's core course/sequence in the first feasible
      // first-year quarter before elective GE/filler work consumes the slot.
      if (schedule[yi].levelNum === 1) {
        for (let ri = 0; ri < remaining.length; ri++) {
          const code = remaining[ri];
          if (courseTypeMap.get(code) !== "college_core") continue;
          if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) continue;
          remaining.splice(ri, 1);
          quarterArr._unitsUsed = unitsUsed;
          const added = placeWithCoreq(code, quarterArr, completedBefore);
          unitsUsed += added;
          break;
        }
      }

      // Phase A: Credit-first major/prereq placement. Keep adding currently
      // placeable major work until the quarter has about 10+ major credits when
      // available. Raw course count is not the throttle: a 5+2+3 foundation
      // bundle should count as 10 credits of major progress before the GE slot.
      const targetMajorUnits = 10;
      let majorUnits = 0;
      const selectedSetForUrgency = new Set([...remaining, ...quarterArr]);
      while (majorUnits < targetMajorUnits) {
        let bestIndex = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const code = remaining[i];
          if (!MAJOR_TYPES.has(courseTypeMap.get(code))) continue;
          if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) continue;
          const addedUnits = COURSES[code]?.units || 0;
          const projected = unitsUsed + addedUnits;
          if (projected > maxUnits) continue;
          let score = -i * 100;
          score += this.courseUrgency(code, profile, { yearIndex: yi, term: q, levelNum: schedule[yi].levelNum }, selectedSetForUrgency) * 0.01;
          score += Math.max(0, targetMajorUnits - Math.min(targetMajorUnits, majorUnits + addedUnits)) * -0.08;
          if (score > bestScore) { bestScore = score; bestIndex = i; }
        }
        if (bestIndex < 0) break;
        const code = remaining.splice(bestIndex, 1)[0];
        quarterArr._unitsUsed = unitsUsed;
        const added = placeWithCoreq(code, quarterArr, completedBefore);
        unitsUsed += added;
        majorUnits += added;
        majorCount++;
      }

      // Phase B: Place non-major courses (GE/UC/filler) up to capacity, but
      // choose the best-fitting currently placeable course rather than blindly
      // taking list order. Narrow AH/AI/GE courses such as HIS 10B must not be
      // stranded behind flexible PE/IM fillers, or a single GE can create a
      // fake fifth-year overflow after all major requirements are done.
      while (unitsUsed < maxUnits) {
        let bestIndex = -1;
        let bestScore = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const code = remaining[i];
          if (MAJOR_TYPES.has(courseTypeMap.get(code))) continue;
          if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) continue;
          const course = COURSES[code] || {};
          const termFlexibility = new Set((course.quarters || []).filter(term => term !== "SU")).size;
          let score = 0;
          if (code === "WRIT 1" || code === "WRIT 2") score += 300;
          if (courseTypeMap.get(code) === "uc") score += 150;
          if (course.alsoSatisfies && course.alsoSatisfies.length) score += 120;
          if (course.ge) score += 40;
          score += Math.max(0, 3 - termFlexibility) * 30;
          score -= i * 0.01; // stable tie-break toward existing order
          if (score > bestScore) { bestScore = score; bestIndex = i; }
        }
        if (bestIndex < 0) break;
        const code = remaining.splice(bestIndex, 1)[0];
        quarterArr._unitsUsed = unitsUsed;
        const added = placeWithCoreq(code, quarterArr, completedBefore);
        unitsUsed += added;
      }

      // Phase C: Additional major work for underloaded quarters. For dense
      // engineering plans, allow a fourth required course when the quarter is
      // still at/under 15 units and the engineering soft-20 cap can absorb it;
      // otherwise a 5-credit course can be needlessly stranded into a fake fifth
      // year.
      const phaseCMajorLimit = (maxUnits >= 20 && unitsUsed <= 15) ? 4 : 3;
      if (unitsUsed < minUnits || (maxUnits >= 20 && unitsUsed <= 15)) {
        for (let i = 0; i < remaining.length && majorCount < phaseCMajorLimit;) {
          const code = remaining[i];
          if (!MAJOR_TYPES.has(courseTypeMap.get(code))) { i++; continue; }
          if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) { i++; continue; }
          remaining.splice(i, 1);
          quarterArr._unitsUsed = unitsUsed;
          const added = placeWithCoreq(code, quarterArr, completedBefore);
          unitsUsed += added; majorCount++;
        }
      }

      // Phase D intentionally does not introduce extra courses from the broad filler pool.
      // Unit padding is handled in Scheduler.generate() Phase 6, where FREE courses are
      // added only if the selected plan is below the degree unit target. Adding more
      // opportunistic fillers here can consume slots needed by late prerequisite chains
      // and force otherwise-placeable major courses into a fifth year.

      delete quarterArr._q;
      delete quarterArr._unitsUsed;
      for (const code of quarterArr) placed.add(code);
    }

    // Rebalancing pass: move courses from overloaded to underloaded adjacent quarters
    for (let qi = 0; qi < allQuarters.length - 1; qi++) {
      const aSlot = allQuarters[qi], bSlot = allQuarters[qi + 1];
      const aArr = schedule[aSlot.yi].quarters[aSlot.q];
      const bArr = schedule[bSlot.yi].quarters[bSlot.q];
      const aUnits = aArr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
      const bUnits = bArr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
      if (aUnits <= 20 || bUnits >= 14) continue;

      for (let i = aArr.length - 1; i >= 0; i--) {
        const code = aArr[i];
        if (!COURSES[code]) continue;
        const type = courseTypeMap.get(code);
        if (type === "major_core" || type === "prereq") continue;
        if (!COURSES[code].quarters.includes(bSlot.q)) continue;
        const aAfter = aUnits - COURSES[code].units;
        const bAfter = bUnits + COURSES[code].units;
        if (aAfter >= minUnits && bAfter <= maxUnits) {
          aArr.splice(i, 1);
          bArr.push(code);
          break;
        }
      }
    }

    // Before extending the schedule, try to backfill any leftover courses into
    // earlier quarters that still have capacity. The main pass is intentionally
    // conservative (major-course caps, filler balancing), so a course can remain
    // unplaced even when a valid earlier slot exists.
    const completedBeforeSlot = slotIndex => {
      const done = new Set(completedCourses);
      for (let i = 0; i < slotIndex; i++) {
        const slot = allQuarters[i];
        const arr = schedule[slot.yi].quarters[slot.q] || [];
        for (const c of arr) if (c !== "_GAP") done.add(c);
      }
      return done;
    };

    const freeCode = c => String(c).startsWith("FREE");
    const unitsNeededFor = (code, completedBefore) => {
      const course = COURSES[code];
      if (!course) return 0;
      let needed = course.units || 0;
      const labCode = course.labCoreq;
      if (labCode && COURSES[labCode] && !completedBefore.has(labCode)) needed += COURSES[labCode].units || 0;
      return needed;
    };
    const removeFreeUntilFits = (arr, neededUnits) => {
      let units = arr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
      for (let i = arr.length - 1; i >= 0 && units + neededUnits > maxUnits; i--) {
        if (freeCode(arr[i])) {
          units -= COURSES[arr[i]]?.units || 0;
          placed.delete(arr[i]);
          arr.splice(i, 1);
        }
      }
      return units;
    };

    for (let ri = 0; ri < remaining.length;) {
      const code = remaining[ri];
      const course = COURSES[code];
      let didPlace = false;
      if (course && !placed.has(code)) {
        for (let si = 0; si < allQuarters.length; si++) {
          const slot = allQuarters[si];
          const arr = schedule[slot.yi].quarters[slot.q];
          if (!arr || arr[0] === "_GAP") continue;
          if (/restricted to seniors/i.test(course.enrollmentRestrictions || "") && schedule[slot.yi].levelNum < 4) continue;
          const completedAtSlot = completedBeforeSlot(si);
          let qUnits = removeFreeUntilFits(arr, unitsNeededFor(code, completedAtSlot));
          if (!canPlace(code, slot.q, completedAtSlot, qUnits, schedule[slot.yi].levelNum)) continue;
          arr._q = slot.q;
          arr._unitsUsed = qUnits;
          placeWithCoreq(code, arr, completedAtSlot);
          delete arr._q;
          delete arr._unitsUsed;
          placed.add(code);
          didPlace = true;
          break;
        }
      }
      if (didPlace) remaining.splice(ri, 1);
      else ri++;
    }

    // Overflow: place remaining courses
    const gradAcad = (gradTerm === "F") ? gradYear : gradYear - 1;
    const overflow = remaining.filter(c => !placed.has(c));

    if (overflow.length > 0) {
      let overflowY = schedule[schedule.length - 1];
      let lastQ = "S";
      const qOrder = ["F", "W", "S"];

      const addNewYear = () => {
        const last = schedule[schedule.length - 1];
        const nextAcad = last.academicStart + 1;
        // If the student's constraints (low max units, GAPs, late start, dense major)
        // make the requested graduation window infeasible, keep extending a bounded
        // number of years rather than silently dropping unmet courses/GE requirements.
        if (nextAcad > gradAcad + 4) return false;
        const newYear = this.makeYearObj(nextAcad, last.levelNum + 1, studentType, "F", "S", false);
        schedule.push(newYear);
        allQuarters.push({ yi: schedule.length - 1, q: "F" }, { yi: schedule.length - 1, q: "W" }, { yi: schedule.length - 1, q: "S" });
        overflowY = newYear;
        lastQ = "F";
        return true;
      };

      for (const code of overflow) {
        if (placed.has(code) || !COURSES[code]) continue;
        let didPlace = false;
        for (let attempt = 0; attempt < 6 && !didPlace; attempt++) {
          const quarterArr = overflowY.quarters[lastQ];
          if (!quarterArr) break;
          const completedNow = new Set(placed);
          let qUnits = removeFreeUntilFits(quarterArr, unitsNeededFor(code, completedNow));
          if (canPlace(code, lastQ, completedNow, qUnits, overflowY.levelNum)) {
            quarterArr._q = lastQ;
            quarterArr._unitsUsed = qUnits;
            placeWithCoreq(code, quarterArr, completedNow);
            delete quarterArr._q;
            delete quarterArr._unitsUsed;
            placed.add(code); didPlace = true;
          } else {
            const curIdx = qOrder.indexOf(lastQ);
            if (curIdx < qOrder.length - 1) lastQ = qOrder[curIdx + 1];
            else if (!addNewYear()) break;
          }
        }
      }
    }

    // Final chronology repair: overflow/backfill can occasionally place a prerequisite
    // chain out of chronological order (for example ECE 129C before ECE 129B after
    // gap-year overflow). Ordinary prerequisites must be completed before the quarter
    // starts; only explicit labCoreq relationships may share a quarter. Move offenders
    // later before adding any final FREE padding.
    const hasChronologyPrereqProblem = (code, quarterArr, completedBefore) => {
      const course = COURSES[code];
      if (!course || !course.prereqs || freeCode(code)) return false;
      if (Validator.prereqsMet(course.prereqs, completedBefore)) return false;
      const sameQuarter = new Set(quarterArr.filter(c => c !== code));
      const labCoreq = course.labCoreq;
      if (labCoreq && sameQuarter.has(labCoreq)) return false;
      return true;
    };

    const repairChronologyPrereqs = () => {
      for (let pass = 0; pass < 12; pass++) {
        let moved = false;
        for (let si = 0; si < allQuarters.length; si++) {
          const slot = allQuarters[si];
          const arr = schedule[slot.yi].quarters[slot.q];
          if (!arr || arr[0] === "_GAP") continue;
          const completedAtSource = completedBeforeSlot(si);
          for (let ci = 0; ci < arr.length; ci++) {
            const code = arr[ci];
            if (!hasChronologyPrereqProblem(code, arr, completedAtSource)) continue;
            arr.splice(ci, 1);
            placed.delete(code);
            for (let ti = si + 1; ti < allQuarters.length; ti++) {
              const targetSlot = allQuarters[ti];
              const targetArr = schedule[targetSlot.yi].quarters[targetSlot.q];
              if (!targetArr || targetArr[0] === "_GAP") continue;
              const completedAtTarget = completedBeforeSlot(ti);
              const qUnits = targetArr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
              if (!canPlace(code, targetSlot.q, completedAtTarget, qUnits, schedule[targetSlot.yi].levelNum)) continue;
              targetArr.push(code);
              placed.add(code);
              moved = true;
              break;
            }
            if (!placed.has(code)) {
              const last = schedule[schedule.length - 1];
              const nextAcad = last.academicStart + 1;
              if (nextAcad <= gradAcad + 4) {
                const newYear = this.makeYearObj(nextAcad, last.levelNum + 1, studentType, "F", "S", false);
                schedule.push(newYear);
                allQuarters.push({ yi: schedule.length - 1, q: "F" }, { yi: schedule.length - 1, q: "W" }, { yi: schedule.length - 1, q: "S" });
                for (const q of ["F", "W", "S"]) {
                  const targetArr = newYear.quarters[q];
                  const completedAtTarget = completedBeforeSlot(allQuarters.length - (q === "F" ? 3 : q === "W" ? 2 : 1));
                  const qUnits = targetArr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
                  if (!canPlace(code, q, completedAtTarget, qUnits, newYear.levelNum)) continue;
                  targetArr.push(code);
                  placed.add(code);
                  moved = true;
                  break;
                }
              }
            }
            if (!placed.has(code)) {
              arr.splice(ci, 0, code);
              placed.add(code);
            }
            break;
          }
          if (moved) break;
        }
        if (!moved) break;
      }
    };
    repairChronologyPrereqs();

    // Empty non-gap quarters are not acceptable UX. If the student did not choose
    // a GAP quarter, a blank Fall/Winter/Spring in the middle of a plan should be
    // treated as wasted capacity, not as an implicit break. Pull legally-placeable
    // later courses backward into those holes before adding any optional FREE
    // padding. This preserves the student's no-summer/no-gap choices and reduces
    // fake overflow years caused by stranded empty quarters.
    const fillEmptyNonGapQuartersFromLaterWork = () => {
      const isLabPartner = code => Object.values(COURSES).some(course => course && course.labCoreq === code);
      for (let si = 0; si < allQuarters.length; si++) {
        const targetSlot = allQuarters[si];
        const targetArr = schedule[targetSlot.yi].quarters[targetSlot.q];
        if (!targetArr || targetArr[0] === "_GAP" || targetArr.length > 0) continue;
        let targetUnits = 0;
        for (let ti = si + 1; ti < allQuarters.length && targetUnits < minUnits; ti++) {
          const sourceSlot = allQuarters[ti];
          const sourceArr = schedule[sourceSlot.yi].quarters[sourceSlot.q];
          if (!sourceArr || sourceArr[0] === "_GAP" || sourceArr.length === 0) continue;
          const completedAtTarget = completedBeforeSlot(si);
          let bestIdx = -1;
          let bestScore = -Infinity;
          for (let ci = 0; ci < sourceArr.length; ci++) {
            const code = sourceArr[ci];
            const course = COURSES[code];
            if (!course || freeCode(code)) continue;
            // Avoid splitting explicit lab/coreq pairs in this generic compaction
            // pass; main placement/chronology repair already handles those safely.
            if (course.labCoreq || isLabPartner(code)) continue;
            if (!canPlace(code, targetSlot.q, completedAtTarget, targetUnits, schedule[targetSlot.yi].levelNum)) continue;
            const type = courseTypeMap.get(code) || "other";
            const typeScore = ({ major_core: 500, prereq: 450, major_elective: 400, ge: 300, uc: 280, filler: 100 }[type] || 0);
            const score = typeScore + (course.units || 0) - (ti - si) * 0.1 - ci * 0.01;
            if (score > bestScore) { bestScore = score; bestIdx = ci; }
          }
          if (bestIdx < 0) continue;
          const [moved] = sourceArr.splice(bestIdx, 1);
          targetArr.push(moved);
          targetUnits += COURSES[moved]?.units || 0;
          placed.add(moved);
        }
      }
    };
    fillEmptyNonGapQuartersFromLaterWork();
    repairChronologyPrereqs();

    // The lower-division foundation gate can intentionally defer upper-division
    // major work while required lower-division courses are still being placed.
    // After compaction/chronology repair has moved every possible lower-division
    // requirement earlier, retry the remaining real courses before final FREE
    // padding. This preserves the lower-before-upper policy without dropping
    // dense/gap/low-unit scenarios that only become placeable after repair.
    const placeDeferredRequiredWork = () => {
      for (let ri = 0; ri < remaining.length;) {
        const code = remaining[ri];
        const course = COURSES[code];
        let didPlace = false;
        if (course && !placed.has(code)) {
          for (let si = 0; si < allQuarters.length; si++) {
            const slot = allQuarters[si];
            const arr = schedule[slot.yi].quarters[slot.q];
            if (!arr || arr[0] === "_GAP") continue;
            const completedAtSlot = completedBeforeSlot(si);
            let qUnits = removeFreeUntilFits(arr, unitsNeededFor(code, completedAtSlot));
            if (!canPlace(code, slot.q, completedAtSlot, qUnits, schedule[slot.yi].levelNum)) continue;
            arr._q = slot.q;
            arr._unitsUsed = qUnits;
            placeWithCoreq(code, arr, completedAtSlot);
            delete arr._q;
            delete arr._unitsUsed;
            placed.add(code);
            didPlace = true;
            break;
          }
        }
        if (didPlace) remaining.splice(ri, 1);
        else ri++;
      }

      let guard = 0;
      while (remaining.some(code => COURSES[code] && !placed.has(code)) && guard++ < 12) {
        const last = schedule[schedule.length - 1];
        const nextAcad = last.academicStart + 1;
        if (nextAcad > gradAcad + 4) break;
        const newYear = this.makeYearObj(nextAcad, last.levelNum + 1, studentType, "F", "S", false);
        schedule.push(newYear);
        allQuarters.push({ yi: schedule.length - 1, q: "F" }, { yi: schedule.length - 1, q: "W" }, { yi: schedule.length - 1, q: "S" });
        let placedInNewYear = false;
        for (let ri = 0; ri < remaining.length;) {
          const code = remaining[ri];
          const course = COURSES[code];
          let didPlace = false;
          if (course && !placed.has(code)) {
            for (const q of ["F", "W", "S"]) {
              const slotIndex = allQuarters.findIndex(slot => slot.yi === schedule.length - 1 && slot.q === q);
              const arr = newYear.quarters[q];
              const completedAtSlot = completedBeforeSlot(slotIndex);
              let qUnits = removeFreeUntilFits(arr, unitsNeededFor(code, completedAtSlot));
              if (!canPlace(code, q, completedAtSlot, qUnits, newYear.levelNum)) continue;
              arr._q = q;
              arr._unitsUsed = qUnits;
              placeWithCoreq(code, arr, completedAtSlot);
              delete arr._q;
              delete arr._unitsUsed;
              placed.add(code);
              didPlace = true;
              placedInNewYear = true;
              break;
            }
          }
          if (didPlace) remaining.splice(ri, 1);
          else ri++;
        }
        if (!placedInNewYear) break;
      }
    };
    placeDeferredRequiredWork();
    repairChronologyPrereqs();

    // Final unit padding: real required courses may evict FREE placeholders during
    // backfill/overflow. After all real courses are placed, add FREE electives only
    // as needed to reach the degree-unit floor, counting completed units and prior
    // credits the same way validation does.
    const scheduledCourses = schedule.flatMap(year => Object.values(year.quarters).flat()).filter(c => c !== "_GAP");
    const scheduledSet = new Set(scheduledCourses);
    let totalUnits = scheduledCourses.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
    [...completedCourses].forEach(c => { if (COURSES[c] && !scheduledSet.has(c)) totalUnits += COURSES[c].units; });
    totalUnits += (profile.priorCredits || 0);
    const majorReqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
    const targetUnits = majorReqs.totalUnitsRequired || 180;
    const usedFree = new Set([...scheduledCourses, ...completedCourses].filter(freeCode));
    const freePool = Object.keys(COURSES).filter(freeCode).filter(c => !usedFree.has(c));
    for (const free of freePool) {
      if (totalUnits >= targetUnits) break;
      let placedFree = false;
      for (const slot of allQuarters) {
        const arr = schedule[slot.yi].quarters[slot.q];
        if (!arr || arr[0] === "_GAP") continue;
        const qUnits = arr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
        if (qUnits + COURSES[free].units <= maxUnits) {
          arr.push(free);
          totalUnits += COURSES[free].units;
          placedFree = true;
          break;
        }
      }
      if (!placedFree) {
        const last = schedule[schedule.length - 1];
        const nextAcad = last.academicStart + 1;
        if (nextAcad > gradAcad + 4) break;
        const newYear = this.makeYearObj(nextAcad, last.levelNum + 1, studentType, "F", "S", false);
        schedule.push(newYear);
        allQuarters.push({ yi: schedule.length - 1, q: "F" }, { yi: schedule.length - 1, q: "W" }, { yi: schedule.length - 1, q: "S" });
        newYear.quarters.F.push(free);
        totalUnits += COURSES[free].units;
      }
    }

    // If a non-gap quarter is still blank while later quarters contain work, use
    // optional FREE credit to make the quarter explicit instead of silently
    // behaving like an unchosen break. This is only for regular planned terms;
    // summer remains excluded unless includeSummer is true, and _GAP remains the
    // only way to intentionally leave a quarter empty.
    const fillRemainingEmptyNonGapQuartersWithFree = () => {
      const usedNow = new Set(schedule.flatMap(year => Object.values(year.quarters).flat()).filter(Boolean));
      const remainingFree = Object.keys(COURSES).filter(freeCode).filter(code => !usedNow.has(code));
      let freeIndex = 0;
      const hasLaterWork = slotIndex => allQuarters.slice(slotIndex + 1).some(slot => {
        const arr = schedule[slot.yi].quarters[slot.q] || [];
        return arr.some(code => code !== "_GAP");
      });
      for (let si = 0; si < allQuarters.length; si++) {
        const slot = allQuarters[si];
        const arr = schedule[slot.yi].quarters[slot.q];
        if (!arr || arr[0] === "_GAP" || arr.length > 0 || !hasLaterWork(si)) continue;
        while (freeIndex < remainingFree.length && this.quarterUnits(arr) < minUnits) {
          const free = remainingFree[freeIndex++];
          if (!COURSES[free]?.quarters?.includes(slot.q)) continue;
          if (this.quarterUnits(arr) + (COURSES[free].units || 0) > maxUnits) continue;
          arr.push(free);
          totalUnits += COURSES[free].units || 0;
        }
      }
    };
    fillRemainingEmptyNonGapQuartersWithFree();

    // Final full-time load repair: generated schedules should not leave an active
    // non-gap quarter at 5 or 10 credits while nearby quarters carry heavy loads.
    // UCSC's normal full-time minimum is 12 credits, so after all real courses and
    // degree-unit padding are placed, add unused FREE elective credit to any
    // active under-minimum quarter when it fits within the student's max load.
    const padActiveUnderMinQuartersWithFree = () => {
      const usedNow = new Set([
        ...schedule.flatMap(year => Object.values(year.quarters).flat()).filter(Boolean),
        ...(profile.completedCourses || [])
      ]);
      const remainingFree = Object.keys(COURSES)
        .filter(freeCode)
        .filter(code => !usedNow.has(code))
        .sort((a, b) => (COURSES[b]?.units || 0) - (COURSES[a]?.units || 0));
      for (const slot of allQuarters) {
        const arr = schedule[slot.yi].quarters[slot.q];
        if (!arr || arr[0] === "_GAP" || arr.length === 0 || slot.q === "SU") continue;
        let qUnits = this.quarterUnits(arr);
        if (qUnits <= 0 || qUnits >= minUnits) continue;
        while (qUnits < minUnits) {
          const bestIdx = remainingFree.findIndex(code =>
            COURSES[code]?.quarters?.includes(slot.q)
            && qUnits + (COURSES[code].units || 0) <= maxUnits
          );
          if (bestIdx < 0) break;
          const [free] = remainingFree.splice(bestIdx, 1);
          arr.push(free);
          qUnits += COURSES[free].units || 0;
          totalUnits += COURSES[free].units || 0;
        }
      }
    };
    padActiveUnderMinQuartersWithFree();

    // Do not synthesize additional future years beyond the minimum degree-unit
    // padding and no-implicit-gap safeguards above.
    // If all graduation requirements are satisfied before the requested target
    // term, graduate in that earlier quarter rather than rendering empty
    // trailing quarters. A requested Spring target is a latest acceptable
    // boundary, not a requirement to keep Winter/Spring visible when the plan is
    // already complete.
    const quarterOrder = includeSummer ? ["F", "W", "S", "SU"] : ["F", "W", "S"];
    const clonePrefixThrough = (targetYi, targetQ) => schedule.slice(0, targetYi + 1).map((year, yi) => {
      const copy = {
        label: year.label,
        academicStart: year.academicStart,
        levelNum: year.levelNum,
        quarters: {}
      };
      const limitIdx = yi === targetYi ? quarterOrder.indexOf(targetQ) : quarterOrder.length - 1;
      for (let i = 0; i <= limitIdx; i++) {
        const q = quarterOrder[i];
        if (Object.prototype.hasOwnProperty.call(year.quarters, q)) copy.quarters[q] = [...year.quarters[q]];
      }
      return copy;
    });

    const prefixMeetsGraduationRequirements = candidate => {
      const plannedFromCandidate = [];
      for (const year of candidate) {
        for (const [q, quarter] of Object.entries(year.quarters)) {
          const activeCourses = quarter.filter(code => code !== "_GAP");
          if (q !== "SU" && activeCourses.length > 0) {
            const scheduledQuarterUnits = activeCourses.reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
            if (scheduledQuarterUnits > 0 && scheduledQuarterUnits < minUnits) return false;
          }
          plannedFromCandidate.push(...activeCourses);
        }
      }
      const completed = effectiveCompletedCourses(profile);
      const allCourses = [...plannedFromCandidate, ...completed];
      const majorReqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
      const majorResults = Validator.validateMajor(allCourses, majorReqs);
      const geResults = Validator.validateGE(allCourses);
      const ucResults = Validator.validateUC(allCourses, profile);
      const scheduledSet = new Set(plannedFromCandidate);
      let totalCandidateUnits = plannedFromCandidate.reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
      for (const code of completed) if (COURSES[code] && !scheduledSet.has(code)) totalCandidateUnits += COURSES[code].units;
      totalCandidateUnits += (profile.priorCredits || 0);
      const upperCandidateUnits = allCourses.reduce((sum, code) => sum + (COURSES[code]?.division === "upper" ? COURSES[code].units : 0), 0);
      return majorResults.every(result => result.fulfilled)
        && geResults.every(result => result.fulfilled)
        && ucResults.every(result => result.fulfilled)
        && totalCandidateUnits >= (majorReqs.totalUnitsRequired || 180)
        && upperCandidateUnits >= (majorReqs.minUpperDivUnits || 0);
    };

    for (let yi = 0; yi < schedule.length; yi++) {
      for (const q of quarterOrder) {
        if (!Object.prototype.hasOwnProperty.call(schedule[yi].quarters, q)) continue;
        const candidate = clonePrefixThrough(yi, q);
        if (prefixMeetsGraduationRequirements(candidate)) {
          return candidate;
        }
      }
    }

    return schedule;
  },

  // --- Topological sort by prereqs ---

  topoSort(codes, completed, courseTypeMap = new Map()) {
    const codeSet = new Set(codes);
    const completedSet = completed instanceof Set ? completed : new Set(completed);
    const allKnown = new Set([...codeSet, ...completedSet]);
    const inDegree = new Map();
    const deps = new Map();

    for (const code of codes) {
      inDegree.set(code, 0);
      deps.set(code, []);
    }

    for (const code of codes) {
      const course = COURSES[code];
      if (!course) continue;
      const dependencyGroups = [
        ...(Array.isArray(course.prereqs) ? course.prereqs : []),
        ...(Array.isArray(course.concurrentPrereqs) ? course.concurrentPrereqs : [])
      ];
      for (const orGroup of dependencyGroups) {
        const inPlan = orGroup.filter(p => codeSet.has(p) && !completedSet.has(p));
        if (inPlan.length > 0) {
          inDegree.set(code, (inDegree.get(code) || 0) + 1);
          for (const p of inPlan) {
            if (!deps.has(p)) deps.set(p, []);
            deps.get(p).push(code);
          }
        }
      }
    }

    const queue = [];
    for (const [code, deg] of inDegree) {
      if (deg === 0) queue.push(code);
    }

    const downstreamDepth = new Map();
    const depthOf = (code, visiting = new Set()) => {
      if (downstreamDepth.has(code)) return downstreamDepth.get(code);
      if (visiting.has(code)) return 0;
      visiting.add(code);
      const children = deps.get(code) || [];
      const depth = children.length === 0 ? 0 : 1 + Math.max(...children.map(child => depthOf(child, new Set(visiting))));
      downstreamDepth.set(code, depth);
      return depth;
    };
    const courseNum = code => parseInt((code.match(/(\d+)/) || [0, "0"])[1], 10);
    const typePriority = code => ({ major_core: 0, prereq: 1, major_elective: 2, ge: 3, uc: 4, filler: 5 }[courseTypeMap.get(code)] ?? 6);
    const sortQueue = () => queue.sort((a, b) => {
      const daPath = depthOf(a), dbPath = depthOf(b);
      if (daPath !== dbPath) return dbPath - daPath;
      const ta = typePriority(a), tb = typePriority(b);
      if (ta !== tb) return ta - tb;
      const da = COURSES[a]?.division === "lower" ? 0 : 1;
      const db = COURSES[b]?.division === "lower" ? 0 : 1;
      if (da !== db) return da - db;
      return courseNum(a) - courseNum(b);
    });

    // Critical-path sort: among currently available courses, take courses that unlock
    // the longest remaining prerequisite chains first. This prevents late overflow
    // when a course like CSE 101 unlocks CSE 180/182 or ECON 100A unlocks ECON 113/114.
    sortQueue();

    const result = [];
    const visited = new Set();
    while (queue.length > 0) {
      const code = queue.shift();
      if (visited.has(code)) continue;
      visited.add(code);
      result.push(code);
      for (const dep of (deps.get(code) || [])) {
        const newDeg = (inDegree.get(dep) || 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg <= 0 && !visited.has(dep)) {
          queue.push(dep);
          sortQueue();
        }
      }
    }

    // Add any remaining (circular deps) at the end
    for (const code of codes) {
      if (!result.includes(code)) result.push(code);
    }
    return result;
  },

  // --- Year skeleton builder ---

  buildYearSkeleton(curTerm, curYear, gradTerm, gradYear, startLevel, studentType, includeSummer) {
    const schedule = [];
    const levelNames = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior", 5: "5th Year" };
    const termOrder = includeSummer ? ["F", "W", "S", "SU"] : ["F", "W", "S"];
    const startIdx = termOrder.indexOf(curTerm);
    const safeStartIdx = startIdx >= 0 ? startIdx : 0;
    const academicYearOf = (term, year) => (term === "F") ? year : year - 1;
    const termIndex = (term, year) => academicYearOf(term, year) * 4 + (["F", "W", "S", "SU"].indexOf(term));
    const gradAcad = academicYearOf(gradTerm, gradYear);
    const startAcad = academicYearOf(curTerm, curYear);

    // A target graduation date before the current term is not a valid planning
    // window. Return an empty skeleton; the UI prevents this, but the engine
    // should still avoid creating quarters before the selected current term.
    if (termIndex(gradTerm, gradYear) < termIndex(curTerm, curYear)) return schedule;

    for (let acad = startAcad; acad <= gradAcad; acad++) {
      const yearNum = acad - startAcad + startLevel;
      const year = this.makeYearObj(acad, yearNum, studentType, curTerm, gradTerm, includeSummer);
      if (acad === startAcad && safeStartIdx > 0) {
        for (let i = 0; i < safeStartIdx; i++) delete year.quarters[termOrder[i]];
      }
      if (acad === gradAcad) {
        const gradIdx = termOrder.indexOf(gradTerm);
        const safeGradIdx = gradIdx >= 0 ? gradIdx : termOrder.length - 1;
        for (let i = safeGradIdx + 1; i < termOrder.length; i++) delete year.quarters[termOrder[i]];
        if (year.quarters.SU && gradTerm !== "SU") delete year.quarters.SU;
      }
      schedule.push(year);
    }
    return schedule;
  },

  makeYearObj(academicStart, levelNum, studentType, startTerm, endTerm, includeSummer) {
    const levelNames = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior", 5: "5th Year" };
    const quarters = { F: [], W: [], S: [] };
    if (includeSummer) quarters.SU = [];
    return {
      label: `Year ${levelNum} (${levelNames[levelNum] || "Year " + levelNum})`,
      academicStart,
      levelNum,
      quarters
    };
  },

  // --- Replacement suggestions ---

  sameGEFamily(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const familyOf = geCode => {
      const req = GE_REQUIREMENTS.find(ge => ge.id === geCode || (ge.subcategories || []).includes(geCode));
      return req ? req.id : geCode;
    };
    return familyOf(a) === familyOf(b);
  },

  manualSuggestionScore(code, profile, replacedCourse) {
    const course = COURSES[code];
    if (!course) return 0;
    let score = 0;
    if (profile) {
      score += this.availabilityScore(code, profile);
      score += this.coursePreferenceScore(code, profile);
      score += this.interestScore(code, profile, { mode: "manual" });
      if (profile.concentration && (course.concentrations || []).includes(profile.concentration)) score += 450;
      if (profile.geConcentration && typeof CONCENTRATIONS !== "undefined") {
        const geConc = CONCENTRATIONS.ge.find(group => group.id === profile.geConcentration);
        if (geConc && (geConc.courses || []).includes(code)) score += 180;
        if (geConc && course.ge && (geConc.geCodes || []).some(geCode => this.sameGEFamily(geCode, course.ge))) score += 80;
      }
    } else {
      score += course.rmpScore || 0;
    }
    if (replacedCourse && replacedCourse.ge) {
      if (this.sameGEFamily(course.ge, replacedCourse.ge)) score += 500;
      else if (course.ge) score += 25;
    } else if (course.ge) {
      score += 20;
    }
    if (course.division === "lower") score += 10;
    return score;
  },

  manualSuggestionReasons(code, profile, replacedCourse, quarter, completedCourses) {
    const course = COURSES[code];
    if (!course) return [];
    const reasons = [];
    const push = (id, label) => reasons.push({ id, label });
    if (replacedCourse && replacedCourse.ge && this.sameGEFamily(course.ge, replacedCourse.ge)) {
      push("same_ge_requirement", `Matches ${replacedCourse.ge} requirement`);
    } else if (course.ge) {
      push("ge_requirement", `Counts for ${course.ge}`);
    }
    const matchesSelectedElectiveInterest = profile && this.courseInterestMatches(code, profile).elective.length > 0;
    if (matchesSelectedElectiveInterest) {
      push("major_concentration", "Matches your major focus");
    }
    const matchesSelectedGEInterest = profile && this.geInterestMatches(code, profile).length > 0;
    if (matchesSelectedGEInterest) {
      push("ge_concentration", "Matches your GE focus");
    }
    if (quarter && (course.quarters || []).includes(quarter)) {
      const quarterLabels = { F: "Fall", W: "Winter", S: "Spring", SU: "Summer" };
      push("offered_current_quarter", `Offered in ${quarterLabels[quarter] || quarter}`);
    }
    const availability = profile ? this.availabilityScore(code, profile) : 0;
    if (profile && availability > 0) push("offered_remaining_window", "Available in your planning window");
    const completedSet = new Set(Array.isArray(completedCourses) ? completedCourses : []);
    if (Validator.prereqsMet(course.prereqs, completedSet)) push("prerequisites_met", "Prerequisites met");
    if ((profile?.preferredCourses || []).includes(code)) push("preferred_course", "On your preferred list");
    const rmp = course.rmpScore || 0;
    if (profile && rmp > 0 && (profile.profImportance || "medium") !== "low") {
      push("professor_rating", `Professor rating ${rmp.toFixed(1)}`);
    } else if (!profile && rmp > 0) {
      push("professor_rating", `Professor rating ${rmp.toFixed(1)}`);
    }
    return reasons;
  },

  getReplacements(courseCode, quarter, placedCodes, schedule, query, profile) {
    const course = COURSES[courseCode];
    if (!course) return [];
    const placedSet = new Set(Array.isArray(placedCodes) ? placedCodes : []);
    const completedSet = new Set(placedCodes);
    const q = (query || "").toLowerCase().trim();

    const candidates = [];
    for (const [code, c] of Object.entries(COURSES)) {
      if (code === courseCode || placedSet.has(code)) continue;
      if (code.startsWith("FREE")) continue;
      if (!this.isCourseAllowedForProfile(code, profile)) continue;
      if (!c.quarters.includes(quarter)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedSet)) continue;
      if (q && !code.toLowerCase().includes(q) && !(c.title || "").toLowerCase().includes(q)) continue;
      candidates.push({
        code, title: c.title, units: c.units, desc: c.desc,
        ge: c.ge, rmpScore: c.rmpScore || 0, sections: c.section,
        section: c.section, division: c.division,
        preferenceScore: this.manualSuggestionScore(code, profile, course),
        reasons: this.manualSuggestionReasons(code, profile, course, quarter, placedCodes)
      });
    }
    candidates.sort((a, b) => (b.preferenceScore - a.preferenceScore) || (b.rmpScore - a.rmpScore) || a.code.localeCompare(b.code));
    return candidates.slice(0, 30);
  },

  searchAddable(quarter, placedCodes, allPlanned, query, profile) {
    const plannedSet = new Set(allPlanned);
    const completedSet = new Set(Array.isArray(placedCodes) ? placedCodes : []);
    const q = (query || "").toLowerCase().trim();

    const results = [];
    for (const [code, c] of Object.entries(COURSES)) {
      if (plannedSet.has(code)) continue;
      if (code.startsWith("FREE")) continue;
      if (!this.isCourseAllowedForProfile(code, profile)) continue;
      if (!c.quarters.includes(quarter)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedSet)) continue;
      if (q && !code.toLowerCase().includes(q) && !(c.title || "").toLowerCase().includes(q)) continue;
      results.push({
        code, title: c.title, units: c.units, desc: c.desc,
        ge: c.ge, rmpScore: c.rmpScore || 0, section: c.section, division: c.division,
        preferenceScore: this.manualSuggestionScore(code, profile, null),
        reasons: this.manualSuggestionReasons(code, profile, null, quarter, placedCodes)
      });
    }
    results.sort((a, b) => (b.preferenceScore - a.preferenceScore) || (b.rmpScore - a.rmpScore) || a.code.localeCompare(b.code));
    return results.slice(0, 30);
  },

  _countUnits(planCodes, completedSet, profile) {
    let u = 0;
    const planSet = new Set(planCodes);
    planCodes.forEach(c => { if (COURSES[c]) u += COURSES[c].units; });
    [...completedSet].forEach(c => { if (COURSES[c] && !planSet.has(c)) u += COURSES[c].units; });
    u += (profile.priorCredits || 0);
    return u;
  }
};
