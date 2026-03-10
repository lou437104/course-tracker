// @ts-nocheck
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";

type BestTime = "Morning" | "Lunch break" | "Evening" | "Night" | "Weekends";
type QuitReason =
  | "Too busy"
  | "Lose motivation"
  | "Course too hard"
  | "Course too boring"
  | "Forget about it"
  | "Get distracted by new courses";
type AccountabilityPref =
  | "Daily reminders"
  | "Weekly progress check-ins"
  | "Motivation when falling behind"
  | "Celebration when hitting milestones"
  | "Tough love (direct, no sugar-coating)"
  | "Gentle encouragement"
  | "Data-driven insights";
type ReminderMethod = "Email" | "SMS" | "Push notification" | "Slack" | "Discord";

type ProgressMode = "percent" | "module";

type Course = {
  id: string;
  name: string;
  platform: string;
  url?: string;
  totalDuration?: string;
  startDate?: string;
  targetDate?: string;
  why: string;
  progressMode: ProgressMode;
  progressPercent: number;
  moduleCurrent: number;
  moduleTotal: number;
  priority: string;
};

const TIME_OPTIONS = [
  "15 min/day",
  "30 min/day",
  "1 hour/day",
  "2+ hours/day",
  "Weekends only",
  "Varies",
];

const PLATFORMS = [
  "Coursera",
  "Udemy",
  "Skillshare",
  "LinkedIn Learning",
  "Pluralsight",
  "edX",
  "YouTube playlist",
  "Other",
];

const WHY_OPTIONS = ["Career", "Personal interest", "Certification needed", "Boss assigned"];

const PRIORITIES = ["High (need ASAP)", "Medium", "Low (nice to have)"];

const PROGRESS_METHODS = [
  "Manual check-in (I'll tell you what I completed)",
  "Daily time tracking (log study minutes)",
  "Module/lesson completion (check off lessons)",
  "Auto-sync (if platform integration available)",
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function App() {
  const [learningGoal, setLearningGoal] = useState("");
  const [timeDedication, setTimeDedication] = useState<string>("");
  const [bestTimes, setBestTimes] = useState<BestTime[]>([]);
  const [quitReasons, setQuitReasons] = useState<QuitReason[]>([]);
  const [accountabilityPrefs, setAccountabilityPrefs] = useState<AccountabilityPref[]>([]);
  const [reminderMethods, setReminderMethods] = useState<ReminderMethod[]>([]);
  const [remindTime, setRemindTime] = useState("");
  const [weekendsToo, setWeekendsToo] = useState(false);
  const [progressMethod, setProgressMethod] = useState<string>("");
  const [started, setStarted] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [draftCourse, setDraftCourse] = useState<Partial<Course>>({});
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const toggleInArray = <T,>(value: T, arr: T[], setArr: (next: T[]) => void) => {
    if (arr.includes(value)) setArr(arr.filter((x) => x !== value));
    else setArr([...arr, value]);
  };

  const onStartTracking = () => {
    setStarted(true);
  };

  const onEditCourse = (course?: Course) => {
    if (!course) {
      setEditingCourseId(null);
      setDraftCourse({
        id: uid(),
        name: "",
        platform: "",
        why: "",
        progressMode: "percent",
        progressPercent: 0,
        moduleCurrent: 0,
        moduleTotal: 0,
        priority: "",
      });
    } else {
      setEditingCourseId(course.id);
      setDraftCourse(course);
    }
  };

  const saveCourse = () => {
    const base: Course = {
      id: draftCourse.id || uid(),
      name: draftCourse.name?.trim() || "Untitled course",
      platform: draftCourse.platform || "",
      url: draftCourse.url || "",
      totalDuration: draftCourse.totalDuration || "",
      startDate: draftCourse.startDate || "",
      targetDate: draftCourse.targetDate || "",
      why: draftCourse.why || "",
      progressMode: draftCourse.progressMode || "percent",
      progressPercent: Number(draftCourse.progressPercent || 0),
      moduleCurrent: Number(draftCourse.moduleCurrent || 0),
      moduleTotal: Number(draftCourse.moduleTotal || 0),
      priority: draftCourse.priority || "",
    };

    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === base.id);
      if (idx === -1) return [...prev, base];
      const next = [...prev];
      next[idx] = base;
      return next;
    });
    setEditingCourseId(null);
    setDraftCourse({});
  };

  const progressLabelForCourse = (course: Course) => {
    if (course.progressMode === "module") {
      return `Module ${course.moduleCurrent} of ${course.moduleTotal}`;
    }
    return `${course.progressPercent}% complete`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} />
          <View>
            <Text style={styles.brandTitle}>Course Accountability Tracker</Text>
            <Text style={styles.brandSubtitle}>Finish what you started.</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero / start tracking */}
        <View style={styles.hero}>
          <Text style={styles.h1}>A smarter way to stay consistent.</Text>
          <Text style={styles.lead}>
            Set your goal, add courses, and track progress with on‑track insights, milestones, and
            accountability nudges that match your style.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={onStartTracking}>
            <Text style={styles.startBtnText}>Start Tracking</Text>
          </TouchableOpacity>
          {started && (
            <Text style={styles.mutedSmall}>
              You’re in. Add a course and log even 10 minutes today.
            </Text>
          )}
        </View>

        {/* User profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>User profile</Text>
          <Text style={styles.cardSubtitle}>
            A little context helps keep your tracker honest and realistic.
          </Text>

          <Text style={styles.label}>What's your learning goal?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            multiline
            placeholder="Career change, skill building, hobby, certification…"
            placeholderTextColor="#9CA3AF"
            value={learningGoal}
            onChangeText={setLearningGoal}
          />

          <Text style={styles.label}>How much time can you realistically dedicate?</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={timeDedication === opt}
                onPress={() => setTimeDedication(opt)}
              />
            ))}
          </View>

          <Text style={styles.label}>Best time to study</Text>
          <View style={styles.chipRowWrap}>
            {["Morning", "Lunch break", "Evening", "Night", "Weekends"].map((t) => (
              <Chip
                key={t}
                label={t}
                selected={bestTimes.includes(t as BestTime)}
                onPress={() => toggleInArray(t as BestTime, bestTimes, setBestTimes)}
              />
            ))}
          </View>

          <Text style={styles.label}>What makes you quit courses?</Text>
          <View style={styles.chipRowWrap}>
            {[
              "Too busy",
              "Lose motivation",
              "Course too hard",
              "Course too boring",
              "Forget about it",
              "Get distracted by new courses",
            ].map((r) => (
              <Chip
                key={r}
                label={r}
                selected={quitReasons.includes(r as QuitReason)}
                onPress={() => toggleInArray(r as QuitReason, quitReasons, setQuitReasons)}
              />
            ))}
          </View>
        </View>

        {/* Accountability preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accountability preferences</Text>
          <Text style={styles.cardSubtitle}>Choose the kind of nudges you’ll actually respond to.</Text>

          <Text style={styles.label}>How do you want to be held accountable?</Text>
          <View style={styles.chipRowWrap}>
            {[
              "Daily reminders",
              "Weekly progress check-ins",
              "Motivation when falling behind",
              "Celebration when hitting milestones",
              "Tough love (direct, no sugar-coating)",
              "Gentle encouragement",
              "Data-driven insights",
            ].map((a) => (
              <Chip
                key={a}
                label={a}
                selected={accountabilityPrefs.includes(a as AccountabilityPref)}
                onPress={() =>
                  toggleInArray(a as AccountabilityPref, accountabilityPrefs, setAccountabilityPrefs)
                }
              />
            ))}
          </View>

          <Text style={styles.label}>Reminder method</Text>
          <View style={styles.chipRowWrap}>
            {["Email", "SMS", "Push notification", "Slack", "Discord"].map((m) => (
              <Chip
                key={m}
                label={m}
                selected={reminderMethods.includes(m as ReminderMethod)}
                onPress={() =>
                  toggleInArray(m as ReminderMethod, reminderMethods, setReminderMethods)
                }
              />
            ))}
          </View>

          <Text style={styles.label}>When to remind me</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 07:30"
            placeholderTextColor="#9CA3AF"
            value={remindTime}
            onChangeText={setRemindTime}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Remind me even on weekends?</Text>
            <Switch value={weekendsToo} onValueChange={setWeekendsToo} thumbColor="#F97316" />
          </View>

          <Text style={styles.label}>How will you log progress?</Text>
          <View style={styles.chipRowWrap}>
            {PROGRESS_METHODS.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={progressMethod === m}
                onPress={() => setProgressMethod(m)}
              />
            ))}
          </View>
        </View>

        {/* Courses section */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Courses you're taking</Text>
              <Text style={styles.cardSubtitle}>
                Add what you’re enrolled in, then keep progress honest.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.btnTeal]}
              onPress={() => onEditCourse(undefined)}
            >
              <Text style={styles.btnTextDark}>Add Course</Text>
            </TouchableOpacity>
          </View>

          {courses.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No courses yet.</Text>
              <Text style={styles.emptyText}>Add your first course and make it real.</Text>
            </View>
          )}

          {courses.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.courseTitle}>{course.name}</Text>
                  <Text style={styles.courseSubtitle}>
                    {course.platform || "Platform"} · {course.priority || "Priority"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => onEditCourse(course)}
                >
                  <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${course.progressPercent || 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.courseMeta}>{progressLabelForCourse(course)}</Text>

              <Text style={styles.courseMeta}>
                Target: {course.targetDate || "Not set"} · Why: {course.why || "—"}
              </Text>
            </View>
          ))}

          {/* Simple inline course editor */}
          {draftCourse && (draftCourse.id || editingCourseId === null) && (
            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {editingCourseId ? "Edit course" : "Add course"}
              </Text>

              <Text style={styles.label}>Course name</Text>
              <TextInput
                style={styles.input}
                value={draftCourse.name || ""}
                onChangeText={(v) => setDraftCourse((d) => ({ ...d, name: v }))}
                placeholder="e.g., Complete Python Bootcamp"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>Platform</Text>
              <View style={styles.chipRowWrap}>
                {PLATFORMS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={draftCourse.platform === p}
                    onPress={() => setDraftCourse((d) => ({ ...d, platform: p }))}
                  />
                ))}
              </View>

              <Text style={styles.label}>Course URL (optional)</Text>
              <TextInput
                style={styles.input}
                value={draftCourse.url || ""}
                onChangeText={(v) => setDraftCourse((d) => ({ ...d, url: v }))}
                placeholder="https://…"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Total duration (hours or weeks)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftCourse.totalDuration || ""}
                    onChangeText={(v) => setDraftCourse((d) => ({ ...d, totalDuration: v }))}
                    placeholder="e.g., 12 hours / 4 weeks"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Start date</Text>
                  <TextInput
                    style={styles.input}
                    value={draftCourse.startDate || ""}
                    onChangeText={(v) => setDraftCourse((d) => ({ ...d, startDate: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Target completion date</Text>
                  <TextInput
                    style={styles.input}
                    value={draftCourse.targetDate || ""}
                    onChangeText={(v) => setDraftCourse((d) => ({ ...d, targetDate: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <Text style={styles.label}>Why you're taking this</Text>
              <View style={styles.chipRowWrap}>
                {WHY_OPTIONS.map((w) => (
                  <Chip
                    key={w}
                    label={w}
                    selected={draftCourse.why === w}
                    onPress={() => setDraftCourse((d) => ({ ...d, why: w }))}
                  />
                ))}
              </View>

              <Text style={styles.label}>Progress mode</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Percent"
                  selected={draftCourse.progressMode !== "module"}
                  onPress={() => setDraftCourse((d) => ({ ...d, progressMode: "percent" }))}
                />
                <Chip
                  label="Module X of Y"
                  selected={draftCourse.progressMode === "module"}
                  onPress={() => setDraftCourse((d) => ({ ...d, progressMode: "module" }))}
                />
              </View>

              {draftCourse.progressMode === "module" ? (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Module</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(draftCourse.moduleCurrent ?? 0)}
                      onChangeText={(v) =>
                        setDraftCourse((d) => ({ ...d, moduleCurrent: Number(v || 0) }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>of</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(draftCourse.moduleTotal ?? 0)}
                      onChangeText={(v) =>
                        setDraftCourse((d) => ({ ...d, moduleTotal: Number(v || 0) }))
                      }
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.label}>Current progress (%)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={String(draftCourse.progressPercent ?? 0)}
                    onChangeText={(v) =>
                      setDraftCourse((d) => ({ ...d, progressPercent: Number(v || 0) }))
                    }
                  />
                </View>
              )}

              <Text style={styles.label}>Priority</Text>
              <View style={styles.chipRowWrap}>
                {PRIORITIES.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={draftCourse.priority === p}
                    onPress={() => setDraftCourse((d) => ({ ...d, priority: p }))}
                  />
                ))}
              </View>

              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                {editingCourseId && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => {
                      setCourses((prev) => prev.filter((c) => c.id !== editingCourseId));
                      setEditingCourseId(null);
                      setDraftCourse({});
                    }}
                  >
                    <Text style={[styles.btnText, { color: "#FCA5A5" }]}>Delete</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost, { marginRight: 8 }]}
                  onPress={() => {
                    setEditingCourseId(null);
                    setDraftCourse({});
                  }}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveCourse}>
                  <Text style={styles.btnTextDark}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  header: {
    paddingTop: Platform.OS === "android" ? 40 : 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.5)",
    backgroundColor: "rgba(15,23,42,0.96)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F97316",
  },
  brandTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  brandSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  hero: {
    marginTop: 12,
    marginBottom: 16,
  },
  h1: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 6,
  },
  lead: {
    color: "#CBD5F5",
    fontSize: 14,
    marginBottom: 10,
  },
  startBtn: {
    backgroundColor: "#F97316",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  startBtnText: {
    color: "#0b1220",
    fontWeight: "700",
  },
  mutedSmall: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.5)",
  },
  cardTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 10,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#4B5563",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "white",
    fontSize: 14,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginVertical: 2,
  },
  chipSelected: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.18)",
  },
  chipText: {
    color: "#E5E7EB",
    fontSize: 12,
  },
  chipTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    marginTop: 8,
  },
  btn: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.7)",
  },
  btnPrimary: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  btnTeal: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnText: {
    color: "#E5E7EB",
    fontWeight: "600",
    fontSize: 13,
  },
  btnTextDark: {
    color: "#020617",
    fontWeight: "700",
    fontSize: 13,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4B5563",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  emptyTitle: {
    color: "white",
    fontWeight: "700",
  },
  emptyText: {
    color: "#9CA3AF",
    marginTop: 4,
    fontSize: 13,
  },
  courseCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#374151",
  },
  courseTitle: {
    color: "white",
    fontWeight: "700",
  },
  courseSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#1F2933",
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
  courseMeta: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 4,
  },
  editor: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  editorTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
});