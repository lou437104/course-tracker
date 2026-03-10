const STORAGE_KEY = "courseTracker.v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseDate(s) {
  if (!isValidDateStr(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function safeUrl(url) {
  const u = (url || "").trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    // ignore
  }
  return "";
}

function readChecks(form, name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((x) => x.value);
}

function toast(msg, tone = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  const prefix =
    tone === "success" ? "<b>Nice.</b> " : tone === "warn" ? "<b>Heads up.</b> " : "<b>Update.</b> ";
  el.innerHTML = `${prefix}${msg}`;
  el.classList.add("show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => el.classList.remove("show"), 3200);
}

function download(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

function defaultState() {
  return {
    version: 1,
    startedAt: null,
    profile: {
      learningGoal: "",
      timeDedication: "",
      bestTime: [],
      quitReasons: [],
    },
    prefs: {
      accountability: [],
      reminderMethod: [],
      remindAt: "",
      weekendsToo: false,
      loggingMethod: "",
    },
    courses: [],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();
    return {
      ...defaultState(),
      ...parsed,
      profile: { ...defaultState().profile, ...(parsed.profile || {}) },
      prefs: { ...defaultState().prefs, ...(parsed.prefs || {}) },
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let editingCourseId = null;
let progressMode = "percent";

function estimateExpectedPercent(course, now = new Date()) {
  const start = parseDate(course.startDate);
  const target = parseDate(course.targetDate);
  if (!start || !target) return null;
  const totalDays = Math.max(1, daysBetween(start, target));
  const elapsed = clamp(daysBetween(start, now), 0, totalDays);
  return (elapsed / totalDays) * 100;
}

function getCoursePercent(course) {
  if (course.progressMode === "module") {
    const cur = Number(course.moduleCurrent || 0);
    const tot = Number(course.moduleTotal || 0);
    if (tot <= 0) return 0;
    return clamp((cur / tot) * 100, 0, 100);
  }
  return clamp(Number(course.progressPercent || 0), 0, 100);
}

function statusFor(course) {
  const pct = getCoursePercent(course);
  if (pct >= 100) return { key: "done", label: "Completed", tone: "teal" };
  const expected = estimateExpectedPercent(course);
  const target = parseDate(course.targetDate);
  const now = new Date();
  if (target && now > target && pct < 100) return { key: "behind", label: "Past deadline", tone: "danger" };
  if (expected == null) return { key: "unknown", label: "Set dates for pacing", tone: "warn" };

  const buffer = 5; // small grace to avoid feeling punitive
  if (pct + buffer >= expected) return { key: "ontrack", label: "On track", tone: "teal" };
  return { key: "behind", label: "Falling behind", tone: "danger" };
}

function milestoneHits(prevPct, nextPct) {
  const milestones = [25, 50, 75, 100];
  return milestones.filter((m) => prevPct < m && nextPct >= m);
}

function syncFormsFromState() {
  const profileForm = document.getElementById("profileForm");
  const prefsForm = document.getElementById("prefsForm");

  profileForm.learningGoal.value = state.profile.learningGoal || "";
  profileForm.timeDedication.value = state.profile.timeDedication || "";
  profileForm.querySelectorAll('input[name="bestTime"]').forEach((cb) => {
    cb.checked = (state.profile.bestTime || []).includes(cb.value);
  });
  profileForm.querySelectorAll('input[name="quitReasons"]').forEach((cb) => {
    cb.checked = (state.profile.quitReasons || []).includes(cb.value);
  });

  prefsForm.querySelectorAll('input[name="accountability"]').forEach((cb) => {
    cb.checked = (state.prefs.accountability || []).includes(cb.value);
  });
  prefsForm.querySelectorAll('input[name="reminderMethod"]').forEach((cb) => {
    cb.checked = (state.prefs.reminderMethod || []).includes(cb.value);
  });
  prefsForm.remindAt.value = state.prefs.remindAt || "";
  prefsForm.weekendsToo.checked = Boolean(state.prefs.weekendsToo);
  prefsForm.loggingMethod.value = state.prefs.loggingMethod || "";
}

function syncStateFromForms() {
  const profileForm = document.getElementById("profileForm");
  const prefsForm = document.getElementById("prefsForm");

  state.profile = {
    learningGoal: (profileForm.learningGoal.value || "").trim(),
    timeDedication: profileForm.timeDedication.value || "",
    bestTime: readChecks(profileForm, "bestTime"),
    quitReasons: readChecks(profileForm, "quitReasons"),
  };

  state.prefs = {
    accountability: readChecks(prefsForm, "accountability"),
    reminderMethod: readChecks(prefsForm, "reminderMethod"),
    remindAt: prefsForm.remindAt.value || "",
    weekendsToo: Boolean(prefsForm.weekendsToo.checked),
    loggingMethod: prefsForm.loggingMethod.value || "",
  };
}

function setProgressMode(mode) {
  progressMode = mode;
  const percentWrap = document.getElementById("progressPercentWrap");
  const moduleWrap = document.getElementById("progressModuleWrap");
  const tabPercent = document.getElementById("tabPercent");
  const tabModule = document.getElementById("tabModule");

  if (mode === "module") {
    percentWrap.classList.add("hidden");
    moduleWrap.classList.remove("hidden");
    tabPercent.setAttribute("aria-selected", "false");
    tabModule.setAttribute("aria-selected", "true");
  } else {
    moduleWrap.classList.add("hidden");
    percentWrap.classList.remove("hidden");
    tabModule.setAttribute("aria-selected", "false");
    tabPercent.setAttribute("aria-selected", "true");
  }
}

function openCourseDialog(course) {
  const dialog = document.getElementById("courseDialog");
  const form = document.getElementById("courseForm");
  const title = document.getElementById("courseDialogTitle");
  const btnDelete = document.getElementById("btnDeleteCourse");

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  editingCourseId = course?.id || null;
  title.textContent = editingCourseId ? "Edit course" : "Add course";
  btnDelete.classList.toggle("hidden", !editingCourseId);

  form.courseName.value = course?.name || "";
  form.platform.value = course?.platform || "";
  form.courseUrl.value = course?.url || "";
  form.totalDuration.value = course?.totalDuration || "";
  form.startDate.value = course?.startDate || todayStr;
  form.targetDate.value = course?.targetDate || "";
  form.why.value = course?.why || "";
  form.priority.value = course?.priority || "";
  form.milestoneNotes.value = course?.milestoneNotes || "";

  const mode = course?.progressMode || "percent";
  setProgressMode(mode);

  form.progressPercent.value = Number(course?.progressPercent ?? 0);
  form.moduleCurrent.value = Number(course?.moduleCurrent ?? 0);
  form.moduleTotal.value = Number(course?.moduleTotal ?? 0);

  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "true");
  form.courseName.focus();
}

function closeCourseDialog() {
  const dialog = document.getElementById("courseDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  editingCourseId = null;
}

function render() {
  const list = document.getElementById("courseList");
  const empty = document.getElementById("emptyCourses");
  const statCourses = document.getElementById("statCourses");
  const statOnTrack = document.getElementById("statOnTrack");
  const statBehind = document.getElementById("statBehind");

  const courses = state.courses || [];
  statCourses.textContent = String(courses.length);

  let onTrack = 0;
  let behind = 0;
  courses.forEach((c) => {
    const s = statusFor(c);
    if (s.key === "ontrack" || s.key === "done") onTrack += 1;
    if (s.key === "behind") behind += 1;
  });
  statOnTrack.textContent = String(onTrack);
  statBehind.textContent = String(behind);

  empty.classList.toggle("hidden", courses.length > 0);
  list.innerHTML = "";

  for (const course of courses) {
    const pct = getCoursePercent(course);
    const s = statusFor(course);
    const expected = estimateExpectedPercent(course);

    const card = document.createElement("div");
    card.className = "courseCard";

    const url = safeUrl(course.url);
    const deadline = parseDate(course.targetDate);
    const start = parseDate(course.startDate);
    const deadlineIn = deadline ? daysBetween(new Date(), deadline) : null;
    const deadlineLabel =
      deadline == null
        ? "—"
        : deadlineIn === 0
          ? "Today"
          : deadlineIn > 0
            ? `In ${deadlineIn}d`
            : `${Math.abs(deadlineIn)}d ago`;

    const pillToneClass =
      s.tone === "danger"
        ? "pill--danger"
        : s.tone === "warn"
          ? "pill--warn"
          : s.tone === "teal"
            ? "pill--teal"
            : "pill--orange";

    const priorityPillClass =
      (course.priority || "").startsWith("High") ? "pill--danger" : (course.priority || "") === "Medium" ? "pill--warn" : "pill--orange";

    const progressLabel =
      course.progressMode === "module"
        ? `Module ${Number(course.moduleCurrent || 0)} of ${Number(course.moduleTotal || 0)}`
        : `${Math.round(pct)}% complete`;

    const pacingLine =
      expected == null
        ? "Add a target date to get on-track pacing."
        : `Expected by now: ${Math.round(expected)}%`;

    card.innerHTML = `
      <div class="courseCard__top">
        <div>
          <div class="courseCard__title">${escapeHtml(course.name || "Untitled course")}</div>
          <div class="pillRow">
            <span class="pill ${pillToneClass}">${escapeHtml(s.label)}</span>
            <span class="pill">${escapeHtml(course.platform || "Platform")}</span>
            <span class="pill ${priorityPillClass}">${escapeHtml(course.priority || "Priority")}</span>
            <span class="pill">${escapeHtml(course.why || "Why")}</span>
          </div>
        </div>
        <button class="btn btn--ghost" type="button" data-action="edit" data-id="${course.id}">Edit</button>
      </div>

      <div class="courseMeta">
        <div class="metaItem"><b>Progress</b><div>${escapeHtml(progressLabel)}</div></div>
        <div class="metaItem"><b>Deadline</b><div>${escapeHtml(deadlineLabel)}</div></div>
        <div class="metaItem"><b>Start</b><div>${escapeHtml(start ? course.startDate : "—")}</div></div>
        <div class="metaItem"><b>Duration</b><div>${escapeHtml(course.totalDuration || "—")}</div></div>
      </div>

      <div class="progressBar" aria-label="Progress bar">
        <div class="progressBar__fill" style="width:${pct.toFixed(1)}%"></div>
      </div>
      <div class="muted small">${escapeHtml(pacingLine)}</div>

      <div class="courseActions">
        <div>
          ${url ? `<a class="link" href="${url}" target="_blank" rel="noopener noreferrer">Open course</a>` : `<span class="muted small">No URL set</span>`}
        </div>
        <button class="btn btn--ghost" type="button" data-action="bump" data-id="${course.id}">+5%</button>
      </div>
    `;

    list.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findCourse(id) {
  return (state.courses || []).find((c) => c.id === id) || null;
}

function upsertCourse(nextCourse) {
  const idx = (state.courses || []).findIndex((c) => c.id === nextCourse.id);
  if (idx >= 0) state.courses[idx] = nextCourse;
  else state.courses.unshift(nextCourse);
}

function init() {
  const profileForm = document.getElementById("profileForm");
  const prefsForm = document.getElementById("prefsForm");

  const btnStart = document.getElementById("btnStartTracking");
  const startHint = document.getElementById("startHint");
  const btnAdd = document.getElementById("btnAddCourse");
  const btnExport = document.getElementById("btnExport");
  const fileImport = document.getElementById("fileImport");
  const btnReset = document.getElementById("btnReset");

  const dialog = document.getElementById("courseDialog");
  const courseForm = document.getElementById("courseForm");
  const btnDeleteCourse = document.getElementById("btnDeleteCourse");

  const tabPercent = document.getElementById("tabPercent");
  const tabModule = document.getElementById("tabModule");

  syncFormsFromState();
  render();

  const autosave = () => {
    syncStateFromForms();
    saveState();
    render();
  };
  profileForm.addEventListener("input", autosave);
  prefsForm.addEventListener("input", autosave);

  btnStart.addEventListener("click", () => {
    syncStateFromForms();
    if (!state.startedAt) state.startedAt = new Date().toISOString();
    saveState();

    const missing = [];
    if (!state.profile.learningGoal) missing.push("learning goal");
    if (!state.profile.timeDedication) missing.push("time dedication");
    if (!state.prefs.loggingMethod) missing.push("progress logging method");

    if (missing.length) {
      startHint.textContent = `Tip: add ${missing.join(", ")} for more accurate pacing.`;
      toast("Tracking started. Add a course and make your first win today.", "success");
    } else {
      startHint.textContent = "Locked in. Add a course and start stacking wins.";
      toast("You’re set. Consistency beats intensity.", "success");
    }
    render();
  });

  btnAdd.addEventListener("click", () => openCourseDialog(null));

  tabPercent.addEventListener("click", () => setProgressMode("percent"));
  tabModule.addEventListener("click", () => setProgressMode("module"));

  btnDeleteCourse.addEventListener("click", () => {
    if (!editingCourseId) return;
    state.courses = (state.courses || []).filter((c) => c.id !== editingCourseId);
    saveState();
    closeCourseDialog();
    toast("Course deleted.", "warn");
    render();
  });

  courseForm.addEventListener("submit", (e) => {
    // method="dialog" will close automatically; prevent to manage validation + milestones
    e.preventDefault();

    const name = (courseForm.courseName.value || "").trim();
    if (!name) {
      courseForm.courseName.focus();
      return;
    }

    const existing = editingCourseId ? findCourse(editingCourseId) : null;
    const prevPct = existing ? getCoursePercent(existing) : 0;

    const next = {
      id: existing?.id || uid(),
      name,
      platform: courseForm.platform.value || "",
      url: (courseForm.courseUrl.value || "").trim(),
      totalDuration: (courseForm.totalDuration.value || "").trim(),
      startDate: courseForm.startDate.value || "",
      targetDate: courseForm.targetDate.value || "",
      why: courseForm.why.value || "",
      priority: courseForm.priority.value || "",
      progressMode,
      progressPercent: clamp(Number(courseForm.progressPercent.value || 0), 0, 100),
      moduleCurrent: Math.max(0, Number(courseForm.moduleCurrent.value || 0)),
      moduleTotal: Math.max(0, Number(courseForm.moduleTotal.value || 0)),
      milestoneNotes: (courseForm.milestoneNotes.value || "").trim(),
      milestones: Array.isArray(existing?.milestones) ? existing.milestones : [],
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const nextPct = getCoursePercent(next);
    const hits = milestoneHits(prevPct, nextPct);
    if (hits.length) {
      next.milestones = Array.from(new Set([...(next.milestones || []), ...hits]));
      toast(`Milestone: ${hits.join("%, ")}% on “${escapeHtml(next.name)}”.`, "success");
    } else if (!existing) {
      toast("Course added. Start with a tiny session today.", "success");
    } else {
      toast("Course updated.", "success");
    }

    upsertCourse(next);
    saveState();
    closeCourseDialog();
    render();
  });

  dialog.addEventListener("close", () => {
    editingCourseId = null;
  });

  document.getElementById("courseList").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const course = findCourse(id);
    if (!course) return;

    if (action === "edit") {
      openCourseDialog(course);
      return;
    }
    if (action === "bump") {
      const prevPct = getCoursePercent(course);
      const nextPct = clamp(prevPct + 5, 0, 100);
      const next = { ...course, progressMode: "percent", progressPercent: nextPct, updatedAt: new Date().toISOString() };
      const hits = milestoneHits(prevPct, nextPct);
      if (hits.length) {
        next.milestones = Array.from(new Set([...(course.milestones || []), ...hits]));
        toast(`Milestone: ${hits.join("%, ")}% on “${escapeHtml(course.name)}”.`, "success");
      } else {
        toast(`Progress +5% on “${escapeHtml(course.name)}”.`, "success");
      }
      upsertCourse(next);
      saveState();
      render();
    }
  });

  btnExport.addEventListener("click", () => {
    syncStateFromForms();
    saveState();
    const stamp = new Date().toISOString().slice(0, 10);
    download(`course-tracker-export-${stamp}.json`, JSON.stringify(state, null, 2));
    toast("Exported your tracker data.", "success");
  });

  fileImport.addEventListener("change", async () => {
    const file = fileImport.files?.[0];
    fileImport.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported || typeof imported !== "object") throw new Error("Invalid JSON");
      state = {
        ...defaultState(),
        ...imported,
        profile: { ...defaultState().profile, ...(imported.profile || {}) },
        prefs: { ...defaultState().prefs, ...(imported.prefs || {}) },
        courses: Array.isArray(imported.courses) ? imported.courses : [],
      };
      saveState();
      syncFormsFromState();
      render();
      toast("Imported successfully.", "success");
    } catch {
      toast("Import failed. Make sure you selected a valid export JSON file.", "warn");
    }
  });

  btnReset.addEventListener("click", () => {
    const ok = window.confirm("Reset everything? This clears your saved profile and courses on this device.");
    if (!ok) return;
    state = defaultState();
    saveState();
    syncFormsFromState();
    render();
    toast("Reset complete.", "warn");
  });
}

document.addEventListener("DOMContentLoaded", init);

