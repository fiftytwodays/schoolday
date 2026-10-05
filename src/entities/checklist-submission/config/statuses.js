import { Tag } from "antd";
import dayjs from "dayjs";

// NOT_STARTED is not stored: it is a due checklist with no submission yet.
export const STATUS_LABELS = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Waiting for review",
  RETURNED: "Sent back",
  REVIEWED: "Reviewed",
};

const STATUS_COLORS = {
  NOT_STARTED: "default",
  IN_PROGRESS: "processing",
  SUBMITTED: "warning",
  RETURNED: "error",
  REVIEWED: "success",
};

export const StatusTag = ({ status, autoReviewed }) => (
  <Tag color={STATUS_COLORS[status]}>
    {status === "REVIEWED" && autoReviewed
      ? "Auto-reviewed"
      : STATUS_LABELS[status] || status}
  </Tag>
);

export const LateTag = () => <Tag color="orange">Late</Tag>;

/** "Sat, 3 Oct 2026", "Week of 28 Sep 2026" or "One-time". */
export const formatPeriod = (frequency, periodStart) => {
  if (frequency === "ONCE" || !periodStart) {
    return "One-time";
  }
  const date = dayjs(periodStart);
  return frequency === "WEEKLY"
    ? `Week of ${date.format("D MMM YYYY")}`
    : date.format("ddd, D MMM YYYY");
};

export const EVENT_LABELS = {
  SUBMITTED: "Submitted",
  RESUBMITTED: "Submitted again",
  AUTO_REVIEWED: "Reviewed automatically (no coordinator)",
  REASSIGNED: "Moved to a new coordinator",
  RETURNED: "Sent back",
  REVIEWED: "Reviewed",
};
