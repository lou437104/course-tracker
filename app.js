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
    lastAnalysisDate: null,
    lastAnalysisPrompt: "",
    lastAnalysisMessage: "",
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
      openAiKey: "",
    },
    sessions: [],
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
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
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
  if (prefsForm.openAiKey) prefsForm.openAiKey.value = state.prefs.openAiKey || "";
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
    openAiKey: (prefsForm.openAiKey?.value || "").trim(),
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
  const sessionCourseId = document.getElementById("sessionCourseId");
  const sessionSummary = document.getElementById("sessionSummary");
  const sessionList = document.getElementById("sessionList");
  const analysisMeta = document.getElementById("analysisMeta");
  const analysisOutput = document.getElementById("analysisOutput");

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

  if (sessionCourseId) {
    const selected = sessionCourseId.value;
    sessionCourseId.innerHTML = `<option value="">Any / general studying</option>`;
    for (const c of courses) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sessionCourseId.appendChild(opt);
    }
    sessionCourseId.value = selected;
  }

  if (sessionSummary && sessionList) {
    const last7 = sessionsInLastDays(7);
    const mins7 = last7.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    const last30 = sessionsInLastDays(30);
    const mins30 = last30.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    const streak = getStudyStreak();
    const lastStudy = lastStudyDate();
    const daysSince = lastStudy ? daysBetween(parseDate(lastStudy), new Date()) : null;

    sessionSummary.innerHTML = `
      <div><b>Last 7 days:</b> ${fmtMinutes(mins7)} across ${last7.length} session(s)</div>
      <div><b>Last 30 days:</b> ${fmtMinutes(mins30)} across ${last30.length} session(s)</div>
      <div><b>Current streak:</b> ${streak} day(s) ${daysSince != null ? `• <b>Last studied:</b> ${lastStudy} (${daysSince}d ago)` : ""}</div>
    `;

    const recent = [...(state.sessions || [])]
      .filter((s) => isValidDateStr(s.date))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 8);
    sessionList.innerHTML = "";
    for (const s of recent) {
      const row = document.createElement("div");
      row.className = "sessionRow";
      const c = s.courseId ? findCourse(s.courseId) : null;
      row.innerHTML = `
        <div class="sessionRow__main">
          <div class="sessionRow__title">${escapeHtml(s.date)} • ${escapeHtml(fmtMinutes(s.minutes))}${c ? ` • ${escapeHtml(c.name)}` : ""}</div>
          <div class="sessionRow__meta">${escapeHtml(s.notes || "")}</div>
        </div>
        <button class="btn btn--ghost" type="button" data-action="delSession" data-id="${s.id}">Remove</button>
      `;
      sessionList.appendChild(row);
    }
    if (!recent.length) {
      sessionList.innerHTML = `<div class="muted small">No sessions logged yet.</div>`;
    }
  }

  if (analysisMeta && analysisOutput) {
    analysisMeta.textContent = state.lastAnalysisDate ? `Last run: ${state.lastAnalysisDate}` : "Not run yet";
    analysisOutput.textContent = state.lastAnalysisMessage || "No analysis yet. Log a session or add course dates, then run.";
  }

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

function fmtMinutes(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function parseTotalHours(totalDuration) {
  const s = String(totalDuration || "").toLowerCase();
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hourMatch) return Math.max(0, Number(hourMatch[1]) || 0);
  const hoursOnly = s.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (hoursOnly) return Math.max(0, Number(hoursOnly[1]) || 0);
  return null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSession(s) {
  const d = isValidDateStr(s.date) ? s.date : todayStr();
  return {
    id: s.id || uid(),
    date: d,
    minutes: Math.max(1, Math.round(Number(s.minutes) || 0)),
    courseId: s.courseId || "",
    notes: String(s.notes || "").trim(),
    createdAt: s.createdAt || new Date().toISOString(),
  };
}

function sessionsInLastDays(days, now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return (state.sessions || []).filter((s) => {
    const d = parseDate(s.date);
    return d && d >= start && d <= now;
  });
}

function getStudyStreak(now = new Date()) {
  const dates = new Set((state.sessions || []).map((s) => s.date).filter(isValidDateStr));
  let streak = 0;
  for (;;) {
    const d = new Date(now);
    d.setDate(d.getDate() - streak);
    const ds = d.toISOString().slice(0, 10);
    if (!dates.has(ds)) break;
    streak += 1;
  }
  return streak;
}

function lastStudyDate() {
  const all = (state.sessions || []).filter((s) => isValidDateStr(s.date));
  if (!all.length) return null;
  all.sort((a, b) => (a.date < b.date ? 1 : -1));
  return all[0].date;
}

function courseLine(course) {
  const pct = Math.round(getCoursePercent(course));
  return `- ${course.name} | ${course.platform} | duration: ${course.totalDuration || "?"} | enrolled: ${course.startDate || "?"} | target: ${course.targetDate || "?"} | progress: ${pct}% | priority: ${course.priority || "?"} | reason: ${course.why || "?"}`;
}

function pickAccountabilityStyle() {
  const a = (state.prefs.accountability || []).join(" | ").toLowerCase();
  if (a.includes("tough love")) return "tough_love";
  if (a.includes("data-driven")) return "data_driven";
  return "gentle";
}

function computeCoursePace(course, now = new Date()) {
  const pct = getCoursePercent(course);
  const start = parseDate(course.startDate);
  const target = parseDate(course.targetDate);
  const hoursTotal = parseTotalHours(course.totalDuration);

  const daysSinceEnrolled = start ? Math.max(0, daysBetween(start, now)) : null;
  const daysUntilTarget = target ? daysBetween(now, target) : null;

  let requiredHoursPerDay = null;
  if (hoursTotal != null && target && now <= target) {
    const remainingHours = Math.max(0, hoursTotal * (1 - pct / 100));
    const remainingDays = Math.max(1, daysBetween(now, target));
    requiredHoursPerDay = remainingHours / remainingDays;
  }

  const last7 = sessionsInLastDays(7, now);
  const minutes7 = last7
    .filter((s) => !s.courseId || s.courseId === course.id)
    .reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const actualHoursPerDay7 = (minutes7 / 60) / 7;

  let predictedCompletionDate = null;
  if (hoursTotal != null && actualHoursPerDay7 > 0) {
    const remainingHours = Math.max(0, hoursTotal * (1 - pct / 100));
    const daysNeeded = remainingHours / actualHoursPerDay7;
    const d = new Date(now);
    d.setDate(d.getDate() + Math.ceil(daysNeeded));
    predictedCompletionDate = d.toISOString().slice(0, 10);
  }

  let completionProbability = null;
  if (requiredHoursPerDay != null) {
    const ratio = actualHoursPerDay7 / requiredHoursPerDay;
    // simple bounded curve
    completionProbability = clamp(5 + 90 * clamp(ratio, 0, 1.4) / 1.4, 5, 95);
  }

  let daysBehindSchedule = null;
  const expected = estimateExpectedPercent(course, now);
  if (expected != null && start && target) {
    const totalDays = Math.max(1, daysBetween(start, target));
    const pctDiff = expected - pct;
    daysBehindSchedule = pctDiff <= 0 ? 0 : Math.round((pctDiff / 100) * totalDays);
  }

  const s = statusFor(course);
  const severity =
    s.key === "behind" && (daysBehindSchedule || 0) >= 7
      ? "Severely behind"
      : s.key === "behind"
        ? "Behind"
        : s.key === "ontrack"
          ? "On track"
          : s.key === "done"
            ? "Ahead"
            : "Unknown";

  return {
    daysSinceEnrolled,
    daysUntilTarget,
    pct,
    requiredHoursPerDay,
    actualHoursPerDay7,
    predictedCompletionDate,
    completionProbability,
    daysBehindSchedule,
    severity,
  };
}

function buildDailyPrompt(now = new Date()) {
  const style = pickAccountabilityStyle();
  const preferredTimes = (state.profile.bestTime || []).join(", ") || "—";
  const quitReasons = (state.profile.quitReasons || []).join(", ") || "—";

  const last7 = sessionsInLastDays(7, now)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((s) => {
      const c = s.courseId ? findCourse(s.courseId) : null;
      return `- ${s.date}: ${s.minutes} min${c ? ` (${c.name})` : ""}${s.notes ? ` — ${s.notes}` : ""}`;
    })
    .join("\n") || "- (none)";

  const last30 = sessionsInLastDays(30, now);
  const minutes30 = last30.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  const completionRate30 = "N/A (percent-based progress logging)";
  const consistency30 = `${last30.length} sessions, ${fmtMinutes(minutes30)} total`;

  const completedCourses = (state.courses || []).filter((c) => getCoursePercent(c) >= 100).length;
  const avgProgress = (state.courses || []).length
    ? Math.round(
        (state.courses || []).reduce((sum, c) => sum + getCoursePercent(c), 0) / (state.courses || []).length,
      )
    : 0;
  const historicalPattern = `Completed courses: ${completedCourses}. Current average progress across tracked courses: ${avgProgress}%. (Not enough data yet to infer a stable quit-point pattern.)`;

  const coursesBlock =
    (state.courses || [])
      .map((c) => {
        const pct = Math.round(getCoursePercent(c));
        return `- ${c.name}, ${c.platform}, ${c.totalDuration || "unknown duration"}, enrolled ${c.startDate || "unknown"}, target ${c.targetDate || "unknown"}, progress ${pct}%, priority ${c.priority || "unknown"}, reason ${c.why || "unknown"}`;
      })
      .join("\n") || "- (none)";

  return `You're an online learning coach analyzing a student's course completion patterns.

USER PROFILE:
- Learning goal: ${state.profile.learningGoal || "—"}
- Time available: ${state.profile.timeDedication || "—"}
- Best study time: ${preferredTimes}
- Known quit triggers: ${quitReasons}
- Accountability preference: ${style}

COURSES BEING TRACKED:
${coursesBlock}

PROGRESS DATA:
- Last 7 days: ${"\n"}${last7}
- Last 30 days: [completion rate, consistency] ${completionRate30}; consistency: ${consistency30}
- Historical pattern: ${historicalPattern}

TODAY'S DATE: ${now.toISOString().slice(0, 10)}

ANALYZE:

1. COMPLETION RISK ASSESSMENT
   For EACH active course:
   - Days since enrolled: X
   - Days until target completion: Y
   - Current progress: Z%
   - Required daily pace to finish on time: A hours/day
   - Actual pace last 7 days: B hours/day
   
   Calculate:
   - On track / Behind / Severely behind / Ahead
   - Completion probability: X% (based on current pace vs needed pace)
   - Days behind schedule (if applicable)
   - Predicted completion date at current pace

2. QUIT RISK PREDICTION
   Identify early warning signs:
   - Enrolled X days ago, only Y% complete (slower than typical)
   - No study session in Z days (momentum lost)
   - Approaching historical quit point (user usually quits at 30% completion)
   - Started new course while old courses unfinished (shiny object syndrome)
   - Progress declined from A hours/week to B hours/week
   
   Quit risk: Low / Medium / High / Critical

3. PERSONALIZED INTERVENTION
   Based on situation, generate appropriate message.

4. PACE ADJUSTMENT RECOMMENDATIONS
5. COURSE PRIORITY GUIDANCE
6. MOTIVATIONAL STRATEGY (match their preference)
7. CELEBRATION TRIGGERS
8. RESET RECOMMENDATIONS

Be specific with dates, hours, and numbers. Match their accountability style. Intervene BEFORE they quit, not after.

SEND APPROPRIATE MESSAGE based on analysis above.`;
}

function localDailyMessage(now = new Date()) {
  const style = pickAccountabilityStyle();
  const courses = (state.courses || []).filter((c) => getCoursePercent(c) < 100);
  const lastStudy = lastStudyDate();
  const daysSinceStudy = lastStudy ? daysBetween(parseDate(lastStudy), now) : null;
  const streak = getStudyStreak(now);

  const lines = [];
  if (!courses.length) {
    lines.push("You have no active courses right now. Add one course you actually plan to finish next.");
  } else {
    const ranked = [...courses].sort((a, b) => {
      const ap = (a.priority || "").startsWith("High") ? 3 : (a.priority || "") === "Medium" ? 2 : 1;
      const bp = (b.priority || "").startsWith("High") ? 3 : (b.priority || "") === "Medium" ? 2 : 1;
      return bp - ap;
    });
    const focus = ranked[0];
    const pace = computeCoursePace(focus, now);

    if (streak >= 3) lines.push(`Momentum: you’re on a ${streak}-day streak. Keep it alive today.`);
    else if (streak === 1) lines.push("Nice: you studied yesterday. Repeat it today.");

    if (daysSinceStudy != null && daysSinceStudy >= 3) {
      lines.push(`Pattern alert: no study session in ${daysSinceStudy} days. Momentum is leaking — act today.`);
    }

    const pct = Math.round(pace.pct);
    const target = focus.targetDate || "your target date";
    if (pace.severity === "On track") {
      lines.push(`On track: you’re ${pct}% through “${focus.name}”. Keep the habit small and consistent.`);
    } else if (pace.severity === "Behind") {
      lines.push(`You’re behind on “${focus.name}” by ~${pace.daysBehindSchedule || 1} day(s). Do 20 minutes today to close the gap.`);
    } else if (pace.severity === "Severely behind") {
      lines.push(`Reality check: “${focus.name}” is severely behind. At this pace you’ll miss ${target}. Decide: extend the deadline or increase time — but pick one today.`);
    } else {
      lines.push(`Set dates for “${focus.name}” so we can pace you to ${target}.`);
    }

    const required = pace.requiredHoursPerDay;
    const actual = pace.actualHoursPerDay7;
    if (required != null) {
      const reqMin = Math.round(required * 60);
      const actMin = Math.round(actual * 60);
      if (style === "data_driven") {
        lines.push(`Data: needed pace ${fmtMinutes(reqMin)}/day. Actual last 7 days ${fmtMinutes(actMin)}/day.`);
        if (pace.predictedCompletionDate) {
          lines.push(`Projected finish at current pace: ${pace.predictedCompletionDate}.`);
        }
      } else if (style === "tough_love") {
        lines.push(`You said you wanted this. Needed: ${fmtMinutes(reqMin)}/day. You did: ${fmtMinutes(actMin)}/day. Fix it or drop the deadline fantasy.`);
      } else {
        lines.push(`To finish on time: aim for about ${fmtMinutes(reqMin)}/day. Even one focused session today counts.`);
      }
    }

    if (courses.length >= 3) {
      lines.push(`Priority guidance: you’re tracking ${courses.length} courses. Pick 1–2 to focus on this week (finish one before adding a new one).`);
    }
  }

  return lines.join("\n");
}

async function runDailyAnalysis(now = new Date()) {
  const prompt = buildDailyPrompt(now);
  state.lastAnalysisPrompt = prompt;
  state.lastAnalysisDate = now.toISOString().slice(0, 10);

  let message = localDailyMessage(now);
  const key = (state.prefs.openAiKey || "").trim();

  if (key) {
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: prompt,
          temperature: 0.4,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text =
          data.output_text ||
          data.output?.flatMap((o) => o.content || []).map((c) => c.text).filter(Boolean).join("\n") ||
          "";
        if (text.trim()) message = text.trim();
      }
    } catch {
      // fall back to local message
    }
  }

  state.lastAnalysisMessage = message;
  saveState();
  return { prompt, message, usedRemote: Boolean(key) };
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
  const sessionForm = document.getElementById("sessionForm");
  const btnAddSession = document.getElementById("btnAddSession");
  const btnRunAnalysis = document.getElementById("btnRunAnalysis");
  const btnCopyPrompt = document.getElementById("btnCopyPrompt");
  const btnCopyMessage = document.getElementById("btnCopyMessage");

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
    const submitterValue = e.submitter?.value;
    if (submitterValue === "cancel") return; // allow <dialog> to close naturally

    e.preventDefault();
    if (!courseForm.reportValidity()) return;

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

  if (sessionForm) {
    const d = sessionForm.sessionDate;
    if (d && !d.value) d.value = todayStr();
  }

  btnAddSession?.addEventListener("click", () => {
    if (!sessionForm) return;
    const date = sessionForm.sessionDate.value || todayStr();
    const minutes = Number(sessionForm.sessionMinutes.value || 0);
    if (!isValidDateStr(date) || minutes <= 0) {
      toast("Add a valid date and minutes.", "warn");
      return;
    }
    const session = normalizeSession({
      date,
      minutes,
      courseId: sessionForm.sessionCourseId.value || "",
      notes: sessionForm.sessionNotes.value || "",
    });
    state.sessions = [session, ...(state.sessions || [])].slice(0, 400);
    saveState();
    sessionForm.sessionMinutes.value = "";
    sessionForm.sessionNotes.value = "";
    toast("Session logged.", "success");
    render();
  });

  document.getElementById("sessionList")?.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="delSession"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    state.sessions = (state.sessions || []).filter((s) => s.id !== id);
    saveState();
    toast("Session removed.", "warn");
    render();
  });

  btnRunAnalysis?.addEventListener("click", async () => {
    syncStateFromForms();
    saveState();
    toast("Running daily analysis…", "info");
    const { prompt, message, usedRemote } = await runDailyAnalysis(new Date());
    const output = document.getElementById("analysisOutput");
    if (output) output.textContent = message;
    const meta = document.getElementById("analysisMeta");
    if (meta) meta.textContent = `Last run: ${state.lastAnalysisDate}${usedRemote ? " • via OpenAI" : " • local"}`;
    if (prompt && message) toast("Daily analysis ready.", "success");
    render();
  });

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.", "success");
    } catch {
      toast("Copy failed (browser blocked).", "warn");
    }
  }

  btnCopyPrompt?.addEventListener("click", () => copyToClipboard(state.lastAnalysisPrompt || buildDailyPrompt(new Date())));
  btnCopyMessage?.addEventListener("click", () => copyToClipboard(state.lastAnalysisMessage || localDailyMessage(new Date())));

  // Auto-run once per day when the page is opened
  const today = todayStr();
  if (state.startedAt && state.lastAnalysisDate !== today) {
    runDailyAnalysis(new Date()).then(() => render());
  }

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

