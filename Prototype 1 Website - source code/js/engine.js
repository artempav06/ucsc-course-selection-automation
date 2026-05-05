// ============================================================
// engine.js  --  Schedule Generation & Requirement Validation
// ============================================================

// ------------------------------------------------------------
// REQUIREMENT VALIDATOR
// ------------------------------------------------------------

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

    // Build pick_one peer map: course → set of alternatives in the same pick_one category
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
        id: cat.id,
        name: cat.name,
        description: cat.description,
        fulfilled: false,
        selectedCourses: [],
        neededCount: 0,
        fulfilledCount: 0
      };

      switch (cat.type) {
        case "all_required": {
          status.neededCount = cat.courses.length;
          const satisfied = [];
          const missing = [];
          for (const c of cat.courses) {
            if (planned.has(c)) {
              satisfied.push(c);
            } else {
              // Check if a pick_one alternative is in the plan
              const peers = pickOnePeers.get(c);
              const alt = peers && [...peers].find(a => a !== c && planned.has(a));
              if (alt) {
                satisfied.push(alt);
              } else {
                missing.push(c);
              }
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
            const allPresent = group.courses.every(c => planned.has(c));
            if (allPresent) {
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
          const allOptions = cat.coursesA
            ? [...cat.coursesA, ...cat.coursesB]
            : cat.courses;
          status.selectedCourses = (allOptions || []).filter(c => planned.has(c));
          if (cat.id === "ELECTIVE") {
            const dcCourses = requirements.categories.find(r => r.id === "DC")?.courses || [];
            const usedDC = dcCourses.filter(c => planned.has(c));
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
      // Collect every course (planned or in hardcoded list) that satisfies this GE
      const satisfied = plannedCourses.filter(code => {
        const course = COURSES[code];
        if (!course) return false;
        if (course.ge === ge.id) return true;
        if (ge.subcategories && ge.subcategories.includes(course.ge)) return true;
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) return true;
        return false;
      });
      // Also check hardcoded course list
      const fromList = (ge.courses || []).filter(c => plannedCourses.includes(c));
      const all = [...new Set([...satisfied, ...fromList])];
      return {
        id: ge.id,
        name: ge.name,
        fulfilled: all.length >= ge.needed,
        courses: all,
        note: ge.note
      };
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
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) isFulfilled = true;
      return { id: req.id, name: req.name, fulfilled: isFulfilled, courses: satisfied, note: req.note };
    });
  },

  validateAll(schedule, profile) {
    const plannedFromSchedule = [];
    for (const year of schedule) {
      for (const quarter of Object.values(year.quarters)) {
        plannedFromSchedule.push(...quarter);
      }
    }
    const completed = profile && profile.completedCourses ? profile.completedCourses : [];
    const allCourses = [...plannedFromSchedule, ...completed];

    const majorId = (profile && profile.major) || "CS_BA";
    const majorReqs = (typeof MAJOR_REQUIREMENTS !== "undefined" && MAJOR_REQUIREMENTS[majorId])
      || CS_BA_REQUIREMENTS;

    const majorResults = this.validateMajor(allCourses, majorReqs);
    const geResults    = this.validateGE(allCourses);
    const ucResults    = this.validateUC(allCourses, profile);

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
      major: majorResults,
      ge: geResults,
      uc: ucResults,
      totalUnits,
      upperDivUnits,
      priorCredits: profile ? (profile.priorCredits || 0) : 0,
      completedUnits: completed.reduce((s, c) => s + (COURSES[c]?.units || 0), 0),
      totalUnitsMet:  totalUnits    >= majorReqs.totalUnitsRequired,
      upperDivMet:    upperDivUnits >= majorReqs.minUpperDivUnits,
      allMajorMet: majorResults.every(r => r.fulfilled),
      allGEMet:    geResults.every(r => r.fulfilled),
      allUCMet:    ucResults.every(r => r.fulfilled),
      majorReqs
    };
    result.allMet = result.allMajorMet && result.allGEMet && result.allUCMet
                    && result.totalUnitsMet && result.upperDivMet;
    return result;
  }
};


// ------------------------------------------------------------
// SCHEDULE GENERATOR
// ------------------------------------------------------------

const Scheduler = {

  // ── Entry point ──────────────────────────────────────────

  generate(profile) {
    const completedCourses  = new Set(profile.completedCourses || []);
    const interests         = profile.interests   || [];
    const geInterests       = profile.geInterests || [];
    const maxUnitsPerQuarter = profile.maxUnits   || 17;
    const includeSummer     = profile.includeSummer || false;

    // Step 1 – split selection into "core" (major-required) and "fill" (GE/UC/free)
    const { core, fill } = this.selectCoursesSplit(profile, interests, geInterests);

    // Step 2 – drop anything already completed
    const remainingCore = core.filter(c => !completedCourses.has(c));
    const remainingFill = fill.filter(c => !completedCourses.has(c));

    // Step 3 – place into quarters with 2-major + 1-GE balance
    return this.placeCoursesBalanced(
      remainingCore, remainingFill, completedCourses,
      includeSummer, maxUnitsPerQuarter, profile
    );
  },

  // ── Course selection (returns { core[], fill[] }) ────────

  selectCoursesSplit(profile, interests, geInterests) {
    const majorId = (profile && profile.major) || "CS_BA";
    if (majorId === "CS_BA") {
      return this.selectCsBaSplit(profile, interests, geInterests);
    }
    return this.selectGenericSplit(profile, interests, geInterests, majorId);
  },

  // ── CS_BA (hand-tuned) ───────────────────────────────────

  selectCsBaSplit(profile, interests, geInterests) {
    const used = new Set();
    const core = [];
    const fill = [];
    const completedSet = new Set(profile.completedCourses || []);
    const pushCore = c => { if (c && COURSES[c] && !used.has(c) && !completedSet.has(c)) { core.push(c); used.add(c); } };
    const pushFill = c => { if (c && COURSES[c] && !used.has(c) && !completedSet.has(c)) { fill.push(c); used.add(c); } };

    // Lower-division CS core (no alternatives)
    ["CSE 20","CSE 30","CSE 12","CSE 16","CSE 40"].forEach(pushCore);
    // Math + upper-div core: use major categories so alternatives are respected
    const csbaReqs = MAJOR_REQUIREMENTS.CS_BA;
    for (const cat of csbaReqs.categories) {
      if (cat.type === "choose_group") {
        const bestGroup = cat.groups.find(g => g.courses.some(c => completedSet.has(c))) || cat.groups[0];
        bestGroup.courses.filter(c => !completedSet.has(c)).forEach(pushCore);
      } else if (cat.type === "pick_one" && !["CAPSTONE","BREADTH"].includes(cat.id)) {
        if (!(cat.courses || []).some(c => completedSet.has(c) || used.has(c))) {
          pushCore((cat.courses || []).find(c => COURSES[c] && !used.has(c)) || cat.courses[0]);
        }
      }
    }
    // Breadth (3 courses)
    this.pickBreadth(interests, used, 3).forEach(pushCore);
    // Capstone + Electives
    pushCore(this.pickCapstone(interests, used));
    this.pickElectives(interests, used, 6).forEach(pushCore);

    // Auto-fill missing prerequisites for selected core courses
    this.expandWithPrereqs(core, completedSet, used).forEach(pushCore);

    // GE → fill (DB-driven, interest-aware)
    // NOTE: pickGECoursesFromDB already calls used.add() internally, so we must NOT
    // use pushFill (which guards on !used.has(c)). Push directly instead.
    this.pickGECoursesFromDB(used, completedSet, [...geInterests, ...interests])
      .forEach(c => { if (c && COURSES[c]) fill.push(c); });
    // UC → fill — same reason: pickUCCourses calls used.add() internally
    this.pickUCCourses(used, profile)
      .forEach(c => { if (c && COURSES[c]) fill.push(c); });

    // Pad to 180 units
    let total = this._countUnits([...core, ...fill], completedSet, profile);
    for (let i = 1; i <= 30 && total < 180; i++) {
      const code = `FREE ${i}`;
      if (COURSES[code] && !used.has(code)) { pushFill(code); total += COURSES[code].units; }
    }
    return { core, fill };
  },

  // ── Generic (any MAJOR_REQUIREMENTS major) ───────────────

  selectGenericSplit(profile, interests, geInterests, majorId) {
    const reqs = typeof MAJOR_REQUIREMENTS !== "undefined" ? MAJOR_REQUIREMENTS[majorId] : null;
    if (!reqs) {
      console.warn("selectGenericSplit: unknown major", majorId);
      return { core: [], fill: [] };
    }

    const completedSet = new Set(profile.completedCourses || []);
    const used = new Set();
    const core = [];
    const fill = [];

    const pushCore = c => {
      if (c && COURSES[c] && !used.has(c) && !completedSet.has(c)) {
        core.push(c); used.add(c);
      }
    };

    // Walk major requirement categories.
    // Process pick_one (DC, Capstone) BEFORE pick_n (UD_ELECTIVE) so that
    // single-course requirements like Disciplinary Communication don't get
    // their courses "stolen" by the elective pool first.
    const CAT_PRIORITY = { all_required: 0, choose_group: 1, pick_one: 2, pick_n: 3 };
    const sortedCats = [...(reqs.categories || [])].sort(
      (a, b) => (CAT_PRIORITY[a.type] ?? 3) - (CAT_PRIORITY[b.type] ?? 3)
    );
    // Courses from choose_group alternatives — skip in all_required (handled by choose_group handler)
    const chooseGroupCourses = new Set();
    for (const cat of sortedCats) {
      if (cat.type === "choose_group") {
        for (const g of (cat.groups || [])) (g.courses || []).forEach(c => chooseGroupCourses.add(c));
      }
    }

    for (const cat of sortedCats) {
      switch (cat.type) {
        case "all_required":
          (cat.courses || []).filter(c => !chooseGroupCourses.has(c)).forEach(pushCore);
          break;

        case "choose_group": {
          const groups = cat.groups || [];
          const bestGroup = groups.find(g => g.courses.some(c => completedSet.has(c))) || groups[0];
          if (bestGroup) bestGroup.courses.filter(c => COURSES[c] && !completedSet.has(c)).forEach(pushCore);
          break;
        }

        case "pick_one": {
          if ((cat.courses || []).some(c => completedSet.has(c) || used.has(c))) break;
          const pool = (cat.courses || []).filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c));
          const best = this.scoreByInterest(pool, interests)[0];
          pushCore(best || (cat.courses || []).find(c => COURSES[c] && !completedSet.has(c)));
          break;
        }

        case "pick_n": {
          const allInCat = [
            ...(cat.courses  || []),
            ...(cat.coursesA || []),
            ...(cat.coursesB || [])
          ];
          const alreadySatisfied = allInCat.filter(c => completedSet.has(c)).length;
          const stillNeeded = Math.max(0, (cat.n || 1) - alreadySatisfied);
          if (stillNeeded === 0) break;
          const pool = allInCat.filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c));
          this.scoreByInterest(pool, interests)
            .slice(0, stillNeeded)
            .forEach(pushCore);
          break;
        }
      }
    }

    // GE → fill (interest-aware, DB-driven)
    // NOTE: pickGECoursesFromDB already calls used.add() internally.
    this.pickGECoursesFromDB(used, completedSet, [...geInterests, ...interests])
      .forEach(c => { if (c && COURSES[c] && !completedSet.has(c)) fill.push(c); });

    // UC requirements → core (mandatory: AH, AI, ELWR must always be placed)
    // pickUCCourses calls used.add() internally, so just push the results to core.
    this.pickUCCourses(used, profile)
      .forEach(c => { if (c && COURSES[c] && !completedSet.has(c)) core.push(c); });

    // ── Upper-div supplement ─────────────────────────────────
    // Ensures the 60-unit upper-div requirement can be met. We pick additional
    // upper-div courses from the major's department and add them to fill BEFORE
    // FREE pad courses, so they are placed in preference to lower-div fillers.
    const minUD      = reqs.minUpperDivUnits || 60;
    const DEPT_MAP   = {
      AM: "AM", CE: "CE", CS: "CSE", EE: "ECE",
      CSGD: "CMPM", NDT: "GAME", BMEB: "BIOL", BIOTECH: "BIOL"
    };
    const majKey  = majorId.split("_")[0];       // e.g. "CS", "EE", "AM"
    const deptPfx = DEPT_MAP[majKey] || majKey;   // e.g. "CSE", "ECE", "AM"

    let curUD = [...core, ...fill].reduce(
      (s, c) => s + (COURSES[c]?.division === "upper" ? COURSES[c].units : 0), 0);

    if (curUD < minUD) {
      // Build pool: upper-div courses from the major's dept, not yet used
      const udPool = Object.keys(COURSES)
        .filter(c =>
          COURSES[c].division === "upper" &&
          !c.startsWith("FREE") &&
          !used.has(c) &&
          !completedSet.has(c) &&
          c.startsWith(deptPfx))
        // Fallback: any upper-div course not yet used
        .concat(
          Object.keys(COURSES).filter(c =>
            COURSES[c].division === "upper" &&
            !c.startsWith("FREE") &&
            !used.has(c) &&
            !completedSet.has(c) &&
            !c.startsWith(deptPfx))
        );

      for (const code of udPool) {
        if (curUD >= minUD) break;
        fill.push(code); used.add(code);
        curUD += COURSES[code].units;
      }
    }

    // Auto-fill missing prerequisites after all courses are selected
    this.expandWithPrereqs([...core, ...fill], completedSet, used).forEach(pushCore);

    // Pad to major's unit requirement (FREE pad comes after upper-div supplement)
    const targetUnits = reqs.totalUnitsRequired || 180;
    let total = this._countUnits([...core, ...fill], completedSet, profile);
    for (let i = 1; i <= 30 && total < targetUnits; i++) {
      const code = `FREE ${i}`;
      if (COURSES[code] && !used.has(code)) {
        fill.push(code); used.add(code); total += COURSES[code].units;
      }
    }

    return { core, fill };
  },

  // ── Auto-include missing prerequisites ───────────────────

  expandWithPrereqs(planCodes, completedSet, usedSet) {
    const allKnown = new Set([...planCodes, ...usedSet, ...completedSet]);
    const toAdd = [];
    const maxPasses = 4;

    for (let pass = 0; pass < maxPasses; pass++) {
      let added = false;
      for (const code of [...allKnown]) {
        const course = COURSES[code];
        if (!course || !course.prereqs) continue;
        for (const orGroup of course.prereqs) {
          const satisfied = orGroup.some(p => allKnown.has(p));
          if (satisfied) continue;
          const candidate = orGroup
            .filter(p => {
              if (!COURSES[p] || allKnown.has(p)) return false;
              const cc = COURSES[p];
              if (!cc.prereqs || cc.prereqs.length === 0) return true;
              return cc.prereqs.every(g => g.some(q => allKnown.has(q)));
            })
            .sort((a, b) => {
              const la = COURSES[a].division === "lower" ? 0 : 1;
              const lb = COURSES[b].division === "lower" ? 0 : 1;
              return la - lb;
            })[0];
          if (candidate) {
            toAdd.push(candidate);
            allKnown.add(candidate);
            added = true;
          }
        }
      }
      if (!added) break;
      if (pass === maxPasses - 1 && added) {
        console.warn("expandWithPrereqs: prerequisite chain deeper than 4 levels; some prereqs may be missing");
      }
    }
    return toAdd;
  },

  // ── GE Selection (DB-driven, interest-aware) ─────────────

  pickGECoursesFromDB(used, completedSet, interests) {
    const completedCodes = completedSet instanceof Set ? completedSet : new Set(completedSet);
    const picks = [];

    for (const ge of GE_REQUIREMENTS) {
      // Already satisfied?
      let satisfied = false;
      for (const code of [...used, ...completedCodes]) {
        const c = COURSES[code];
        if (!c) continue;
        if (c.ge === ge.id) { satisfied = true; break; }
        if (ge.subcategories && ge.subcategories.includes(c.ge)) { satisfied = true; break; }
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) { satisfied = true; break; }
      }
      if (satisfied) continue;

      // Find all matching DB courses
      const candidates = [];
      for (const [code, c] of Object.entries(COURSES)) {
        if (used.has(code) || completedCodes.has(code)) continue;
        if (code.startsWith("FREE")) continue;
        if (c.ge === ge.id) { candidates.push(code); continue; }
        if (ge.subcategories && ge.subcategories.includes(c.ge)) candidates.push(code);
      }

      // Fallback to hardcoded list
      const fallback = (ge.courses || []).filter(c => !used.has(c) && COURSES[c] && !completedCodes.has(c));
      const pool = candidates.length > 0 ? candidates : fallback;

      const scored = this.scoreByInterestGE(pool, interests, ge.id);
      if (scored.length > 0) {
        picks.push(scored[0]);
        used.add(scored[0]);
      }
    }
    return picks;
  },

  scoreByInterestGE(pool, interests, geId) {
    return pool
      .map(code => {
        let score = 0;
        // GE_INTEREST_AREAS preference (defined in data.js)
        if (typeof GE_INTEREST_AREAS !== "undefined") {
          for (const interest of (interests || [])) {
            const ia = GE_INTEREST_AREAS[interest];
            if (!ia) continue;
            if (ia.geCodes && ia.geCodes.includes(geId)) score += 5;
            if (ia.courses && ia.courses.includes(code))  score += 10;
          }
        }
        // Also check regular INTEREST_AREAS (overlapping course lists)
        for (const interest of (interests || [])) {
          if (INTEREST_AREAS[interest] && INTEREST_AREAS[interest].courses.includes(code)) {
            score += 8;
          }
        }
        // Prefer introductory courses (lower numbers)
        const m = code.match(/(\d+)/);
        if (m) score -= Math.floor(parseInt(m[1], 10) / 100);
        score += (COURSES[code]?.rmpScore || 0);
        return { code, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(s => s.code);
  },

  // ── UC Requirement Selection ─────────────────────────────

  pickUCCourses(used, profile) {
    const picks = [];
    const completedSet = new Set(profile.completedCourses || []);
    const allKnown = new Set([...used, ...completedSet]);
    for (const req of UC_REQUIREMENTS) {
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) continue;
      let satisfied = false;
      for (const code of allKnown) {
        const course = COURSES[code];
        if (!course) continue;
        if (req.courses.includes(code)) { satisfied = true; break; }
        if (course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) { satisfied = true; break; }
      }
      if (!satisfied) {
        for (const c of req.courses) {
          if (!used.has(c) && !completedSet.has(c) && COURSES[c]) { picks.push(c); used.add(c); break; }
        }
      }
    }
    return picks;
  },

  // ── Balanced Placement ────────────────────────────────────
  // Goal: each quarter gets ~2 major courses first (core),
  //       then fills remaining units with GE/elective (fill).

  placeCoursesBalanced(coreCourses, fillCourses, completedCourses, includeSummer, maxUnits, profile) {
    const placed = new Set(completedCourses);

    const curTerm     = profile.currentTerm     || "F";
    const curYear     = profile.currentYear     || new Date().getFullYear();
    const gradTerm    = profile.targetGradTerm  || "S";
    const gradYear    = profile.targetGradYear  || (curYear + 4);
    const startLevel  = profile.currentLevel    || 1;
    const studentType = profile.studentType     || "undergrad";

    const schedule = this.buildAcademicYearSkeleton(
      curTerm, curYear, gradTerm, gradYear, startLevel, studentType, includeSummer
    );

    // Build the set of GAP quarter keys ("calYear-Q", e.g. "2027-F") to skip
    const gapKeys = new Set();
    if (profile.gapEnabled && profile.gapTerm && profile.gapYear) {
      const gapTerms = (profile.gapType === "year")
        ? (profile.includeSummer ? ["F", "W", "S", "SU"] : ["F", "W", "S"])
        : [profile.gapTerm];
      const gapBaseYear = parseInt(profile.gapYear, 10);
      gapTerms.forEach(t => {
        // Fall belongs to gapBaseYear; Winter/Spring belong to gapBaseYear+1
        const calY = (t === "F") ? gapBaseYear : gapBaseYear + 1;
        gapKeys.add(`${calY}-${t}`);
      });
    }

    // Helper: get calendar year for a quarter in a given academic-year skeleton entry
    const calYearOf = (q, sched) => (q === "F") ? sched.academicStart : sched.academicStart + 1;

    // Sort both queues topologically (prerequisite order)
    const coreQ = this.topologicalSort(coreCourses, completedCourses);
    const fillQ = this.topologicalSort(fillCourses, completedCourses);

    // Build chronological list of active (non-GAP, non-summer) quarters
    // and mark GAP quarters with a sentinel in the schedule
    const allQuarters = [];
    for (let yi = 0; yi < schedule.length; yi++) {
      for (const q of Object.keys(schedule[yi].quarters)) {
        if (q === "SU" && !includeSummer) continue;
        const key = `${calYearOf(q, schedule[yi])}-${q}`;
        if (gapKeys.has(key)) {
          schedule[yi].quarters[q] = ["_GAP"]; // sentinel for renderer
          schedule[yi].gapQuarters = schedule[yi].gapQuarters || new Set();
          schedule[yi].gapQuarters.add(q);
          continue;
        }
        allQuarters.push({ yi, q });
      }
    }

    const coreR = [...coreQ];
    const fillR = [...fillQ];

    // Heavy majors (BMEB, BIOTECH, EE, CE) have 30+ core courses —
    // allow 3 core per quarter so they fit in 5–6 years instead of 8+.
    // Threshold raised to 30 (from 22) to avoid squeezing fill slots on
    // medium-size majors like AM_BS (~29 core) that still need fill for GE.
    const maxCorePerQ = coreCourses.length > 30 ? 3 : 2;

    for (const { yi, q } of allQuarters) {
      const quarterArr = schedule[yi].quarters[q];
      let unitsLeft = maxUnits;

      // Prereqs must be completed in a PRIOR quarter, not the current one.
      // Snapshot what's completed before this quarter starts.
      const completedBefore = new Set(placed);

      // ── Phase 1: place up to maxCorePerQ core courses (major requirements) ──
      let corePlaced = 0;
      for (let i = 0; i < coreR.length && corePlaced < maxCorePerQ && unitsLeft > 0;) {
        const code = coreR[i];
        const course = COURSES[code];
        if (!course) { coreR.splice(i, 1); continue; }
        if (course.quarters.includes(q) &&
            Validator.prereqsMet(course.prereqs, completedBefore) &&
            course.units <= unitsLeft) {
          quarterArr.push(code);
          unitsLeft -= course.units;
          coreR.splice(i, 1); corePlaced++;
        } else { i++; }
      }

      // ── Phase 2: fill remaining units with GE / elective ──
      for (let i = 0; i < fillR.length && unitsLeft >= 3;) {
        const code = fillR[i];
        const course = COURSES[code];
        if (!course) { fillR.splice(i, 1); continue; }
        if (course.quarters.includes(q) &&
            Validator.prereqsMet(course.prereqs, completedBefore) &&
            course.units <= unitsLeft) {
          quarterArr.push(code);
          unitsLeft -= course.units;
          fillR.splice(i, 1);
        } else { i++; }
      }

      // ── Phase 3: quarter still light? add more core ──
      if (unitsLeft >= 5 && coreR.length > 0) {
        for (let i = 0; i < coreR.length && unitsLeft > 0;) {
          const code = coreR[i];
          const course = COURSES[code];
          if (!course) { coreR.splice(i, 1); continue; }
          if (course.quarters.includes(q) &&
              Validator.prereqsMet(course.prereqs, completedBefore) &&
              course.units <= unitsLeft) {
            quarterArr.push(code);
            unitsLeft -= course.units;
            coreR.splice(i, 1);
          } else { i++; }
        }
      }

      // ── Phase 4: still room? add more fill ──
      if (unitsLeft >= 3 && fillR.length > 0) {
        for (let i = 0; i < fillR.length && unitsLeft >= 3;) {
          const code = fillR[i];
          const course = COURSES[code];
          if (!course) { fillR.splice(i, 1); continue; }
          if (course.quarters.includes(q) &&
              Validator.prereqsMet(course.prereqs, completedBefore) &&
              course.units <= unitsLeft) {
            quarterArr.push(code);
            unitsLeft -= course.units;
            fillR.splice(i, 1);
          } else { i++; }
        }
      }

      // Mark this quarter's courses as completed for future quarters
      for (const code of quarterArr) placed.add(code);
    }

    // ── Post-processing 1: overflow — spread unplaced courses into extra quarters ──
    // Core overflow: mandatory (always placed).
    // Fill overflow: only until the unit target is reached (prevents extra upper-div
    // supplement courses from extending the schedule unnecessarily).
    const targetUnitsForOverflow = (
      typeof MAJOR_REQUIREMENTS !== "undefined" &&
      MAJOR_REQUIREMENTS[profile?.major]
    ) ? (MAJOR_REQUIREMENTS[profile.major].totalUnitsRequired || 180) : 180;

    const coreOverflow = coreR.filter(c => !placed.has(c));
    const fillOverflow = fillR.filter(c => !placed.has(c));
    const hasOverflow  = coreOverflow.length > 0 || fillOverflow.length > 0;

    // Count units already placed (includes completed courses in `placed`)
    let placedUnits = [...placed].reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
    if (profile.priorCredits) placedUnits += profile.priorCredits;

    if (hasOverflow) {
      let overflowY = schedule[schedule.length - 1];
      let lastQ     = Object.keys(overflowY.quarters)
                        .filter(q => overflowY.quarters[q][0] !== "_GAP").pop() || "S";
      let oUnits    = (overflowY.quarters[lastQ] || [])
                        .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

      const advanceQuarter = () => {
        const qOrder = ["F", "W", "S"];
        const curIdx = qOrder.indexOf(lastQ);
        if (curIdx < qOrder.length - 1) {
          lastQ = qOrder[curIdx + 1];
          if (!overflowY.quarters[lastQ]) overflowY.quarters[lastQ] = [];
          oUnits = overflowY.quarters[lastQ]
            .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
          return true;
        }
        return false;
      };

      const gradAcad = (gradTerm === "F") ? gradYear : gradYear - 1;
      const maxOverflowYears = 1;
      let overflowFull = false;

      const addNewYear = () => {
        const lastSched = schedule[schedule.length - 1];
        const nextAcad  = lastSched.academicStart + 1;
        if (nextAcad > gradAcad + maxOverflowYears) {
          overflowFull = true;
          return;
        }
        const newYear   = this.makeYearObj(nextAcad, lastSched.levelNum + 1, studentType, "F", "S", false);
        schedule.push(newYear);
        overflowY = newYear;
        lastQ     = "F";
        oUnits    = 0;
      };

      const placeOne = (code, checkPrereqs) => {
        if (overflowFull) return false;
        if (!COURSES[code] || placed.has(code)) return false;
        if (checkPrereqs && !Validator.prereqsMet(COURSES[code].prereqs, placed)) return false;
        const cu = COURSES[code].units;
        if (oUnits + cu > maxUnits) {
          if (!advanceQuarter()) addNewYear();
        }
        if (overflowFull) return false;
        if (oUnits + cu > maxUnits) {
          if (!advanceQuarter()) addNewYear();
        }
        if (overflowFull) return false;
        overflowY.quarters[lastQ].push(code);
        placed.add(code);
        oUnits += cu;
        placedUnits += cu;
        return true;
      };

      // Place remaining mandatory core courses, deferring those with unmet prereqs
      const deferred = [];
      for (const code of coreOverflow) {
        if (!placeOne(code, true)) deferred.push(code);
      }
      // Retry deferred courses (prereqs may now be satisfied after earlier placements)
      for (const code of deferred) placeOne(code, true);
      // Final pass without prereq check so mandatory courses are never dropped
      for (const code of deferred) placeOne(code, false);

      // Place fill overflow: always place upper-div courses until minUpperDivUnits
      // is satisfied (even past the total-unit target), but skip lower-div fill
      // once the total unit target is already met.
      const minUDRequired = (
        typeof MAJOR_REQUIREMENTS !== "undefined" &&
        MAJOR_REQUIREMENTS[profile?.major]
      ) ? (MAJOR_REQUIREMENTS[profile.major].minUpperDivUnits || 60) : 60;

      let placedUpperDiv = [...placed].reduce(
        (s, c) => s + (COURSES[c]?.division === "upper" ? COURSES[c].units : 0), 0);

      for (const code of fillOverflow) {
        const course = COURSES[code];
        if (!course) continue;
        const isUD  = course.division === "upper";
        const udMet = placedUpperDiv >= minUDRequired;

        // Both targets met → stop
        if (placedUnits >= targetUnitsForOverflow && udMet) break;
        // Skip lower-div courses once the total-unit target is already met
        if (!isUD && placedUnits >= targetUnitsForOverflow) continue;

        if (placeOne(code, true) && isUD) placedUpperDiv += course.units;
      }
      // Retry fill courses whose prereqs couldn't be met (still needed for unit target)
      if (placedUnits < targetUnitsForOverflow) {
        for (const code of fillOverflow) {
          if (placedUnits >= targetUnitsForOverflow) break;
          const course = COURSES[code];
          if (!course || placed.has(code)) continue;
          if (placeOne(code, false) && course.division === "upper") {
            placedUpperDiv += course.units;
          }
        }
      }
    }

    // ── Post-processing 2: fill any still-empty quarter with a FREE elective ──
    // Iterates over the FULL final schedule (including overflow years added after
    // allQuarters was built) so no quarter is left blank.
    let freeIdx = 1;
    const getNextFree = () => {
      while (freeIdx <= 99) {
        const code = `FREE ${freeIdx++}`;
        if (COURSES[code] && !placed.has(code)) return code;
      }
      return null; // shouldn't happen with 30 FREE slots
    };
    for (let yi = 0; yi < schedule.length; yi++) {
      for (const q of Object.keys(schedule[yi].quarters)) {
        const quarterArr = schedule[yi].quarters[q];
        // Skip GAP sentinels and non-empty quarters
        if (quarterArr.length !== 0) continue;
        // Try remaining fill first
        let filled = false;
        for (let i = 0; i < fillR.length; i++) {
          const code = fillR[i];
          // Guard: skip courses already placed by the overflow section
          if (COURSES[code] && !placed.has(code) && Validator.prereqsMet(COURSES[code].prereqs, placed)) {
            quarterArr.push(code);
            placed.add(code);
            fillR.splice(i, 1);
            filled = true;
            break;
          }
        }
        // Fallback to FREE slot
        // Fallback to FREE slot
        if (!filled) {
          const freeCode = getNextFree();
          if (freeCode) { quarterArr.push(freeCode); placed.add(freeCode); }
        }
      }
    }

    return schedule;
  },

  // ── Helpers ───────────────────────────────────────────────

  _countUnits(planCodes, completedSet, profile) {
    let u = 0;
    const planSet = new Set(planCodes);
    planCodes.forEach(c => { if (COURSES[c]) u += COURSES[c].units; });
    [...completedSet].forEach(c => { if (COURSES[c] && !planSet.has(c)) u += COURSES[c].units; });
    u += (profile.priorCredits || 0);
    return u;
  },

  scoreByInterest(pool, interests) {
    return pool
      .map(code => {
        let score = 0;
        (interests || []).forEach(interest => {
          if (INTEREST_AREAS[interest] && INTEREST_AREAS[interest].courses.includes(code)) score += 10;
        });
        score += (COURSES[code]?.rmpScore || 0);
        return { code, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(s => s.code);
  },

  // ── CS_BA hand-tuned helpers (Breadth / Capstone / Elective) ──

  pickBreadth(interests, used, count) {
    const breadthCat = CS_BA_REQUIREMENTS.categories.find(c => c.id === "BREADTH");
    if (!breadthCat) return [];
    const allBreadth = [...(breadthCat.coursesA || []), ...(breadthCat.coursesB || [])];
    const scored = allBreadth
      .filter(c => !used.has(c) && COURSES[c])
      .map(c => {
        let score = 0;
        interests.forEach(interest => {
          if (INTEREST_AREAS[interest] && INTEREST_AREAS[interest].courses.includes(c)) score += 10;
        });
        if (COURSES[c].section.includes("CAPSTONE")) score += 3;
        if (COURSES[c].ge) score += 2;
        score += (COURSES[c].rmpScore || 0);
        return { code: c, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.code);
  },

  pickCapstone(interests, used) {
    const capstoneCat = CS_BA_REQUIREMENTS.categories.find(c => c.id === "CAPSTONE");
    if (!capstoneCat) return null;
    const capstoneList = capstoneCat.courses;
    for (const c of capstoneList) {
      if (used.has(c) && COURSES[c] && COURSES[c].section.includes("CAPSTONE")) return c;
    }
    const scored = capstoneList
      .filter(c => !used.has(c) && COURSES[c])
      .map(c => {
        let score = 0;
        interests.forEach(interest => {
          if (INTEREST_AREAS[interest] && INTEREST_AREAS[interest].courses.includes(c)) score += 10;
        });
        score += (COURSES[c].rmpScore || 0);
        return { code: c, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.length > 0 ? scored[0].code : capstoneList[0];
  },

  pickElectives(interests, used, count) {
    const electiveCat = CS_BA_REQUIREMENTS.categories.find(c => c.id === "ELECTIVE");
    if (!electiveCat) return [];
    const scored = electiveCat.courses
      .filter(c => !used.has(c) && COURSES[c])
      .map(c => {
        let score = 0;
        interests.forEach(interest => {
          if (INTEREST_AREAS[interest] && INTEREST_AREAS[interest].courses.includes(c)) score += 10;
        });
        score += (COURSES[c].rmpScore || 0);
        return { code: c, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.code);
  },

  // ── Topological sort (prerequisite ordering) ─────────────

  topologicalSort(courseCodes, completed) {
    const graph    = new Map();
    const inDegree = new Map();

    for (const code of courseCodes) { graph.set(code, []); inDegree.set(code, 0); }

    for (const code of courseCodes) {
      const course = COURSES[code];
      if (!course || !course.prereqs) continue;
      for (const orGroup of course.prereqs) {
        const relevantPrereqs = orGroup.filter(p => courseCodes.includes(p) && !completed.has(p));
        if (relevantPrereqs.length > 0) {
          const prereq = relevantPrereqs[0];
          if (graph.has(prereq)) {
            graph.get(prereq).push(code);
            inDegree.set(code, (inDegree.get(code) || 0) + 1);
          }
        }
      }
    }

    const queue  = [];
    const result = [];
    for (const [code, degree] of inDegree) {
      if (degree === 0) queue.push(code);
    }
    queue.sort((a, b) => this.coursePriority(a) - this.coursePriority(b));

    while (queue.length > 0) {
      const code = queue.shift();
      result.push(code);
      for (const neighbor of (graph.get(code) || [])) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
          queue.sort((a, b) => this.coursePriority(a) - this.coursePriority(b));
        }
      }
    }

    // Append any courses not reached (e.g. cycles)
    for (const code of courseCodes) {
      if (!result.includes(code)) result.push(code);
    }
    return result;
  },

  // Priority: lower number = schedule earlier
  coursePriority(code) {
    const course = COURSES[code];
    if (!course) return 99;
    if (code.startsWith("FREE")) return 15;

    // CS_BA hand-tagged sections
    if (course.section.includes("CS_LD_CORE"))  return 1;
    if (course.section.includes("MATH_CALC") || course.section.includes("MATH_LIN_ALG")) return 2;

    // Division-based generic ordering
    if (course.division === "lower") return 3;
    if (code === "WRIT 1") return 3;

    // GE / UC courses mid-priority (interleaved with lower-div)
    if (course.ge) return 5;
    if (code === "HIS 10B" || code === "HIS 80A" || code === "POLI 20") return 5;
    if (code === "WRIT 2") return 5;

    // Upper-division tagged sections
    if (course.section.includes("UD_CORE"))   return 6;
    if (course.section.includes("BREADTH_A") || course.section.includes("BREADTH_B")) return 7;
    if (course.section.includes("DC"))        return 8;
    if (course.section.includes("CAPSTONE"))  return 9;
    if (course.section.includes("ELECTIVE"))  return 9;

    // Generic upper-div
    if (course.division === "upper") return 7;

    return 10;
  },

  // ── Schedule Skeleton ────────────────────────────────────

  buildAcademicYearSkeleton(curTerm, curYear, gradTerm, gradYear, startLevel, studentType, includeSummer) {
    const curAcad  = (curTerm  === "F") ? curYear  : curYear  - 1;
    const gradAcad = (gradTerm === "F") ? gradYear : gradYear - 1;

    if (gradAcad < curAcad) {
      return [this.makeYearObj(curAcad, startLevel, studentType, curTerm, gradTerm, includeSummer)];
    }

    const schedule = [];
    let levelOffset = 0;
    for (let acad = curAcad; acad <= gradAcad; acad++) {
      const isFirst = acad === curAcad;
      const isLast  = acad === gradAcad;
      schedule.push(this.makeYearObj(
        acad,
        startLevel + levelOffset,
        studentType,
        isFirst ? curTerm  : "F",
        isLast  ? gradTerm : "S",
        includeSummer
      ));
      levelOffset++;
    }
    return schedule;
  },

  makeYearObj(academicStart, levelNum, studentType, startQuarter, endQuarter, includeSummer) {
    const termOrder = ["F", "W", "S"];
    const isSUStart = (startQuarter === "SU");
    const isSUEnd = (endQuarter === "SU");
    const startIdx = isSUStart ? 0 : Math.max(0, termOrder.indexOf(startQuarter));
    const endIdx   = isSUEnd ? 2 : termOrder.indexOf(endQuarter);
    const effectiveEnd = endIdx < 0 ? 2 : endIdx;

    const quarters = {};
    for (let i = startIdx; i <= effectiveEnd; i++) {
      quarters[termOrder[i]] = [];
    }
    if (includeSummer || isSUStart || isSUEnd) quarters["SU"] = [];

    return {
      academicStart,
      label: this.formatYearLabel(levelNum, studentType),
      levelNum,
      studentType,
      quarters
    };
  },

  formatYearLabel(levelNum, studentType) {
    if (studentType === "grad") return `MS Year ${levelNum}`;
    const names = { 1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior" };
    const name  = names[levelNum];
    return name ? `Year ${levelNum} (${name})` : `Year ${levelNum}`;
  },

  // ── Swap / Add helpers ────────────────────────────────────

  // Returns valid replacement courses for a given slot.
  // If `query` is provided, filters by code/title prefix (search).
  getReplacements(courseCode, quarterKey, takenCourses, schedule, query) {
    const course = COURSES[courseCode];
    if (!course) return [];

    const completedBefore = new Set(takenCourses);
    const sections = course.section;
    const queryLC  = (query || "").trim().toLowerCase();
    const results  = [];

    for (const [code, c] of Object.entries(COURSES)) {
      if (code === courseCode) continue;
      if (takenCourses.includes(code)) continue;
      if (code.startsWith("FREE")) continue;

      if (!c.quarters.includes(quarterKey)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedBefore)) continue;

      const hasOverlap = c.section.some(s => sections.includes(s));
      const sameGE     = c.ge && c.ge === course.ge;

      if (!hasOverlap && !sameGE) continue;

      // Apply search filter if provided
      if (queryLC) {
        const codeLower  = code.toLowerCase();
        const titleLower = (c.title || "").toLowerCase();
        if (!codeLower.includes(queryLC) && !titleLower.includes(queryLC)) continue;
      }

      results.push({
        code, title: c.title, units: c.units,
        ge: c.ge, desc: c.desc, rmpScore: c.rmpScore, sections: c.section
      });
    }

    results.sort((a, b) => (b.rmpScore || 0) - (a.rmpScore || 0));
    return results;
  },

  // Search all available-to-add courses for a quarter.
  // Respects prereqs, not-already-planned, and optional query.
  searchAddable(quarterKey, takenBefore, allPlanned, query) {
    const completedSet = new Set(takenBefore);
    const plannedSet   = new Set(allPlanned);
    const queryLC      = (query || "").trim().toLowerCase();
    const results      = [];

    for (const [code, c] of Object.entries(COURSES)) {
      if (plannedSet.has(code)) continue;
      if (code.startsWith("FREE")) continue;
      if (!c.quarters.includes(quarterKey)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedSet)) continue;

      if (queryLC) {
        const codeLower  = code.toLowerCase();
        const titleLower = (c.title || "").toLowerCase();
        const codeStripped = codeLower.replace(/\s+/g, "");
        const queryStripped = queryLC.replace(/\s+/g, "");
        if (!codeLower.includes(queryLC) &&
            !codeStripped.startsWith(queryStripped) &&
            !titleLower.includes(queryLC)) continue;
      }

      results.push({ code, ...c });
    }

    results.sort((a, b) => (b.rmpScore || 0) - (a.rmpScore || 0));
    return results;
  },

  // Legacy wrapper kept for backward compatibility
  selectCourses(profile, interests) {
    const { core, fill } = this.selectCoursesSplit(profile, interests, []);
    return [...core, ...fill];
  }
};
