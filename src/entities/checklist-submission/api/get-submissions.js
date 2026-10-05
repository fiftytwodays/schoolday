import { client, listAll, sortRecords } from "@/shared/lib/amplify";

import { toSubmissionRecord } from "../lib/to-submission-record";

const getSubmissions = async (filter) => {
  const result = await listAll(client.models.ChecklistSubmission, { filter });

  return sortRecords(result, "-periodStart").map(toSubmissionRecord);
};

/** A teacher's own submissions, newest period first. */
export const getTeacherSubmissions = (teacherId) =>
  getSubmissions({ teacherId: { eq: teacherId } });

// Submitted to a coordinator: waiting, sent back or reviewed by a person.
const isForReview = (submission) =>
  submission.status !== "IN_PROGRESS" && !submission.autoReviewed;

/**
 * Submissions a coordinator reviews, or everyone's for admins when
 * `coordinatorUserId` is empty.
 */
export const getReviewSubmissions = async (coordinatorUserId) =>
  (
    await getSubmissions(
      coordinatorUserId
        ? { coordinatorUserId: { eq: coordinatorUserId } }
        : undefined
    )
  ).filter(isForReview);

/** Every submission; admins only. */
export const getAllSubmissions = () => getSubmissions();
