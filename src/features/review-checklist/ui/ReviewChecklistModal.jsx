import { useState } from "react";
import {
  Button,
  Descriptions,
  Flex,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";

import {
  LateTag,
  StatusTag,
  SubmissionItems,
  SubmissionTimeline,
  formatPeriod,
} from "@/entities/checklist-submission";
import { reviewSubmission } from "@/entities/checklist-submission/api/review-submission";

/**
 * Shows a teacher's submitted checklist so their coordinator (or an admin)
 * can mark it reviewed or send it back with a comment. Mount it again (with
 * a new key) for each submission opened.
 */
function ReviewChecklistModal({ open, submission, onReviewed, onClose }) {
  const [comment, setComment] = useState("");
  const [showCommentError, setShowCommentError] = useState(false);
  const [savingDecision, setSavingDecision] = useState(null);

  const canReview = submission.status === "SUBMITTED";
  const doneCount = submission.items.filter((item) => item.done).length;

  const review = async (decision) => {
    if (decision === "RETURNED" && !comment.trim()) {
      setShowCommentError(true);
      message.error("Add a comment explaining what to change.");
      return;
    }
    setSavingDecision(decision);
    try {
      const saved = await reviewSubmission({
        submissionId: submission.id,
        decision,
        comment,
      });
      message.success(
        decision === "RETURNED" ? "Sent back to the teacher!" : "Marked reviewed!"
      );
      onReviewed?.(saved);
      onClose();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingDecision(null);
    }
  };

  const closeButton = (
    <Button key="close" onClick={onClose}>
      Close
    </Button>
  );
  const footer = canReview
    ? [
        closeButton,
        <Button
          key="return"
          danger
          onClick={() => review("RETURNED")}
          loading={savingDecision === "RETURNED"}
          disabled={Boolean(savingDecision)}
        >
          Send back
        </Button>,
        <Button
          key="review"
          type="primary"
          onClick={() => review("REVIEWED")}
          loading={savingDecision === "REVIEWED"}
          disabled={Boolean(savingDecision)}
        >
          Mark reviewed
        </Button>,
      ]
    : [closeButton];

  return (
    <Modal
      open={open}
      title={submission.checklistTitle}
      onCancel={onClose}
      footer={footer}
      width={720}
      destroyOnClose
    >
      <Flex vertical gap="middle">
        <Space wrap>
          <StatusTag
            status={submission.status}
            autoReviewed={submission.autoReviewed}
          />
          {submission.isLate && <LateTag />}
        </Space>
        <Descriptions
          size="small"
          column={1}
          bordered
          items={[
            { key: "teacher", label: "Teacher", children: submission.teacherName },
            {
              key: "period",
              label: "For",
              children: formatPeriod(
                submission.frequency,
                submission.periodStart
              ),
            },
            {
              key: "submitted",
              label: "Submitted",
              children: submission.submittedAt
                ? dayjs(submission.submittedAt).format("D MMM YYYY, h:mm A")
                : "---",
            },
            {
              key: "done",
              label: "Activities done",
              children: `${doneCount} of ${submission.items.length}`,
            },
          ]}
        />
        <SubmissionItems items={submission.items} />
        {canReview && (
          <Flex vertical gap={4}>
            <Typography.Text strong>Your comment</Typography.Text>
            <Input.TextArea
              value={comment}
              autoSize={{ minRows: 2, maxRows: 6 }}
              status={showCommentError && !comment.trim() ? "error" : undefined}
              placeholder="Optional when marking reviewed; required when sending back"
              onChange={(event) => setComment(event.target.value)}
            />
          </Flex>
        )}
        <SubmissionTimeline events={submission.events} />
      </Flex>
    </Modal>
  );
}

export default ReviewChecklistModal;
