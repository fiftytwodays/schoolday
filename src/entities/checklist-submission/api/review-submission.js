import { client, unwrap } from "@/shared/lib/amplify";

import { toSubmissionRecord } from "../lib/to-submission-record";

const parse = (value) => (typeof value === "string" ? JSON.parse(value) : value);

/**
 * Marks a submitted checklist reviewed ("REVIEWED") or sends it back
 * ("RETURNED", which needs a comment).
 */
export const reviewSubmission = async ({ submissionId, decision, comment }) =>
  toSubmissionRecord(
    parse(
      unwrap(
        await client.mutations.reviewChecklist({
          submissionId,
          decision,
          comment: comment?.trim() || null,
        })
      )
    )
  );

/**
 * Moves checklists waiting for review to the teachers' current
 * coordinators, or reviews them automatically when there is none with a
 * login. Admins run it after changing a coordinator or a login.
 */
export const syncChecklistReviewers = async () =>
  parse(unwrap(await client.mutations.syncChecklistReviewers()));
