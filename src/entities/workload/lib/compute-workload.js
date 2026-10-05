// Teacher workload from the timetable: one lesson in the timetable is one
// period for its teacher. No imports, so it can be checked with plain Node.

export const WEEKEND_DAYS = ["Saturday", "Sunday"];

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// A teacher more than this far from the school average is over or under.
export const LOAD_TOLERANCE = 0.2;

export const LOAD_STATUS_LABELS = {
  OVER: "Over",
  BALANCED: "Balanced",
  UNDER: "Under",
  NONE: "No periods",
};

const toMinutes = (time) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  return Number.isFinite(hours) ? hours * 60 + (minutes || 0) : null;
};

/** Length of a period in hours, from its "HH:mm" start and end times. */
export const periodHours = (period) => {
  const start = toMinutes(period?.startTime);
  const end = toMinutes(period?.endTime);
  return start !== null && end !== null && end > start ? (end - start) / 60 : 0;
};

const dayIndex = (name) => {
  const index = DAY_ORDER.indexOf(name);
  return index === -1 ? DAY_ORDER.length : index;
};

const emptyCounts = () => ({ weekday: 0, weekend: 0, total: 0, hours: 0 });

const addLesson = (counts, isWeekend, hours) => {
  counts[isWeekend ? "weekend" : "weekday"] += 1;
  counts.total += 1;
  counts.hours += hours;
};

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Over, under or balanced against the average of teachers who teach. */
export const getLoadStatus = (total, average) => {
  if (total === 0) {
    return "NONE";
  }
  if (total > average * (1 + LOAD_TOLERANCE)) {
    return "OVER";
  }
  if (total < average * (1 - LOAD_TOLERANCE)) {
    return "UNDER";
  }
  return "BALANCED";
};

/**
 * Builds the workload of every teacher.
 *
 * - `entries`: timetable entries with `day.name`, `period` (type, times) and
 *   `csta` (teacherId, subject and class ids and names)
 * - `teachers`: `{ id, name }`
 * - `associations`: teaching assignments `{ id, teacherId, subjectName,
 *   className }`, to find those with no lessons in the timetable
 * - `days` and `periods`: the timetable's days and periods, for capacity
 */
export const computeWorkload = ({
  entries = [],
  teachers = [],
  associations = [],
  days = [],
  periods = [],
}) => {
  const lessonPeriods = periods.filter((period) => period.type !== "BREAK");
  const dayNames = [...days.map((day) => day.name)].sort(
    (a, b) => dayIndex(a) - dayIndex(b)
  );
  const capacity = dayNames.length * lessonPeriods.length;
  const capacityHours =
    dayNames.length *
    lessonPeriods.reduce((sum, period) => sum + periodHours(period), 0);

  const loads = new Map(
    teachers.map((teacher) => [
      teacher.id,
      {
        id: teacher.id,
        name: teacher.name,
        ...emptyCounts(),
        perDay: Object.fromEntries(dayNames.map((name) => [name, 0])),
        breakdown: new Map(),
      },
    ])
  );
  const scheduledAssociationIds = new Set();
  const totals = emptyCounts();

  for (const entry of entries) {
    const { csta, period, day } = entry;
    if (!csta || period?.type === "BREAK") {
      continue;
    }
    scheduledAssociationIds.add(csta.id);
    const load = loads.get(csta.teacherId);
    if (!load) {
      continue;
    }
    const isWeekend = WEEKEND_DAYS.includes(day?.name);
    const hours = periodHours(period);

    addLesson(load, isWeekend, hours);
    addLesson(totals, isWeekend, hours);
    if (day?.name) {
      load.perDay[day.name] = (load.perDay[day.name] || 0) + 1;
    }

    const key = `${csta.subjectId}_${csta.classId}`;
    if (!load.breakdown.has(key)) {
      load.breakdown.set(key, {
        key,
        subject: csta.subject?.name || "---",
        className: csta.schoolClass?.name || "---",
        ...emptyCounts(),
      });
    }
    addLesson(load.breakdown.get(key), isWeekend, hours);
  }

  const teaching = [...loads.values()].filter((load) => load.total > 0);
  const average = teaching.length
    ? teaching.reduce((sum, load) => sum + load.total, 0) / teaching.length
    : 0;
  const averageHours = teaching.length
    ? teaching.reduce((sum, load) => sum + load.hours, 0) / teaching.length
    : 0;

  const teacherLoads = [...loads.values()]
    .map(({ breakdown, ...load }) => {
      const rows = [...breakdown.values()].sort(
        (a, b) =>
          b.total - a.total ||
          a.subject.localeCompare(b.subject) ||
          a.className.localeCompare(b.className)
      );
      const [busiestDay, busiestCount] = Object.entries(load.perDay).reduce(
        (best, current) => (current[1] > best[1] ? current : best),
        [null, 0]
      );
      return {
        ...load,
        breakdown: rows,
        subjects: uniqueSorted(rows.map((row) => row.subject)),
        classes: uniqueSorted(rows.map((row) => row.className)),
        free: Math.max(capacity - load.total, 0),
        loadShare: capacity ? load.total / capacity : 0,
        busiestDay: busiestCount > 0 ? { name: busiestDay, count: busiestCount } : null,
        status: getLoadStatus(load.total, average),
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const unscheduled = associations
    .filter((association) => !scheduledAssociationIds.has(association.id))
    .map((association) => ({
      id: association.id,
      teacherName: teacherNames.get(association.teacherId) || "---",
      subject: association.subjectName || "---",
      className: association.className || "---",
    }))
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  return {
    teachers: teacherLoads,
    days: dayNames,
    periodsPerDay: lessonPeriods.length,
    capacity,
    capacityHours,
    average,
    averageHours,
    totals,
    unscheduled,
  };
};
