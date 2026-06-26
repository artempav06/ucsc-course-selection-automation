// ============================================================
// engine.js — Prototype 2: Decision-Tree Schedule Generator
// Single walk() for all majors. Concentration-driven elective ranking.
// ============================================================

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
  return normalizer.normalizeRequirementSet({
    major,
    geRequirements: (typeof GE_REQUIREMENTS !== "undefined") ? GE_REQUIREMENTS : [],
    ucRequirements: (typeof UC_REQUIREMENTS !== "undefined") ? UC_REQUIREMENTS : [],
    profile: normalizedProfile
  });
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
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) isFulfilled = true;
      return { id: req.id, name: req.name, fulfilled: isFulfilled, courses: satisfied, note: req.note };
    });
  },

  validateSchedule(schedule, profile) {
    const plannedFromSchedule = [];
    for (const year of schedule)
      for (const quarter of Object.values(year.quarters))
        plannedFromSchedule.push(...quarter);
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
      majorReqs
    };
    result.allMet = result.allMajorMet && result.allGEMet && result.allUCMet
                    && result.totalUnitsMet && result.upperDivMet;
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

  buildRequirementSet(profile) {
    return buildNormalizedRequirementSet(profile);
  },

  collectRequirements(profile) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.collect !== "function") return null;
    return collector.collect(this.buildRequirementSet(profile));
  },

  selectMajorCourses(profile) {
    const collector = (typeof RequirementCollector !== "undefined") ? RequirementCollector : null;
    if (!collector || typeof collector.selectMajorCourses !== "function") return null;
    const collected = this.collectRequirements(profile);
    return collector.selectMajorCourses(collected, profile, {
      courses: COURSES,
      rankByConcentration: (pool, concentration, selectionProfile, usedSet, virtuallyPresent) =>
        this.rankByConcentration(pool, concentration, selectionProfile, usedSet, virtuallyPresent)
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

  generate(profile) {
    return this.generateWithExplanation(profile, { includeValidation: false }).schedule;
  },

  generateWithExplanation(profile, options = {}) {
    const completedSet = new Set(profile.completedCourses || []);
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
    explanation.phases.geSelection = {
      courses: geCourses.slice(),
      count: geCourses.length,
      units: phaseUnits(geCourses)
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
      targetUnits: reqs.totalUnitsRequired || 180
    };

    // --- Phase 7: Build filler pool ---
    const normalizedFillerPool = this.buildNormalizedFillerPool(profile, used, virtuallyPresent);
    const fillerPool = normalizedFillerPool || this.buildFillerPool(profile, used, virtuallyPresent);
    explanation.phases.fillerPool = {
      candidates: fillerPool.slice(),
      count: fillerPool.length
    };

    // --- Phase 8: Place into quarters ---
    const remaining = selected.filter(c => !completedSet.has(c));
    const schedule = this.placeSelectedCourses(profile, remaining, courseTypeMap, fillerPool, completedSet);
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
        const pool = (cat.courses || []).filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c) && !vp.has(c));
        const alreadySatisfied = (cat.courses || []).filter(c => completedSet.has(c) || used.has(c)).length;
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
      .map(code => {
        let score = 0;
        if (concentration) {
          const concs = COURSES[code]?.concentrations || [];
          if (concs.includes(concentration)) score += 100;
        }
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

  pickGE(used, completedSet, geConcentration, profile) {
    const picks = [];
    const geConc = geConcentration && typeof CONCENTRATIONS !== "undefined"
      ? CONCENTRATIONS.ge.find(g => g.id === geConcentration) : null;
    const geConcCourses = geConc ? new Set(geConc.courses) : null;

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
        if (c.ge === ge.id) { satisfied = true; break; }
        if (ge.subcategories && ge.subcategories.includes(c.ge)) { satisfied = true; break; }
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) { satisfied = true; break; }
      }
      if (satisfied) continue;

      const candidates = [];
      for (const [code, c] of Object.entries(COURSES)) {
        if (used.has(code) || completedSet.has(code)) continue;
        if (code.startsWith("FREE")) continue;
        if (c.ge === ge.id) { candidates.push(code); continue; }
        if (ge.subcategories && ge.subcategories.includes(c.ge)) candidates.push(code);
      }
      const fallback = (ge.courses || []).filter(c => !used.has(c) && COURSES[c] && !completedSet.has(c));
      const pool = candidates.length > 0 ? candidates : fallback;

      const scored = pool
        .map(code => {
          let score = 0;
          if (geConcCourses && geConcCourses.has(code)) score += 100;
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
    const completedSet = new Set(profile.completedCourses || []);
    for (const req of UC_REQUIREMENTS) {
      if (req.id === "ELWR" && profile && profile.elwrSatisfied) continue;
      let satisfied = false;
      // used is a superset of completedSet, so checking used alone suffices
      for (const code of used) {
        if (req.courses.includes(code)) { satisfied = true; break; }
        const course = COURSES[code];
        if (course && course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) { satisfied = true; break; }
      }
      if (!satisfied) {
        for (const c of req.courses) {
          if (!used.has(c) && COURSES[c]) { picks.push(c); used.add(c); break; }
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
        if (!course.prereqs) continue;
        for (const orGroup of course.prereqs) {
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
      && !c.startsWith("FREE")
      && Array.isArray(COURSES[c].quarters)
      && COURSES[c].quarters.length > 0
      && !used.has(c)
      && !completedSet.has(c)
      && !vp.has(c)
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
      if (c.units < 1 || c.units > 5) continue;
      if (!c.quarters || c.quarters.length === 0) continue;
      if (prereqFor.has(code)) continue;
      let score = 0;
      if (concentration && (c.concentrations || []).includes(concentration)) score += 50;
      if (geConcSet && geConcSet.has(code)) score += 30;
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
    const maxUnits = profile.maxUnits || 19;
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
      const labCode = COURSES[code].labCoreq;
      if (labCode && COURSES[labCode] && !placed.has(labCode) && !quarterArr.includes(labCode)) {
        const labInRemaining = remaining.indexOf(labCode);
        const labInFiller = fillerR.indexOf(labCode);
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

      // Phase A: Place up to 2 major/prereq courses
      for (let i = 0; i < remaining.length && majorCount < 2;) {
        const code = remaining[i];
        if (!MAJOR_TYPES.has(courseTypeMap.get(code))) { i++; continue; }
        if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) { i++; continue; }
        remaining.splice(i, 1);
        quarterArr._unitsUsed = unitsUsed;
        const added = placeWithCoreq(code, quarterArr, completedBefore);
        unitsUsed += added; majorCount++;
      }

      // Phase B: Place non-major courses (ge, uc, filler) up to target range
      for (let i = 0; i < remaining.length && unitsUsed < maxUnits;) {
        const code = remaining[i];
        if (MAJOR_TYPES.has(courseTypeMap.get(code))) { i++; continue; }
        if (!canPlace(code, q, completedBefore, unitsUsed, schedule[yi].levelNum)) { i++; continue; }
        remaining.splice(i, 1);
        quarterArr._unitsUsed = unitsUsed;
        const added = placeWithCoreq(code, quarterArr, completedBefore);
        unitsUsed += added;
      }

      // Phase C: Third major course if still under minimum
      if (unitsUsed < minUnits) {
        for (let i = 0; i < remaining.length && majorCount < 3;) {
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

    // Do not synthesize anything beyond the minimum degree-unit padding above.
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
      if (!course || !course.prereqs) continue;
      for (const orGroup of course.prereqs) {
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

  getReplacements(courseCode, quarter, placedCodes, schedule, query) {
    const course = COURSES[courseCode];
    if (!course) return [];
    const placedSet = new Set(Array.isArray(placedCodes) ? placedCodes : []);
    const completedSet = new Set(placedCodes);
    const q = (query || "").toLowerCase().trim();

    const candidates = [];
    for (const [code, c] of Object.entries(COURSES)) {
      if (code === courseCode || placedSet.has(code)) continue;
      if (code.startsWith("FREE")) continue;
      if (!c.quarters.includes(quarter)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedSet)) continue;
      if (q && !code.toLowerCase().includes(q) && !(c.title || "").toLowerCase().includes(q)) continue;
      candidates.push({
        code, title: c.title, units: c.units, desc: c.desc,
        ge: c.ge, rmpScore: c.rmpScore || 0, sections: c.section,
        section: c.section, division: c.division
      });
    }
    candidates.sort((a, b) => (b.rmpScore - a.rmpScore) || a.code.localeCompare(b.code));
    return candidates.slice(0, 30);
  },

  searchAddable(quarter, placedCodes, allPlanned, query) {
    const plannedSet = new Set(allPlanned);
    const completedSet = new Set(Array.isArray(placedCodes) ? placedCodes : []);
    const q = (query || "").toLowerCase().trim();

    const results = [];
    for (const [code, c] of Object.entries(COURSES)) {
      if (plannedSet.has(code)) continue;
      if (code.startsWith("FREE")) continue;
      if (!c.quarters.includes(quarter)) continue;
      if (!Validator.prereqsMet(c.prereqs, completedSet)) continue;
      if (q && !code.toLowerCase().includes(q) && !(c.title || "").toLowerCase().includes(q)) continue;
      results.push({
        code, title: c.title, units: c.units, desc: c.desc,
        ge: c.ge, rmpScore: c.rmpScore || 0, section: c.section, division: c.division
      });
    }
    results.sort((a, b) => (b.rmpScore - a.rmpScore) || a.code.localeCompare(b.code));
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
