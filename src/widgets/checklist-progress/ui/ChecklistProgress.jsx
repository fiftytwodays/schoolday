import { useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Flex,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import useSWR, { mutate } from "swr";

import { getAllCalendarEntries } from "@/entities/calendar-entry/api/get-calendar-entries";
import { getAllChecklists } from "@/entities/checklist/api/get-checklists";
import {
  LateTag,
  StatusTag,
  formatPeriod,
} from "@/entities/checklist-submission";
import { STATUS_LABELS } from "@/entities/checklist-submission/config/statuses";
import { getAllSubmissions } from "@/entities/checklist-submission/api/get-submissions";
import { getSchoolInfo } from "@/entities/school/api/get-school-info";
import { getAllTeachers } from "@/entities/teacher/api/get-teachers";
import { ReviewChecklistModal } from "@/features/review-checklist";
import {
  getPeriod,
  isChecklistDue,
  submissionId,
  todayInSchool,
} from "@/shared/lib/checklist-rules";
import { getDayInfo, getWorkingWeekdays } from "@/shared/lib/school-calendar";

const SUBMISSIONS_KEY = ["/api/checklist-submissions"];

// Missed and not started first: the ones that need chasing.
const STATUS_ORDER = [
  "MISSED",
  "NOT_STARTED",
  "IN_PROGRESS",
  "RETURNED",
  "SUBMITTED",
  "REVIEWED",
];

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "ONCE", label: "One-time" },
];

const formatTime = (value) =>
  value ? dayjs(value).format("D MMM YYYY, h:mm A") : "---";

const reviewerOf = (submission) => {
  if (!submission || submission.status !== "REVIEWED") {
    return "---";
  }
  return submission.autoReviewed ? "Automatic" : submission.reviewedBy || "---";
};

const StatusCell = ({ status, submission }) => (
  <Space size="small">
    <StatusTag status={status} autoReviewed={submission?.autoReviewed} />
    {submission?.isLate && <LateTag />}
  </Space>
);

// Table column filters from the distinct values of a field.
const filtersFor = (rows, getValue) =>
  [...new Set(rows.map(getValue))]
    .sort()
    .map((value) => ({ text: value, value }));

function ChecklistProgress() {
  const today = todayInSchool();
  const [date, setDate] = useState(today);
  const [frequency, setFrequency] = useState("DAILY");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [teacherFilter, setTeacherFilter] = useState(null);
  const [checklistFilter, setChecklistFilter] = useState(null);
  const [opened, setOpened] = useState(null);
  const [openCount, setOpenCount] = useState(0);

  const { data: checklists } = useSWR(["/api/checklists"], getAllChecklists);
  const { data: teachers } = useSWR(["/api/teachers"], getAllTeachers);
  const { data: schools } = useSWR(["/api/school"], getSchoolInfo);
  const { data: entries } = useSWR(
    ["/api/calendar-entries"],
    getAllCalendarEntries
  );
  const { data: submissions, error } = useSWR(
    SUBMISSIONS_KEY,
    getAllSubmissions
  );

  const isLoading =
    !checklists || !teachers || !schools || !entries || (!submissions && !error);
  const calendar = {
    workingWeekdays: getWorkingWeekdays(schools?.[0]),
    entries: entries || [],
  };
  const submissionsById = new Map(
    (submissions || []).map((submission) => [submission.id, submission])
  );
  // One-time checklists have no day: show where they stand today.
  const day = frequency === "ONCE" ? today : date;

  // Every assigned teacher of every checklist due for the chosen day or week.
  const allRows = isLoading
    ? []
    : checklists
        .filter((checklist) => checklist.frequency === frequency)
        .filter((checklist) => isChecklistDue(checklist, day, calendar))
        .flatMap((checklist) => {
          const period = getPeriod(checklist.frequency, day);
          return checklist.assignments.map((assignment) => {
            const submission = submissionsById.get(
              submissionId(checklist.id, assignment.teacherId, period.periodKey)
            );
            const hasEnded = Boolean(period.end) && period.end < today;
            return {
              key: `${checklist.id}_${assignment.teacherId}`,
              checklist,
              teacherId: assignment.teacherId,
              teacherName: assignment.teacher?.name || "---",
              period,
              submission,
              status:
                submission?.status || (hasEnded ? "MISSED" : "NOT_STARTED"),
            };
          });
        })
        .filter(
          (row) =>
            (!teacherFilter || row.teacherId === teacherFilter) &&
            (!checklistFilter || row.checklist.id === checklistFilter)
        )
        .sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            a.teacherName.localeCompare(b.teacherName)
        );

  const counts = Object.fromEntries(
    STATUS_ORDER.map((status) => [
      status,
      allRows.filter((row) => row.status === status).length,
    ])
  );
  const lateCount = allRows.filter((row) => row.submission?.isLate).length;
  // A status with nothing left in it (after changing the day) falls back to all.
  const shownStatus =
    statusFilter !== "ALL" && !counts[statusFilter] ? "ALL" : statusFilter;
  const rows =
    shownStatus === "ALL"
      ? allRows
      : allRows.filter((row) => row.status === shownStatus);

  const open = (submission) => {
    setOpened(submission);
    setOpenCount((count) => count + 1);
  };

  const actionFor = (submission) =>
    submission && (
      <Button
        size="small"
        type={submission.status === "SUBMITTED" ? "primary" : "default"}
        onClick={() => open(submission)}
      >
        {submission.status === "SUBMITTED" ? "Review" : "View"}
      </Button>
    );

  const progressColumns = [
    { title: "Teacher", dataIndex: "teacherName", width: 180 },
    {
      title: "Checklist",
      key: "checklist",
      render: (_, row) => row.checklist.title,
    },
    {
      title: "Status",
      key: "status",
      width: 220,
      render: (_, row) => (
        <StatusCell status={row.status} submission={row.submission} />
      ),
    },
    {
      title: "Submitted",
      key: "submittedAt",
      width: 190,
      render: (_, row) => formatTime(row.submission?.submittedAt),
    },
    {
      title: "Coordinator",
      key: "coordinator",
      width: 160,
      render: (_, row) => row.submission?.coordinatorName || "---",
    },
    {
      title: "Reviewed by",
      key: "reviewedBy",
      width: 140,
      render: (_, row) => reviewerOf(row.submission),
    },
    {
      title: "",
      key: "action",
      width: 100,
      render: (_, row) => actionFor(row.submission),
    },
  ];

  // Every submission, including those kept after their teacher or
  // checklist was deleted.
  const teacherIds = new Set((teachers || []).map((teacher) => teacher.id));
  const checklistIds = new Set(
    (checklists || []).map((checklist) => checklist.id)
  );
  const historyRows = (submissions || []).map((submission) => ({
    ...submission,
    teacherLabel: teacherIds.has(submission.teacherId)
      ? submission.teacherName
      : `${submission.teacherName} (deleted)`,
    checklistLabel: checklistIds.has(submission.checklistId)
      ? submission.checklistTitle
      : `${submission.checklistTitle} (deleted)`,
  }));

  const historyColumns = [
    {
      title: "Teacher",
      dataIndex: "teacherLabel",
      width: 200,
      filters: filtersFor(historyRows, (row) => row.teacherLabel),
      filterSearch: true,
      onFilter: (value, row) => row.teacherLabel === value,
    },
    {
      title: "Checklist",
      dataIndex: "checklistLabel",
      filters: filtersFor(historyRows, (row) => row.checklistLabel),
      filterSearch: true,
      onFilter: (value, row) => row.checklistLabel === value,
    },
    {
      title: "For",
      key: "period",
      width: 190,
      render: (_, row) => formatPeriod(row.frequency, row.periodStart),
    },
    {
      title: "Status",
      key: "status",
      width: 220,
      filters: Object.entries(STATUS_LABELS)
        .filter(([status]) => !["NOT_STARTED", "MISSED"].includes(status))
        .map(([value, text]) => ({ text, value })),
      onFilter: (value, row) => row.status === value,
      render: (_, row) => <StatusCell status={row.status} submission={row} />,
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      width: 190,
      render: formatTime,
    },
    {
      title: "Reviewed by",
      key: "reviewedBy",
      width: 140,
      render: (_, row) => reviewerOf(row),
    },
    {
      title: "",
      key: "action",
      width: 100,
      render: (_, row) => actionFor(row),
    },
  ];

  const { holiday, isSchoolDay } = getDayInfo(date, calendar);
  const periodLabel =
    frequency === "WEEKLY"
      ? `${formatPeriod("WEEKLY", getPeriod("WEEKLY", date).start)} (Monday to Sunday)`
      : formatPeriod(frequency, date);
  let emptyText = "No checklists are due";
  if (frequency === "DAILY" && holiday) {
    emptyText = `No checklists are due: ${holiday.name}`;
  } else if (frequency === "DAILY" && !isSchoolDay) {
    emptyText = "No checklists are due: not a school day";
  }

  const teacherOptions = (teachers || [])
    .map((teacher) => ({ value: teacher.id, label: teacher.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const checklistOptions = (checklists || [])
    .filter((checklist) => checklist.frequency === frequency)
    .map((checklist) => ({ value: checklist.id, label: checklist.title }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Flex vertical gap="middle">
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load the checklist submissions"
          description={error.message}
        />
      )}
      <Tabs
        items={[
          {
            key: "progress",
            label: "Progress",
            children: (
              <Flex vertical gap="middle">
                <Space wrap>
                  <Segmented
                    value={frequency}
                    onChange={(value) => {
                      setFrequency(value);
                      setChecklistFilter(null);
                    }}
                    options={FREQUENCY_OPTIONS}
                  />
                  {frequency !== "ONCE" && (
                    <>
                      <DatePicker
                        value={dayjs(date)}
                        format="ddd, D MMM YYYY"
                        allowClear={false}
                        disabledDate={(value) =>
                          value.format("YYYY-MM-DD") > today
                        }
                        onChange={(value) =>
                          setDate(value.format("YYYY-MM-DD"))
                        }
                      />
                      {date !== today && (
                        <Button onClick={() => setDate(today)}>Today</Button>
                      )}
                    </>
                  )}
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="All teachers"
                    style={{ minWidth: 180 }}
                    value={teacherFilter}
                    onChange={setTeacherFilter}
                    options={teacherOptions}
                  />
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="All checklists"
                    style={{ minWidth: 180 }}
                    value={checklistFilter}
                    onChange={setChecklistFilter}
                    options={checklistOptions}
                  />
                </Space>
                <Typography.Text strong>
                  {periodLabel}
                  {lateCount > 0 && (
                    <Typography.Text type="secondary">
                      {` · ${lateCount} filled in late`}
                    </Typography.Text>
                  )}
                </Typography.Text>
                <Segmented
                  value={shownStatus}
                  onChange={setStatusFilter}
                  options={[
                    { value: "ALL", label: `All (${allRows.length})` },
                    ...STATUS_ORDER.filter(
                      (status) => counts[status] > 0
                    ).map((status) => ({
                      value: status,
                      label: `${STATUS_LABELS[status]} (${counts[status]})`,
                    })),
                  ]}
                />
                <Table
                  loading={isLoading}
                  rowKey="key"
                  columns={progressColumns}
                  dataSource={rows}
                  locale={{ emptyText }}
                />
              </Flex>
            ),
          },
          {
            key: "history",
            label: "All submissions",
            children: (
              <Table
                loading={isLoading}
                rowKey="id"
                columns={historyColumns}
                dataSource={historyRows}
              />
            ),
          },
        ]}
      />
      {opened && (
        <ReviewChecklistModal
          key={openCount}
          open
          submission={opened}
          onReviewed={() => mutate(SUBMISSIONS_KEY)}
          onClose={() => setOpened(null)}
        />
      )}
    </Flex>
  );
}

export default ChecklistProgress;
