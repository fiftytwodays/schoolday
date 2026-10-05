import { useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Flex,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
} from "antd";
import dayjs from "dayjs";
import useSWR, { mutate } from "swr";

import {
  LateTag,
  StatusTag,
  formatPeriod,
} from "@/entities/checklist-submission";
import { getReviewSubmissions } from "@/entities/checklist-submission/api/get-submissions";
import useMyTeacher from "@/entities/teacher/lib/use-my-teacher";
import { ReviewChecklistModal } from "@/features/review-checklist";

const formatTime = (value) =>
  value ? dayjs(value).format("D MMM YYYY, h:mm A") : "---";

const byTime = (field, direction = 1) => (a, b) =>
  String(a[field] ?? "").localeCompare(String(b[field] ?? "")) * direction;

// Select options for the distinct values of a field.
const optionsFor = (submissions, valueField, labelField) =>
  [
    ...new Map(
      submissions.map((submission) => [
        submission[valueField],
        submission[labelField],
      ])
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

function ChecklistReviews() {
  const {
    isCoordinator,
    currentUser,
    isLoading: isTeacherLoading,
  } = useMyTeacher();
  const [scope, setScope] = useState(null);
  const [teacherFilter, setTeacherFilter] = useState(null);
  const [checklistFilter, setChecklistFilter] = useState(null);
  const [opened, setOpened] = useState(null);
  const [openCount, setOpenCount] = useState(0);

  const isAdmin = Boolean(currentUser.isAdmin);
  // Admins who coordinate nobody start with everyone's reviews.
  const effectiveScope =
    scope ?? (isAdmin && !isCoordinator ? "all" : "mine");
  const showAll = isAdmin && effectiveScope === "all";

  const submissionsKey =
    currentUser.userId && !isTeacherLoading
      ? ["/api/review-submissions", showAll ? "all" : currentUser.userId]
      : null;
  const { data: submissions, error } = useSWR(submissionsKey, () =>
    getReviewSubmissions(showAll ? null : currentUser.userId)
  );

  if (isTeacherLoading) {
    return <Skeleton active />;
  }

  const filtered = (submissions || []).filter(
    (submission) =>
      (!teacherFilter || submission.teacherId === teacherFilter) &&
      (!checklistFilter || submission.checklistId === checklistFilter)
  );
  const waiting = filtered
    .filter((submission) => submission.status === "SUBMITTED")
    .sort(byTime("submittedAt"));
  const decided = filtered
    .filter((submission) => submission.status !== "SUBMITTED")
    .sort(byTime("reviewedAt", -1));

  const open = (submission) => {
    setOpened(submission);
    setOpenCount((count) => count + 1);
  };

  const columns = (timeField, timeTitle) => [
    {
      title: "Teacher",
      dataIndex: "teacherName",
      width: 180,
    },
    {
      title: "Checklist",
      dataIndex: "checklistTitle",
    },
    {
      title: "For",
      key: "period",
      width: 190,
      render: (_, submission) =>
        formatPeriod(submission.frequency, submission.periodStart),
    },
    {
      title: timeTitle,
      dataIndex: timeField,
      width: 190,
      render: formatTime,
    },
    {
      title: "Status",
      key: "status",
      width: 200,
      render: (_, submission) => (
        <Space size="small">
          <StatusTag
            status={submission.status}
            autoReviewed={submission.autoReviewed}
          />
          {submission.isLate && <LateTag />}
        </Space>
      ),
    },
    {
      title: "",
      key: "action",
      width: 110,
      render: (_, submission) =>
        submission.status === "SUBMITTED" ? (
          <Button type="primary" size="small" onClick={() => open(submission)}>
            Review
          </Button>
        ) : (
          <Button size="small" onClick={() => open(submission)}>
            View
          </Button>
        ),
    },
  ];

  if (!isAdmin && !isCoordinator) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="You don't coordinate any teachers, so there is nothing to review."
      />
    );
  }

  return (
    <Flex vertical gap="middle">
      {error && (
        <Alert
          type="error"
          showIcon
          message="Could not load the checklists to review"
          description={error.message}
        />
      )}
      <Space wrap>
        {isAdmin && (
          <Segmented
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: "mine", label: "My teachers" },
              { value: "all", label: "All teachers" },
            ]}
          />
        )}
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All teachers"
          style={{ minWidth: 200 }}
          value={teacherFilter}
          onChange={setTeacherFilter}
          options={optionsFor(submissions || [], "teacherId", "teacherName")}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All checklists"
          style={{ minWidth: 200 }}
          value={checklistFilter}
          onChange={setChecklistFilter}
          options={optionsFor(
            submissions || [],
            "checklistId",
            "checklistTitle"
          )}
        />
      </Space>
      <Tabs
        items={[
          {
            key: "waiting",
            label: `Waiting for review (${waiting.length})`,
            children: (
              <Table
                loading={!submissions && !error}
                rowKey="id"
                columns={columns("submittedAt", "Submitted")}
                dataSource={waiting}
                locale={{ emptyText: "Nothing is waiting for review" }}
              />
            ),
          },
          {
            key: "decided",
            label: "Reviewed and sent back",
            children: (
              <Table
                loading={!submissions && !error}
                rowKey="id"
                columns={columns("reviewedAt", "Decided")}
                dataSource={decided}
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
          onReviewed={() => mutate(submissionsKey)}
          onClose={() => setOpened(null)}
        />
      )}
    </Flex>
  );
}

export default ChecklistReviews;
