// ============================================================
// app.js  --  Main Application Controller
// Handles the wizard flow, schedule rendering, course detail
// panels, swap functionality, and UI interactions.
// ============================================================

function escHTML(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ---------- APPLICATION STATE ----------
const AppState = {
  currentView: "landing",     // landing | wizard | schedule
  wizardStep: 1,              // 1-4
  profile: {
    major: "CS_BA",
    studentType: "undergrad",  // undergrad | grad
    currentLevel: 1,           // 1-5 for undergrad, 1-2 for grad
    currentTerm: "F",          // F | W | S | SU
    currentYear: 2026,         // calendar year of current term
    completedCourses: [],
    priorCredits: 0,           // AP/transfer/dual-enrollment units
    elwrSatisfied: false,
    targetGradTerm: "S",       // target term the student wants to graduate in
    targetGradYear: 2028,      // target calendar year of graduation
    includeSummer: false,
    maxUnits: 19,
    minUnits: 12,
    concentration: null,
    geConcentration: null,
    autoSuggest: true,
    profImportance: "medium",  // low | medium | high
    gapEnabled: false,
    gapType: "quarter",        // "quarter" | "year"
    gapTerm: "F",              // "F" | "W" | "S"
    gapYear: 2027              // calendar year when gap starts
  },
  schedule: null,              // generated schedule
  validation: null             // validation results
};


// ---------- TERM / LEVEL HELPERS ----------

const LEVEL_LABELS = {
  1: "Freshman",
  2: "Sophomore",
  3: "Junior",
  4: "Senior",
  5: "5th Year"
};

// Parse a level code like "UG_2" or "MS_1" → { type, num }
function parseLevelCode(code) {
  const [type, num] = code.split("_");
  return {
    type: type === "UG" ? "undergrad" : (type === "MS" ? "grad" : "grad"),
    num: parseInt(num, 10)
  };
}

// Term order for a given academic year (Fall is first)
const TERM_ORDER = ["F", "W", "S"];
const TERM_ORDER_WITH_SUMMER = ["F", "W", "S", "SU"];

// Map a quarter code + academic-year-start to a calendar year
function quarterCalendarYear(q, academicStart) {
  return (q === "F") ? academicStart : academicStart + 1;
}

// Given current term + calendar year, compute the academic year start
// (e.g. W 2027 → academic year starting 2026)
function academicYearStartOf(term, calYear) {
  return (term === "F") ? calYear : calYear - 1;
}


// ---------- VIEW MANAGEMENT ----------

function showView(viewName) {
  // Hide all views
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  // Show requested view
  const view = document.getElementById(`view-${viewName}`);
  if (view) {
    view.classList.add("active");
    AppState.currentView = viewName;
  }
  // Scroll to top
  window.scrollTo(0, 0);
}


// ---------- LANDING PAGE ----------

function initLanding() {
  const startBtn = document.getElementById("btn-start");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      showView("wizard");
      showWizardStep(1);
    });
  }
}


// ---------- WIZARD FLOW ----------

function showWizardStep(step) {
  AppState.wizardStep = step;

  // Hide all wizard steps
  document.querySelectorAll(".wizard-step").forEach(s => s.classList.remove("active"));

  // Show current step
  const stepEl = document.getElementById(`wizard-step-${step}`);
  if (stepEl) stepEl.classList.add("active");

  // Update progress bar
  updateWizardProgress(step);
}

function updateWizardProgress(step) {
  const dots = document.querySelectorAll(".progress-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("completed", i < step - 1);
    dot.classList.toggle("active", i === step - 1);
  });

  const bar = document.getElementById("progress-fill");
  if (bar) bar.style.width = `${((step - 1) / 3) * 100}%`;
}

function initWizard() {
  // Populate dynamic year dropdowns
  populateYearDropdowns();

  // Populate major dropdown from MAJOR_REQUIREMENTS registry
  populateMajorDropdown();

  // Step 1: Academic Profile
  document.getElementById("btn-wizard-next-1")?.addEventListener("click", () => {
    AppState.profile.major = document.getElementById("select-major").value;

    const levelInfo = parseLevelCode(document.getElementById("select-level").value);
    AppState.profile.studentType = levelInfo.type;
    AppState.profile.currentLevel = levelInfo.num;

    AppState.profile.currentTerm = document.getElementById("select-current-term").value;
    AppState.profile.currentYear = parseInt(document.getElementById("select-current-year").value, 10);

    // Auto-advance the default grad-year dropdown if it's now in the past
    refreshGradYearDefault();

    // Re-populate concentration grids whenever major changes
    populateConcentrationGrids(AppState.profile.major);

    showWizardStep(2);
  });

  // Also re-populate concentrations when major dropdown changes directly
  document.getElementById("select-major")?.addEventListener("change", (e) => {
    populateConcentrationGrids(e.target.value);
  });

  // Initial population with default major
  populateConcentrationGrids(AppState.profile.major);

  // Step 2: Academic History
  document.getElementById("btn-wizard-next-2")?.addEventListener("click", () => {
    AppState.profile.elwrSatisfied = document.getElementById("check-elwr").checked;
    const pc = parseInt(document.getElementById("input-prior-credits").value, 10);
    AppState.profile.priorCredits = isNaN(pc) || pc < 0 ? 0 : Math.min(120, pc);
    showWizardStep(3);
  });
  document.getElementById("btn-wizard-back-2")?.addEventListener("click", () => showWizardStep(1));

  // Step 3: Graduation Preferences
  document.getElementById("btn-wizard-next-3")?.addEventListener("click", () => {
    if (!isGradWindowValid()) {
      updateGradDurationHint();
      return;
    }

    AppState.profile.targetGradTerm = document.getElementById("select-grad-term").value;
    AppState.profile.targetGradYear = parseInt(document.getElementById("select-grad-year").value, 10);
    AppState.profile.includeSummer = document.getElementById("check-summer").checked;

    const maxUnitsValue = parseInt(document.getElementById("input-max-units")?.value, 10);
    AppState.profile.maxUnits = Number.isFinite(maxUnitsValue)
      ? Math.min(25, Math.max(12, maxUnitsValue))
      : 19;

    AppState.profile.profImportance = document.getElementById("select-prof-importance").value;

    // GAP period
    AppState.profile.gapEnabled = document.getElementById("check-gap")?.checked ?? false;
    if (AppState.profile.gapEnabled) {
      AppState.profile.gapType = document.getElementById("select-gap-type")?.value || "quarter";
      AppState.profile.gapTerm = document.getElementById("select-gap-term")?.value || "F";
      AppState.profile.gapYear = parseInt(document.getElementById("select-gap-year")?.value, 10)
                                  || new Date().getFullYear() + 1;
    }

    showWizardStep(4);
  });
  document.getElementById("btn-wizard-back-3")?.addEventListener("click", () => showWizardStep(2));

  // Step 4: Concentration & Generate
  document.getElementById("btn-generate")?.addEventListener("click", () => {
    collectConcentrations();
    AppState.profile.autoSuggest = document.getElementById("check-auto-suggest").checked;
    generateAndShowSchedule();
  });
  document.getElementById("btn-wizard-back-4")?.addEventListener("click", () => showWizardStep(3));

  // Max Units preset buttons
  const maxUnitsInput = document.getElementById("input-max-units");
  document.querySelectorAll(".unit-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.units;
      if (maxUnitsInput) maxUnitsInput.value = val;
      document.querySelectorAll(".unit-preset").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  if (maxUnitsInput) {
    maxUnitsInput.addEventListener("input", () => {
      // Clear preset highlight if user types a custom value
      document.querySelectorAll(".unit-preset").forEach(b => {
        b.classList.toggle("active", b.dataset.units === maxUnitsInput.value);
      });
    });
  }

  // Grad duration hint updates live when user changes grad term/year
  ["select-grad-term", "select-grad-year"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", updateGradDurationHint);
  });
  ["select-current-term", "select-current-year"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      refreshGradYearDefault();
      updateGradDurationHint();
    });
  });

  // Initialize completed courses checklist & search
  initCompletedCoursesUI();
  initCourseSearch();

  // Transcript upload (Step 2)
  initTranscriptUpload();

  // GAP period UI (Step 3)
  initGapUI();
}

// Populate the major dropdown from the MAJOR_REQUIREMENTS registry.
// Runs once on wizard init — every declared major (hand-tuned or
// auto-merged from curriculum chart PDFs) shows up automatically.
function populateMajorDropdown() {
  const sel = document.getElementById("select-major");
  if (!sel || typeof MAJOR_REQUIREMENTS === "undefined") return;

  // Sort alphabetically by display name for a stable, predictable order.
  const entries = Object.entries(MAJOR_REQUIREMENTS)
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  sel.innerHTML = "";
  for (const [id, major] of entries) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = major.name;
    // Default-select CS_BA if present — it's the only hand-tuned major
    // with a fully-working schedule generator, so it's the safest default.
    if (id === "CS_BA") opt.selected = true;
    sel.appendChild(opt);
  }

}

// Populate year dropdowns for current-year and grad-year selectors
function populateYearDropdowns() {
  const nowYear = new Date().getFullYear();
  const curSel  = document.getElementById("select-current-year");
  const gradSel = document.getElementById("select-grad-year");

  if (curSel) {
    curSel.innerHTML = "";
    for (let y = nowYear - 1; y <= nowYear + 3; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === nowYear) opt.selected = true;
      curSel.appendChild(opt);
    }
  }

  if (gradSel) {
    gradSel.innerHTML = "";
    for (let y = nowYear; y <= nowYear + 8; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === nowYear + 2) opt.selected = true; // sensible default
      gradSel.appendChild(opt);
    }
  }
}

// Keep the target grad year from being before the current year
function refreshGradYearDefault() {
  const curYear = parseInt(document.getElementById("select-current-year")?.value, 10);
  const gradSel = document.getElementById("select-grad-year");
  if (!curYear || !gradSel) return;
  if (parseInt(gradSel.value, 10) < curYear) {
    gradSel.value = curYear + 2;
  }
}

// Show a friendly duration string under the target grad pickers
function updateGradDurationHint() {
  const hint = document.getElementById("grad-duration-hint");
  if (!hint) return;
  const curTerm = document.getElementById("select-current-term")?.value;
  const curYear = parseInt(document.getElementById("select-current-year")?.value, 10);
  const gradTerm = document.getElementById("select-grad-term")?.value;
  const gradYear = parseInt(document.getElementById("select-grad-year")?.value, 10);
  if (!curTerm || !curYear || !gradTerm || !gradYear) return;

  const quarters = quartersBetween(curTerm, curYear, gradTerm, gradYear);
  if (quarters < 1) {
    hint.textContent = "Target is before current term. Please adjust before continuing.";
    hint.style.color = "#c62828";
    return;
  }
  const yearsApprox = (quarters / 3).toFixed(1);
  hint.textContent = `That's ${quarters} quarter${quarters === 1 ? "" : "s"} (~${yearsApprox} years) of planning.`;
  hint.style.color = "";
}

function isGradWindowValid() {
  const curTerm = document.getElementById("select-current-term")?.value;
  const curYear = parseInt(document.getElementById("select-current-year")?.value, 10);
  const gradTerm = document.getElementById("select-grad-term")?.value;
  const gradYear = parseInt(document.getElementById("select-grad-year")?.value, 10);
  return !!(curTerm && curYear && gradTerm && gradYear) && quartersBetween(curTerm, curYear, gradTerm, gradYear) >= 1;
}

// Count quarters between two (term, year) positions, inclusive of the start
function quartersBetween(startTerm, startYear, endTerm, endYear) {
  const order = ["F", "W", "S", "SU"];
  const idx = (t, y) => {
    const academic = academicYearStartOf(t, y);
    const ord = order.indexOf(t);
    return academic * order.length + (ord < 0 ? 0 : ord);
  };
  return idx(endTerm, endYear) - idx(startTerm, startYear) + 1;
}

// ---------- TRANSCRIPT UPLOAD ----------

function initTranscriptUpload() {
  const dropZone  = document.getElementById("transcript-drop-zone");
  const fileInput = document.getElementById("transcript-file-input");
  const browseBtn = document.getElementById("btn-transcript-browse");
  if (!dropZone || !fileInput) return;

  // Clicking the drop zone (but not the browse button) opens the file picker
  dropZone.addEventListener("click", e => {
    if (e.target !== browseBtn) fileInput.click();
  });

  // Browse button click
  browseBtn?.addEventListener("click", e => {
    e.stopPropagation();
    fileInput.click();
  });

  // File selected via picker
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleTranscriptUpload(file);
    fileInput.value = ""; // allow re-uploading same file
  });

  // Drag-and-drop
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      handleTranscriptUpload(file);
    } else {
      setTranscriptStatus("error", "Please drop a PDF file (.pdf).");
    }
  });
}

async function handleTranscriptUpload(file) {
  setTranscriptStatus("loading", "⏳ Reading transcript…");
  try {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF.js library not loaded.");
    }
    // Point the worker at the matching CDN version
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n";
    }

    const found = parseTranscriptText(fullText);

    if (found.length === 0) {
      setTranscriptStatus("error",
        "No recognizable UCSC courses were found in this PDF. " +
        "Please verify it's an unofficial transcript from MyUCSC, or add courses manually.");
      return;
    }

    let added = 0;
    found.forEach(code => {
      if (!AppState.profile.completedCourses.includes(code)) {
        AppState.profile.completedCourses.push(code);
        added++;
      }
    });
    syncCompletedCoursesUI();

    const skipped = found.length - added;
    const skipNote = skipped > 0 ? `, ${skipped} were already in your list` : "";
    setTranscriptStatus("success",
      `✅ Found ${found.length} course${found.length === 1 ? "" : "s"} — ` +
      `added ${added}${skipNote}.`);
  } catch (err) {
    console.error("Transcript parse error:", err);
    setTranscriptStatus("error",
      "Could not read the PDF. Please try again or add courses manually below.");
  }
}

function parseTranscriptText(text) {
  // Match patterns like "CSE 101", "MATH 19A", "PHYS 5L", "AM 10", "WRIT 2"
  const regex = /\b([A-Z]{2,5})\s{1,5}(\d{1,3}[A-Z]{0,2})\b/g;
  const found = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = `${match[1]} ${match[2]}`;
    if (COURSES[code] && !code.startsWith("FREE")) {
      found.add(code);
    }
  }
  return [...found];
}

function setTranscriptStatus(type, msg) {
  const el = document.getElementById("transcript-status");
  if (!el) return;
  el.className = `transcript-status ${type}`;
  el.textContent = msg;
}


// ---------- GAP PERIOD UI ----------

function initGapUI() {
  // Populate the GAP starting-year dropdown
  const gapYearSel = document.getElementById("select-gap-year");
  if (gapYearSel) {
    const nowYear = new Date().getFullYear();
    gapYearSel.innerHTML = "";
    for (let y = nowYear; y <= nowYear + 8; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === nowYear + 1) opt.selected = true;
      gapYearSel.appendChild(opt);
    }
  }

  // Toggle the options panel when the checkbox changes
  const gapCheck   = document.getElementById("check-gap");
  const gapOptions = document.getElementById("gap-options");
  if (gapCheck && gapOptions) {
    gapCheck.addEventListener("change", () => {
      gapOptions.style.display = gapCheck.checked ? "block" : "none";
    });
  }
}


// ---------- COMPLETED COURSES UI ----------

function initCompletedCoursesUI() {
  const container = document.getElementById("completed-courses-list");
  if (!container) return;
  container.innerHTML = "";

  // Show lower-division courses that could be completed
  const lowerDivCourses = ["CSE 20", "CSE 30", "CSE 12", "CSE 16", "CSE 40",
                           "MATH 19A", "MATH 19B", "MATH 20A", "MATH 20B",
                           "AM 10", "MATH 21", "WRIT 1", "WRIT 2"];

  lowerDivCourses.forEach(code => {
    const course = COURSES[code];
    if (!course) return;

    const label = document.createElement("label");
    label.className = "course-checkbox";
    label.innerHTML = `
      <input type="checkbox" value="${code}" class="completed-check">
      <span class="check-label">
        <strong>${code}</strong> - ${course.title} (${course.units} units)
      </span>
    `;
    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) addCompletedCourse(code);
      else removeCompletedCourse(code);
    });
    container.appendChild(label);
  });
}

// ---------- COURSE SEARCH ----------

function initCourseSearch() {
  const input = document.getElementById("course-search-input");
  const results = document.getElementById("course-search-results");
  if (!input || !results) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results.innerHTML = "";
      results.classList.remove("active");
      return;
    }
    const matches = searchCourses(query).slice(0, 10);
    renderSearchResults(matches, results, input);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", e => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove("active");
    }
  });
  input.addEventListener("focus", () => {
    if (results.innerHTML.trim()) results.classList.add("active");
  });
}

function searchCourses(query) {
  const results = [];
  for (const [code, course] of Object.entries(COURSES)) {
    if (code.startsWith("FREE")) continue;
    const codeLower  = code.toLowerCase();
    const titleLower = (course.title || "").toLowerCase();
    // Allow "cse20" to match "CSE 20"
    const codeStripped = codeLower.replace(/\s+/g, "");
    const queryStripped = query.replace(/\s+/g, "");

    let score = 0;
    if (codeLower.startsWith(query)) score = 100;
    else if (codeStripped.startsWith(queryStripped)) score = 95;
    else if (codeLower.includes(query)) score = 80;
    else if (titleLower.startsWith(query)) score = 70;
    else if (titleLower.includes(query)) score = 50;
    if (score > 0) results.push({ code, course, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

function renderSearchResults(matches, container, input) {
  if (matches.length === 0) {
    container.innerHTML = '<div class="search-empty">No matching courses in our database.</div>';
    container.classList.add("active");
    return;
  }
  container.innerHTML = matches.map(({ code, course }) => {
    const already = AppState.profile.completedCourses.includes(code);
    return `
      <div class="search-result ${already ? "already" : ""}" data-code="${code}">
        <div class="search-result-main">
          <strong>${code}</strong> &mdash; ${course.title}
          <span class="search-result-units">${course.units} units</span>
        </div>
        <div class="search-result-meta">${course.desc ? course.desc.slice(0, 80) + (course.desc.length > 80 ? "..." : "") : ""}</div>
        ${already ? '<div class="search-result-badge">Added</div>' : ""}
      </div>
    `;
  }).join("");
  container.classList.add("active");

  // Click handler
  container.querySelectorAll(".search-result").forEach(el => {
    el.addEventListener("click", () => {
      const code = el.dataset.code;
      if (!AppState.profile.completedCourses.includes(code)) {
        addCompletedCourse(code);
      }
      input.value = "";
      container.innerHTML = "";
      container.classList.remove("active");
    });
  });
}

// ---------- COMPLETED COURSES STATE ----------

function addCompletedCourse(code) {
  if (!AppState.profile.completedCourses.includes(code)) {
    AppState.profile.completedCourses.push(code);
  }
  syncCompletedCoursesUI();
}

function removeCompletedCourse(code) {
  AppState.profile.completedCourses = AppState.profile.completedCourses.filter(c => c !== code);
  syncCompletedCoursesUI();
}

// Re-render the selected list and sync the checkbox state
function syncCompletedCoursesUI() {
  const selectedList = document.getElementById("selected-courses-list");
  if (selectedList) {
    const taken = AppState.profile.completedCourses;
    if (taken.length === 0) {
      selectedList.innerHTML = '<p class="selected-empty">No courses added yet. Use the search above or the suggestions below.</p>';
    } else {
      let totalUnits = 0;
      taken.forEach(c => { if (COURSES[c]) totalUnits += COURSES[c].units; });
      selectedList.innerHTML = `
        <div class="selected-total">${taken.length} course${taken.length === 1 ? "" : "s"} &middot; ${totalUnits} units counted toward your degree</div>
        <div class="selected-chips">
          ${taken.map(code => {
            const c = COURSES[code];
            const title = c ? c.title : "Unknown";
            const units = c ? c.units : "?";
            return `
              <div class="selected-chip" data-code="${code}">
                <div class="chip-main"><strong>${code}</strong> ${title}</div>
                <div class="chip-side">
                  <span class="chip-units">${units} u</span>
                  <button type="button" class="chip-remove" data-code="${code}" title="Remove">&times;</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
      selectedList.querySelectorAll(".chip-remove").forEach(btn => {
        btn.addEventListener("click", () => removeCompletedCourse(btn.dataset.code));
      });
    }
  }

  // Sync any suggestion checkboxes
  document.querySelectorAll(".completed-check").forEach(cb => {
    cb.checked = AppState.profile.completedCourses.includes(cb.value);
  });
}

function collectConcentrations() {
  const majorRadio = document.querySelector('input[name="major-concentration"]:checked');
  const geRadio    = document.querySelector('input[name="ge-concentration"]:checked');
  AppState.profile.concentration   = majorRadio ? majorRadio.value || null : null;
  AppState.profile.geConcentration = geRadio    ? geRadio.value    || null : null;
}

function populateConcentrationGrids(majorId) {
  const majorGrid = document.getElementById("concentration-grid");
  const geGrid    = document.getElementById("ge-concentration-grid");
  if (!majorGrid || !geGrid) return;

  // Major concentrations
  const majorConcs = (typeof CONCENTRATIONS !== "undefined" && CONCENTRATIONS.major[majorId]) || [];
  majorGrid.innerHTML = `
    <label class="interest-option">
      <input type="radio" name="major-concentration" value="" checked>
      <span class="interest-label">No preference</span>
    </label>
  ` + majorConcs.map(c => `
    <label class="interest-option">
      <input type="radio" name="major-concentration" value="${escHTML(c.id)}">
      <span class="interest-label">${escHTML(c.name)}</span>
      ${c.description ? `<span class="interest-desc">${escHTML(c.description)}</span>` : ""}
    </label>
  `).join("");

  // GE concentrations
  const geConcs = (typeof CONCENTRATIONS !== "undefined" && CONCENTRATIONS.ge) || [];
  geGrid.innerHTML = `
    <label class="interest-option">
      <input type="radio" name="ge-concentration" value="" checked>
      <span class="interest-label">No preference</span>
    </label>
  ` + geConcs.map(c => `
    <label class="interest-option">
      <input type="radio" name="ge-concentration" value="${escHTML(c.id)}">
      <span class="interest-label">${escHTML(c.name)}</span>
      ${c.description ? `<span class="interest-desc">${escHTML(c.description)}</span>` : ""}
    </label>
  `).join("");
}


// ---------- SCHEDULE GENERATION & DISPLAY ----------

function setScheduleLoading(isLoading) {
  const loading = document.getElementById("loading-screen");
  if (loading) {
    loading.classList.toggle("active", Boolean(isLoading));
    loading.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  const generateBtn = document.getElementById("btn-generate");
  if (generateBtn) {
    if (isLoading && !generateBtn.dataset.originalLabel) {
      generateBtn.dataset.originalLabel = generateBtn.textContent || "Generate My Schedule";
    }
    generateBtn.disabled = Boolean(isLoading);
    generateBtn.textContent = isLoading
      ? "Building your schedule…"
      : (generateBtn.dataset.originalLabel || "Generate My Schedule");
  }
}

function scheduleAfterLoadingPaint(fn) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => setTimeout(fn, 0));
  } else {
    setTimeout(fn, 0);
  }
}

function showGenerationError() {
  const alertBox = document.getElementById("alert-box");
  if (!alertBox) return;
  alertBox.innerHTML = `
    <div class="alert-error">
      <strong>We couldn't build your schedule.</strong>
      Please review your preferences and try again. If this keeps happening, restart the planner or remove recently added constraints.
    </div>
  `;
  alertBox.style.display = "block";
}

function generateAndShowSchedule() {
  setScheduleLoading(true);

  // Let the browser paint the loading screen before heavier engine work starts.
  scheduleAfterLoadingPaint(() => {
    try {
      // Generate schedule using the engine
      AppState.schedule = Scheduler.generate(AppState.profile);

      // Validate
      AppState.validation = Validator.validateAll(AppState.schedule, AppState.profile);

      // Switch to schedule view
      showView("schedule");

      // Render
      renderSchedule();
      renderRequirements();
      showValidationAlerts();
    } catch (err) {
      console.error("Schedule generation error:", err);
      showView("schedule");
      showGenerationError();
    } finally {
      setScheduleLoading(false);
    }
  }, 0);
}

function renderSchedule() {
  const container = document.getElementById("schedule-grid");
  if (!container) return;
  container.innerHTML = "";

  AppState.schedule.forEach((yearData, yearIdx) => {
    // Year header
    const yearSection = document.createElement("div");
    yearSection.className = "year-section";

    const yearHeader = document.createElement("div");
    yearHeader.className = "year-header";
    const acadRange = `${yearData.academicStart}–${yearData.academicStart + 1}`;
    yearHeader.innerHTML = `
      <h3>${yearData.label} <span class="acad-year-range">(${acadRange})</span></h3>
    `;
    yearSection.appendChild(yearHeader);

    // Quarters in a row
    const quartersRow = document.createElement("div");
    quartersRow.className = "quarters-row";

    const quarterKeys = Object.keys(yearData.quarters);
    quarterKeys.forEach(q => {
      const courses = yearData.quarters[q];
      const quarterCol = document.createElement("div");
      quarterCol.className = "quarter-column";

      // Quarter header — show the calendar year alongside the term name
      const qHeader = document.createElement("div");
      qHeader.className = "quarter-header";
      const isGapQuarter = courses.length === 1 && courses[0] === "_GAP";
      const totalUnits = isGapQuarter
        ? 0
        : courses.reduce((sum, c) => sum + (COURSES[c]?.units || 0), 0);
      const calYear = quarterCalendarYear(q, yearData.academicStart);
      const unitTier = isGapQuarter ? "" : (totalUnits >= 15 && totalUnits <= 19) ? " tier-target" : (totalUnits >= 12 && totalUnits <= 22) ? " tier-accept" : " tier-over";
      qHeader.innerHTML = `
        <span class="quarter-name">${QUARTER_LABELS[q] || q} ${calYear}</span>
        <span class="quarter-units${unitTier}">${isGapQuarter ? "GAP" : totalUnits + " units"}</span>
      `;
      quarterCol.appendChild(qHeader);

      if (isGapQuarter) {
        // Render special GAP block
        const gapBlock = document.createElement("div");
        gapBlock.className = "quarter-gap";
        gapBlock.innerHTML = `
          <div class="quarter-gap-icon">✈️</div>
          <div class="quarter-gap-label">GAP Period</div>
          <div class="quarter-gap-note">Leave of absence planned this quarter</div>
        `;
        quarterCol.appendChild(gapBlock);
      } else {
        // Course cards
        courses.forEach(code => {
          const card = createCourseCard(code, q, yearIdx);
          quarterCol.appendChild(card);
        });

        // Add course button
        const addBtn = document.createElement("button");
        addBtn.className = "btn-add-course";
        addBtn.textContent = "+ Add Course";
        addBtn.addEventListener("click", () => openAddCourseModal(yearIdx, q));
        quarterCol.appendChild(addBtn);
      }

      quartersRow.appendChild(quarterCol);
    });

    yearSection.appendChild(quartersRow);
    container.appendChild(yearSection);
  });
}

function createCourseCard(code, quarterKey, yearIdx) {
  const course = COURSES[code];
  const card = document.createElement("div");
  card.className = "course-card";
  card.dataset.code = code;
  card.dataset.quarter = quarterKey;
  card.dataset.year = yearIdx;

  // Get color based on primary section
  const section = course ? course.section[0] : "FREE";
  const colors = SECTION_COLORS[section] || SECTION_COLORS["FREE"];

  card.style.borderLeftColor = colors.border;
  card.style.backgroundColor = colors.bg;

  // courseType badge
  const typeMap = AppState.schedule && AppState.schedule.courseTypeMap;
  const courseType = typeMap ? typeMap.get(code) : null;
  const TYPE_LABELS = { major_core: "Major", major_elective: "Elective", ge: "GE", uc: "UC", prereq: "Prereq", filler: "Filler" };
  const typeBadge = courseType && TYPE_LABELS[courseType]
    ? `<span class="course-type-badge ctype-${escHTML(courseType)}">${escHTML(TYPE_LABELS[courseType])}</span>`
    : "";

  // GE badge
  const geBadge = course && course.ge
    ? `<span class="ge-badge">${escHTML(course.ge)}</span>`
    : "";

  // RMP badge
  const rmpBadge = course && course.rmpScore > 0
    ? `<span class="rmp-badge" title="Rate My Professor Score">${course.rmpScore.toFixed(1)}</span>`
    : "";

  card.innerHTML = `
    <div class="card-top">
      <span class="card-code">${escHTML(code)}</span>
      <span class="card-units">${course ? course.units : "?"} cr</span>
    </div>
    <div class="card-title">${course ? escHTML(course.title) : "Unknown Course"}</div>
    <div class="card-badges">
      ${typeBadge}
      <span class="section-badge" style="color:${colors.border}">${escHTML(colors.label)}</span>
      ${geBadge}
      ${rmpBadge}
    </div>
  `;

  // Click to open detail panel
  card.addEventListener("click", () => openCourseDetail(code, quarterKey, yearIdx));

  return card;
}


// ---------- COURSE DETAIL PANEL ----------

function openCourseDetail(code, quarterKey, yearIdx) {
  const course = COURSES[code];
  if (!course) return;

  const modal = document.getElementById("modal-course-detail");
  if (!modal) return;

  const catalogUrl = getCatalogUrl(code);
  const rmpSearchUrl = `https://www.ratemyprofessors.com/search/professors?q=ucsc`;

  // Prereq display
  let prereqText = "None";
  if (course.prereqs && course.prereqs.length > 0) {
    prereqText = course.prereqs.map(orGroup => orGroup.join(" or ")).join("; AND ");
  }

  // Sections display
  const sectionsHtml = course.section.map(s => {
    const c = SECTION_COLORS[s] || SECTION_COLORS["FREE"];
    return `<span class="detail-section-tag" style="background:${c.bg};color:${c.border};border:1px solid ${c.border}">${c.label}</span>`;
  }).join(" ");

  document.getElementById("detail-content").innerHTML = `
    <div class="detail-header">
      <h2>${escHTML(code)}: ${escHTML(course.title)}</h2>
      <button class="btn-close-modal" onclick="closeModal('modal-course-detail')">&times;</button>
    </div>

    <div class="detail-body">
      <div class="detail-row">
        <span class="detail-label">Units:</span>
        <span>${course.units}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Division:</span>
        <span>${course.division === "upper" ? "Upper Division" : "Lower Division"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Offered:</span>
        <span>${course.quarters.map(q => QUARTER_LABELS[q]).join(", ")}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Prerequisites:</span>
        <span>${prereqText}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">GE Code:</span>
        <span>${course.ge || "None"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Satisfies:</span>
        <span>${sectionsHtml}</span>
      </div>
      ${course.rmpScore > 0 ? `
      <div class="detail-row">
        <span class="detail-label">RMP Score:</span>
        <span class="rmp-display">
          ${renderStars(course.rmpScore)}
          <strong>${course.rmpScore.toFixed(1)}</strong>/5.0
        </span>
      </div>` : ""}

      <div class="detail-desc">
        <p>${escHTML(course.desc)}</p>
      </div>

      <div class="detail-links">
        <a href="${catalogUrl}" target="_blank" class="btn-link">
          View in UCSC Catalog
        </a>
        <a href="${rmpSearchUrl}" target="_blank" class="btn-link btn-link-secondary">
          Rate My Professor
        </a>
      </div>

      <div class="detail-actions">
        <button class="btn-action btn-swap" onclick="openSwapModal('${code.replace(/'/g,"\\'")}', '${quarterKey}', ${yearIdx})">
          Swap Course
        </button>
        <button class="btn-action btn-remove" onclick="removeCourse('${code.replace(/'/g,"\\'")}', '${quarterKey}', ${yearIdx})">
          Remove Course
        </button>
      </div>
    </div>
  `;

  modal.classList.add("active");
}

function renderStars(score) {
  const full = Math.floor(score);
  const half = score - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let html = "";
  for (let i = 0; i < full; i++)  html += '<span class="star full">&#9733;</span>';
  for (let i = 0; i < half; i++)  html += '<span class="star half">&#9733;</span>';
  for (let i = 0; i < empty; i++) html += '<span class="star empty">&#9734;</span>';
  return html;
}

function renderSuggestionReasons(reasons) {
  const safeReasons = (reasons || []).slice(0, 4).filter(reason => reason && reason.label);
  if (safeReasons.length === 0) return "";
  return `
    <div class="suggestion-reasons" aria-label="Why this course is suggested">
      ${safeReasons.map(reason => `<span class="suggestion-reason-chip">${escHTML(reason.label)}</span>`).join("")}
    </div>
  `;
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
}


// ---------- COURSE SWAP FUNCTIONALITY ----------

function openSwapModal(code, quarterKey, yearIdx) {
  closeModal("modal-course-detail");
  const modal = document.getElementById("modal-swap");
  if (!modal) return;

  const renderSwapList = (query) => {
    const takenBefore    = getCoursesBeforeQuarter(yearIdx, quarterKey);
    const replacements   = Scheduler.getReplacements(code, quarterKey, takenBefore, AppState.schedule, query, AppState.profile);
    if (replacements.length === 0) {
      return `<p class="no-results">${query ? "No matching courses found." : "No valid replacement courses available for this quarter."}</p>`;
    }
    return replacements.slice(0, 30).map(r => {
      const colors = SECTION_COLORS[r.sections[0]] || SECTION_COLORS["FREE"];
      return `
        <div class="swap-option" onclick="performSwap('${code.replace(/'/g,"\\'")}', '${r.code.replace(/'/g,"\\'")}', '${quarterKey}', ${yearIdx})">
          <div class="swap-option-top">
            <strong>${escHTML(r.code)}</strong>: ${escHTML(r.title)}
            <span class="swap-units">${r.units} cr</span>
          </div>
          <div class="swap-option-desc">${r.desc ? escHTML(r.desc.slice(0, 100)) + (r.desc.length > 100 ? "…" : "") : ""}</div>
          <div class="swap-option-badges">
            <span class="section-badge" style="color:${colors.border}">${colors.label}</span>
            ${r.ge ? `<span class="ge-badge">${r.ge}</span>` : ""}
            ${r.rmpScore > 0 ? `<span class="rmp-badge">${r.rmpScore.toFixed(1)}</span>` : ""}
          </div>
          ${renderSuggestionReasons(r.reasons)}
        </div>
      `;
    }).join("");
  };

  document.getElementById("swap-content").innerHTML = `
    <div class="detail-header">
      <h2>Replace ${code}</h2>
      <button class="btn-close-modal" onclick="closeModal('modal-swap')">&times;</button>
    </div>
    <input id="swap-search-input" type="text" class="modal-search-input"
           placeholder="Search by code or title (e.g. &quot;CSE 140&quot;, &quot;machine learning&quot;)&hellip;">
    <p class="swap-info">Available courses for ${QUARTER_LABELS[quarterKey]} — prerequisites met:</p>
    <div class="swap-list" id="swap-list-container">${renderSwapList("")}</div>
  `;

  // Live search
  const searchInput = document.getElementById("swap-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const container = document.getElementById("swap-list-container");
      if (container) container.innerHTML = renderSwapList(searchInput.value);
    });
    searchInput.focus();
  }

  modal.classList.add("active");
}

function performSwap(oldCode, newCode, quarterKey, yearIdx) {
  const quarters = AppState.schedule[yearIdx].quarters[quarterKey];
  const idx = quarters.indexOf(oldCode);
  if (idx !== -1) {
    quarters[idx] = newCode;
  }

  closeModal("modal-swap");

  // Re-validate and re-render
  AppState.validation = Validator.validateAll(AppState.schedule, AppState.profile);
  renderSchedule();
  renderRequirements();
  showValidationAlerts();
}

function removeCourse(code, quarterKey, yearIdx) {
  const quarters = AppState.schedule[yearIdx].quarters[quarterKey];
  const idx = quarters.indexOf(code);
  if (idx !== -1) {
    quarters.splice(idx, 1);
  }

  closeModal("modal-course-detail");

  AppState.validation = Validator.validateAll(AppState.schedule, AppState.profile);
  renderSchedule();
  renderRequirements();
  showValidationAlerts();
}

function openAddCourseModal(yearIdx, quarterKey) {
  const modal = document.getElementById("modal-swap");
  if (!modal) return;

  const renderAddList = (query) => {
    const takenBefore = getCoursesBeforeQuarter(yearIdx, quarterKey);
    const allPlanned  = getAllPlannedCourses();
    const results     = Scheduler.searchAddable(quarterKey, takenBefore, allPlanned, query, AppState.profile);

    if (results.length === 0) {
      return `<p class="no-results">${query ? "No matching courses found." : "No additional courses available for this quarter."}</p>`;
    }
    return results.slice(0, 30).map(r => {
      const colors = SECTION_COLORS[r.section[0]] || SECTION_COLORS["FREE"];
      return `
        <div class="swap-option" onclick="addCourseToQuarter('${r.code.replace(/'/g,"\\'")}', '${quarterKey}', ${yearIdx})">
          <div class="swap-option-top">
            <strong>${escHTML(r.code)}</strong>: ${escHTML(r.title)}
            <span class="swap-units">${r.units} cr</span>
          </div>
          <div class="swap-option-desc">${r.desc ? escHTML(r.desc.slice(0, 100)) + (r.desc.length > 100 ? "…" : "") : ""}</div>
          <div class="swap-option-badges">
            <span class="section-badge" style="color:${colors.border}">${colors.label}</span>
            ${r.ge ? `<span class="ge-badge">${r.ge}</span>` : ""}
            ${r.rmpScore > 0 ? `<span class="rmp-badge">${r.rmpScore.toFixed(1)}</span>` : ""}
          </div>
          ${renderSuggestionReasons(r.reasons)}
        </div>
      `;
    }).join("");
  };

  document.getElementById("swap-content").innerHTML = `
    <div class="detail-header">
      <h2>Add Course — ${QUARTER_LABELS[quarterKey]}</h2>
      <button class="btn-close-modal" onclick="closeModal('modal-swap')">&times;</button>
    </div>
    <input id="add-search-input" type="text" class="modal-search-input"
           placeholder="Search by code or title (e.g. &quot;PHYS 5A&quot;, &quot;statistics&quot;)&hellip;">
    <p class="swap-info">Courses available this quarter with prerequisites met:</p>
    <div class="swap-list" id="add-list-container">${renderAddList("")}</div>
  `;

  const searchInput = document.getElementById("add-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const container = document.getElementById("add-list-container");
      if (container) container.innerHTML = renderAddList(searchInput.value);
    });
    searchInput.focus();
  }

  modal.classList.add("active");
}

function addCourseToQuarter(code, quarterKey, yearIdx) {
  if (getAllPlannedCourses().includes(code)) return;
  AppState.schedule[yearIdx].quarters[quarterKey].push(code);
  closeModal("modal-swap");

  AppState.validation = Validator.validateAll(AppState.schedule, AppState.profile);
  renderSchedule();
  renderRequirements();
  showValidationAlerts();
}


// ---------- REQUIREMENT SIDEBAR ----------

function renderRequirements() {
  const container = document.getElementById("requirements-panel");
  if (!container) return;

  const v = AppState.validation;
  if (!v) return;

  let html = `
    <div class="req-summary">
      <h3>Requirement Tracker</h3>
      <div class="req-progress-bar">
        <div class="req-progress-fill" style="width:${getOverallProgress(v)}%"></div>
      </div>
      <span class="req-progress-text">${getOverallProgress(v)}% Complete</span>
    </div>

    <div class="req-units">
      <div class="req-unit-item ${v.totalUnitsMet ? 'met' : 'unmet'}">
        <span>${v.totalUnitsMet ? '&#10003;' : '&#10007;'}</span>
        Total Units: ${v.totalUnits} / ${v.majorReqs ? v.majorReqs.totalUnitsRequired : 180}
      </div>
      <div class="req-unit-item ${v.upperDivMet ? 'met' : 'unmet'}">
        <span>${v.upperDivMet ? '&#10003;' : '&#10007;'}</span>
        Upper Div: ${v.upperDivUnits} / ${v.majorReqs ? v.majorReqs.minUpperDivUnits : 60}
      </div>
      ${(v.priorCredits > 0 || v.completedUnits > 0) ? `
        <div class="req-unit-note">
          Includes ${v.completedUnits} completed units${v.priorCredits > 0 ? ` and ${v.priorCredits} prior credits (AP/transfer)` : ""}.
        </div>
      ` : ""}
    </div>

    <div class="req-section">
      <h4>Major Requirements</h4>
      ${v.major.map(r => renderReqItem(r)).join("")}
    </div>

    <div class="req-section">
      <h4>General Education</h4>
      ${v.ge.map(r => renderReqItem(r)).join("")}
    </div>

    <div class="req-section">
      <h4>UC Requirements</h4>
      ${v.uc.map(r => renderReqItem(r)).join("")}
    </div>
  `;

  // Final verification message
  if (v.allMet) {
    const catalogUrl = v.majorReqs && v.majorReqs.catalogUrl
      ? v.majorReqs.catalogUrl
      : "https://catalog.ucsc.edu/en/current/general-catalog";
    html += `
      <div class="req-complete">
        <h4>All Requirements Met!</h4>
        <p>Please verify your schedule on the official
          <a href="${catalogUrl}" target="_blank">UCSC Catalog</a>.
        </p>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderReqItem(req) {
  const icon = req.fulfilled ? '&#10003;' : '&#10007;';
  const cls = req.fulfilled ? 'met' : 'unmet';
  const courses = req.courses?.length > 0 ? req.courses.join(", ") : (req.selectedCourses?.join(", ") || "");
  const missing = req.missing?.length > 0 ? `<span class="missing">Missing: ${req.missing.join(", ")}</span>` : "";
  const countInfo = req.neededCount > 0
    ? ` (${req.fulfilledCount || req.courses?.length || 0}/${req.neededCount})`
    : "";

  return `
    <div class="req-item ${cls}">
      <div class="req-item-header">
        <span class="req-icon">${icon}</span>
        <span class="req-name">${req.name}${countInfo}</span>
      </div>
      ${courses ? `<div class="req-courses">${courses}</div>` : ""}
      ${missing}
    </div>
  `;
}

function getOverallProgress(v) {
  let total = 0;
  let fulfilled = 0;
  [...v.major, ...v.ge, ...v.uc].forEach(r => {
    total++;
    if (r.fulfilled) fulfilled++;
  });
  // Add unit checks
  total += 2;
  if (v.totalUnitsMet) fulfilled++;
  if (v.upperDivMet) fulfilled++;

  return Math.round((fulfilled / total) * 100);
}


// ---------- VALIDATION ALERTS ----------

function showValidationAlerts() {
  const v = AppState.validation;
  if (!v) return;

  const alertBox = document.getElementById("alert-box");
  if (!alertBox) return;

  const warnings = [];

  // Check for unfulfilled major requirements
  v.major.forEach(r => {
    if (!r.fulfilled) {
      warnings.push(`Major: ${r.name} not fully satisfied.`);
    }
  });

  // Check GE
  v.ge.forEach(r => {
    if (!r.fulfilled) {
      warnings.push(`GE ${r.id}: ${r.name} not satisfied.`);
    }
  });

  // Check UC
  v.uc.forEach(r => {
    if (!r.fulfilled) {
      warnings.push(`UC: ${r.name} not satisfied.`);
    }
  });

  // Units
  if (!v.totalUnitsMet) {
    const req = v.majorReqs ? v.majorReqs.totalUnitsRequired : 180;
    warnings.push(`Total units (${v.totalUnits}) below required ${req}.`);
  }

  if (warnings.length > 0) {
    alertBox.innerHTML = `
      <div class="alert-warning">
        <strong>Warnings (${warnings.length}):</strong>
        <ul>${warnings.map(w => `<li>${w}</li>`).join("")}</ul>
      </div>
    `;
    alertBox.style.display = "block";
  } else {
    const catalogUrl = AppState.validation?.majorReqs?.catalogUrl
      || "https://catalog.ucsc.edu/en/current/general-catalog";
    alertBox.innerHTML = `
      <div class="alert-success">
        <strong>All requirements are met!</strong> Your schedule is complete.
        Please double-check on the <a href="${catalogUrl}" target="_blank">official UCSC catalog</a>.
      </div>
    `;
    alertBox.style.display = "block";
  }
}


// ---------- HELPER FUNCTIONS ----------

function getCoursesBeforeQuarter(yearIdx, quarterKey) {
  const courses = [...(AppState.profile.completedCourses || [])];
  const qOrder = ["F", "W", "S", "SU"];

  for (let y = 0; y <= yearIdx; y++) {
    const year = AppState.schedule[y];
    for (const q of qOrder) {
      if (y === yearIdx && q === quarterKey) return courses;
      if (year.quarters[q]) {
        // Exclude the GAP sentinel — it's not a real course
        courses.push(...year.quarters[q].filter(c => c !== "_GAP"));
      }
    }
  }
  return courses;
}

function getAllPlannedCourses() {
  const courses = [];
  if (!AppState.schedule) return courses;
  for (const year of AppState.schedule) {
    for (const q of Object.values(year.quarters)) {
      courses.push(...q.filter(c => c !== "_GAP"));
    }
  }
  return courses;
}


// ---------- BACK TO WIZARD / RESTART ----------

function backToWizard() {
  showView("wizard");
  showWizardStep(AppState.wizardStep);
}

function restartPlanner() {
  AppState.schedule = null;
  AppState.validation = null;
  AppState.profile.completedCourses = [];
  AppState.profile.concentration = null;
  AppState.profile.geConcentration = null;
  showView("landing");
}


// ---------- INITIALIZATION ----------

document.addEventListener("DOMContentLoaded", () => {
  initLanding();
  initWizard();
  showView("landing");
});
