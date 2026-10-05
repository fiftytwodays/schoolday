import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from "antd";

import {
  LateTag,
  StatusTag,
  SubmissionItems,
  SubmissionTimeline,
} from "@/entities/checklist-submission";
import { saveSubmission } from "@/entities/checklist-submission/api/save-submission";
import {
  EDITABLE_STATUSES,
  getMissingComments,
} from "@/shared/lib/checklist-rules";

// The checklist's current activities with what the teacher saved so far, or
// the saved copy when the submission can no longer change.
const initialRows = (checklist, submission, isEditable) => {
  if (!isEditable || !checklist) {
    return submission?.items || [];
  }
  const saved = new Map(
    (submission?.items || []).map((item) => [item.itemId, item])
  );
  return checklist.items.map((item) => ({
    itemId: item.id,
    title: item.title,
    done: saved.get(item.id)?.done ?? false,
    comment: saved.get(item.id)?.comment ?? "",
  }));
};

function ReviewComment({ submission }) {
  if (!submission?.reviewComment) {
    return null;
  }
  const isReturned = submission.status === "RETURNED";
  return (
    <Alert
      type={isReturned ? "warning" : "info"}
      showIcon
      message={`${isReturned ? "Sent back" : "Reviewed"} by ${
        submission.reviewedBy || "the coordinator"
      }`}
      description={submission.reviewComment}
    />
  );
}

/**
 * Fills in a checklist for one day or week, or shows a submitted one. Mount
 * it again (with a new key) for each checklist opened.
 */
function FillInChecklistModal({
  open,
  checklist,
  date,
  periodLabel,
  submission,
  fillIn,
  onSaved,
  onClose,
}) {
  const isEditable =
    Boolean(checklist) &&
    Boolean(fillIn?.canFillIn) &&
    (!submission || EDITABLE_STATUSES.includes(submission.status));
  const [rows, setRows] = useState(() =>
    initialRows(checklist, submission, isEditable)
  );
  const [showErrors, setShowErrors] = useState(false);
  const [savingAction, setSavingAction] = useState(null);

  const status = submission?.status || "NOT_STARTED";
  const isLate = submission?.isLate || (isEditable && fillIn?.isLate);
  const missing = new Set(getMissingComments(rows).map((row) => row.itemId));

  const updateRow = (itemId, changes) =>
    setRows((current) =>
      current.map((row) =>
        row.itemId === itemId ? { ...row, ...changes } : row
      )
    );

  const save = async (submit) => {
    if (submit && missing.size > 0) {
      setShowErrors(true);
      message.error("Add a comment for each activity that is not done.");
      return;
    }
    setSavingAction(submit ? "submit" : "save");
    try {
      const saved = await saveSubmission({
        checklistId: checklist.id,
        date,
        items: rows,
        submit,
      });
      if (!submit) {
        message.success("Progress saved!");
      } else if (saved.autoReviewed) {
        message.success("Submitted and reviewed automatically!");
      } else {
        message.success("Submitted for review!");
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingAction(null);
    }
  };

  const closeButton = (
    <Button key="close" onClick={onClose}>
      Close
    </Button>
  );
  const footer = isEditable
    ? [
        closeButton,
        <Button
          key="save"
          onClick={() => save(false)}
          loading={savingAction === "save"}
          disabled={Boolean(savingAction)}
        >
          Save progress
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={() => save(true)}
          loading={savingAction === "submit"}
          disabled={Boolean(savingAction)}
        >
          {status === "RETURNED" ? "Submit again" : "Submit"}
        </Button>,
      ]
    : [closeButton];

  return (
    <Modal
      open={open}
      title={checklist?.title || submission?.checklistTitle}
      onCancel={onClose}
      footer={footer}
      width={720}
      destroyOnClose
    >
      <Flex vertical gap="middle">
        <Space wrap>
          <Typography.Text strong>{periodLabel}</Typography.Text>
          <StatusTag status={status} autoReviewed={submission?.autoReviewed} />
          {isLate && <LateTag />}
        </Space>
        {checklist?.description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {checklist.description}
          </Typography.Paragraph>
        )}
        <ReviewComment submission={submission} />
        {isEditable && (
          <Typography.Text type="secondary">
            Tick each activity you completed. A comment is optional, but
            required for any activity you did not complete.
          </Typography.Text>
        )}
        {isEditable ? (
          <Flex vertical gap="small">
            {rows.map((row) => {
              const hasError = showErrors && missing.has(row.itemId);
              return (
                <Flex key={row.itemId} vertical gap={4}>
                  <Checkbox
                    checked={row.done}
                    onChange={(event) =>
                      updateRow(row.itemId, { done: event.target.checked })
                    }
                  >
                    {row.title}
                  </Checkbox>
                  <Input.TextArea
                    value={row.comment}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    status={hasError ? "error" : undefined}
                    placeholder={
                      row.done
                        ? "Comment (optional)"
                        : "Why was this not done? (required to submit)"
                    }
                    onChange={(event) =>
                      updateRow(row.itemId, { comment: event.target.value })
                    }
                    style={{ marginLeft: 24, width: "calc(100% - 24px)" }}
                  />
                  {hasError && (
                    <Typography.Text type="danger" style={{ marginLeft: 24 }}>
                      Please add a comment
                    </Typography.Text>
                  )}
                </Flex>
              );
            })}
          </Flex>
        ) : (
          <SubmissionItems items={rows} />
        )}
        <SubmissionTimeline events={submission?.events} />
      </Flex>
    </Modal>
  );
}

export default FillInChecklistModal;
