import type { AppSyncIdentityCognito } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/checklist-workflow";

import type { Schema } from "../../data/resource";
import {
  EDITABLE_STATUSES,
  getFillInState,
  getStartDate,
  getLateDaysLimit,
  getMissingComments,
  getPeriod,
  isChecklistDue,
  submissionId,
  todayInSchool,
} from "../../../src/shared/lib/checklist-rules.js";
import { getWorkingWeekdays } from "../../../src/shared/lib/school-calendar.js";

const { resourceConfig, libraryOptions } =
  await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

type Item = {
  itemId: string;
  title: string;
  done: boolean;
  comment: string | null;
};

type Event = {
  type:
    | "SUBMITTED"
    | "RESUBMITTED"
    | "AUTO_REVIEWED"
    | "REASSIGNED"
    | "RETURNED"
    | "REVIEWED";
  at: string;
  // Empty for changes SchoolDay makes itself.
  by: string | null;
  comment?: string | null;
};

type SaveArguments = {
  checklistId: string;
  date: string;
  items: unknown;
  submit: boolean;
};

type ReviewArguments = {
  submissionId: string;
  decision: string;
  comment?: string | null;
};

// The payload Amplify's function resolver sends.
type ResolverEvent = {
  fieldName: string;
  arguments: Record<string, unknown>;
  identity: AppSyncIdentityCognito | null;
};

type Teacher = {
  id: string;
  name?: string | null;
  userId?: string | null;
};

const isAdmin = (identity: AppSyncIdentityCognito) =>
  (identity.groups ?? []).includes("ADMIN");

// Submission fields for a coordinator who will review it.
const assignTo = (coordinator: Teacher) => ({
  status: "SUBMITTED",
  coordinatorId: coordinator.id,
  coordinatorUserId: coordinator.userId,
  coordinatorName: coordinator.name,
  autoReviewed: false,
});

// Submission fields when there is no coordinator (with a login) to review it.
const autoReview = (now: string) => ({
  status: "REVIEWED",
  coordinatorId: null,
  coordinatorUserId: null,
  coordinatorName: null,
  autoReviewed: true,
  reviewedAt: now,
  reviewedBy: null,
});

type Response<T> = {
  data: T;
  errors?: { message: string }[];
  nextToken?: string | null;
};

const unwrap = <T>({ data, errors }: Response<T>) => {
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }
  return data;
};

const listAll = async <T>(
  list: (options: { nextToken?: string | null }) => Promise<Response<T[]>>
) => {
  const items: T[] = [];
  let nextToken: string | null | undefined = null;
  do {
    const response: Response<T[]> = await list({ nextToken });
    items.push(...unwrap(response));
    nextToken = response.nextToken;
  } while (nextToken);
  return items;
};

// JSON fields can come back as strings.
const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return (value as T) ?? fallback;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Builds the activities from the checklist, applying the teacher's input. */
const toItems = (
  checklistItems: { id: string; title: string; sortOrder: number | null }[],
  input: unknown
): Item[] => {
  const values = parseJson<{ itemId?: string; done?: unknown; comment?: unknown }[]>(
    input,
    []
  );
  if (!Array.isArray(values)) {
    throw new Error("The activities are not in the expected format.");
  }
  const byId = new Map(values.map((value) => [value.itemId, value]));

  return [...checklistItems]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item) => {
      const value = byId.get(item.id);
      const comment =
        typeof value?.comment === "string" ? value.comment.trim() : "";
      return {
        itemId: item.id,
        title: item.title,
        done: value?.done === true,
        comment: comment || null,
      };
    });
};

const saveChecklist = async (
  { checklistId, date, items: input, submit }: SaveArguments,
  identity: AppSyncIdentityCognito
) => {
  const today = todayInSchool();
  if (!DATE_PATTERN.test(date)) {
    throw new Error("The date is not valid.");
  }
  if (date > today) {
    throw new Error("You cannot fill in a checklist for a future date.");
  }

  const [teacher] = await listAll((options) =>
    client.models.Teacher.list({
      ...options,
      filter: { userId: { eq: identity.sub } },
    })
  );
  if (!teacher) {
    throw new Error("Your login is not linked to a teacher.");
  }

  const checklist = unwrap(
    await client.models.Checklist.get(
      { id: checklistId },
      {
        selectionSet: [
          "id",
          "title",
          "frequency",
          "lateLimit",
          "lateDays",
          "startDate",
          "createdAt",
          "items.id",
          "items.title",
          "items.sortOrder",
        ],
      }
    )
  );
  if (!checklist) {
    throw new Error("This checklist no longer exists.");
  }

  const assignments = await listAll((options) =>
    client.models.ChecklistAssignment.list({
      ...options,
      filter: {
        checklistId: { eq: checklistId },
        teacherId: { eq: teacher.id },
      },
    })
  );
  if (assignments.length === 0) {
    throw new Error("This checklist is not assigned to you.");
  }

  const [schools, entries] = await Promise.all([
    listAll((options) => client.models.School.list(options)),
    listAll((options) => client.models.CalendarEntry.list(options)),
  ]);
  const school = schools[0];
  const calendar = { workingWeekdays: getWorkingWeekdays(school), entries };

  const frequency = checklist.frequency ?? "DAILY";
  const period = getPeriod(frequency, date);
  const startDate = getStartDate(checklist);
  if (startDate && (frequency === "ONCE" ? date : period.end) < startDate) {
    throw new Error(`This checklist starts on ${startDate}.`);
  }
  if (!isChecklistDue({ ...checklist, frequency }, date, calendar)) {
    throw new Error(
      frequency === "WEEKLY"
        ? "That week has no school days."
        : "That day is not a school day."
    );
  }

  const fillIn = getFillInState({
    frequency,
    period,
    today,
    lateDays: getLateDaysLimit(checklist, school),
  });
  if (fillIn.reason === "NOT_STARTED") {
    throw new Error("You cannot fill in a checklist for a future date.");
  }
  if (fillIn.reason === "TOO_LATE") {
    throw new Error("It is too late to fill in this checklist.");
  }

  const id = submissionId(checklistId, teacher.id, period.periodKey);
  const existing = unwrap(await client.models.ChecklistSubmission.get({ id }));
  if (existing && !EDITABLE_STATUSES.includes(existing.status ?? "")) {
    throw new Error("This checklist has already been submitted.");
  }

  const items = toItems(checklist.items, input);
  if (submit) {
    const missing: Item[] = getMissingComments(items);
    if (missing.length > 0) {
      throw new Error(
        `Add a comment for each activity that is not done: ${missing
          .map((item) => item.title)
          .join(", ")}.`
      );
    }
  }

  const now = new Date().toISOString();
  const events = parseJson<Event[]>(existing?.events, []);
  const fields: Record<string, unknown> = {
    checklistId,
    teacherId: teacher.id,
    periodKey: period.periodKey,
    periodStart: period.start,
    frequency,
    items: JSON.stringify(items),
    checklistTitle: checklist.title,
    teacherName: teacher.name,
    teacherUserId: identity.sub,
    // A sent-back checklist stays sent back until it is submitted again.
    status: existing?.status === "RETURNED" ? "RETURNED" : "IN_PROGRESS",
  };

  if (submit) {
    // The coordinator needs a login to review; without one the checklist is
    // reviewed automatically.
    const coordinator = teacher.coordinatorId
      ? unwrap(await client.models.Teacher.get({ id: teacher.coordinatorId }))
      : null;
    events.push({
      type: existing?.status === "RETURNED" ? "RESUBMITTED" : "SUBMITTED",
      at: now,
      by: teacher.name ?? identity.username,
    });
    Object.assign(fields, {
      submittedAt: now,
      isLate: fillIn.isLate,
      reviewComment: null,
    });

    if (coordinator?.userId) {
      Object.assign(fields, assignTo(coordinator));
    } else {
      events.push({ type: "AUTO_REVIEWED", at: now, by: null });
      Object.assign(fields, autoReview(now));
    }
  }
  fields.events = JSON.stringify(events);

  const saved = existing
    ? await client.models.ChecklistSubmission.update({ id, ...fields } as never)
    : await client.models.ChecklistSubmission.create({ id, ...fields } as never);
  return unwrap(saved);
};

/**
 * Marks a submitted checklist reviewed, or sends it back with a comment.
 * Only the submission's coordinator or an admin can.
 */
const reviewChecklist = async (
  { submissionId: id, decision, comment }: ReviewArguments,
  identity: AppSyncIdentityCognito
) => {
  if (decision !== "REVIEWED" && decision !== "RETURNED") {
    throw new Error("The decision must be REVIEWED or RETURNED.");
  }
  const trimmedComment = comment?.trim() || null;
  if (decision === "RETURNED" && !trimmedComment) {
    throw new Error("Add a comment explaining what to change.");
  }

  const submission = unwrap(await client.models.ChecklistSubmission.get({ id }));
  if (!submission) {
    throw new Error("This checklist submission no longer exists.");
  }
  if (submission.coordinatorUserId !== identity.sub && !isAdmin(identity)) {
    throw new Error("Only the teacher's coordinator or an admin can review it.");
  }
  if (submission.status !== "SUBMITTED") {
    throw new Error("This checklist is not waiting for review.");
  }

  const [reviewer] = await listAll((options) =>
    client.models.Teacher.list({
      ...options,
      filter: { userId: { eq: identity.sub } },
    })
  );
  const by = reviewer?.name ?? identity.username;
  const now = new Date().toISOString();
  const events = parseJson<Event[]>(submission.events, []);
  events.push({ type: decision, at: now, by, comment: trimmedComment });

  return unwrap(
    await client.models.ChecklistSubmission.update({
      id,
      status: decision,
      reviewedAt: now,
      reviewedBy: by,
      reviewComment: trimmedComment,
      events: JSON.stringify(events),
    } as never)
  );
};

/**
 * Brings checklists waiting for review in line with the teachers'
 * coordinators, after a coordinator or a login changes: they move to the
 * teacher's current coordinator, or are reviewed automatically when the
 * teacher has no coordinator with a login. Admins only.
 */
const syncChecklistReviewers = async (identity: AppSyncIdentityCognito) => {
  if (!isAdmin(identity)) {
    throw new Error("Only admins can do this.");
  }

  const [waiting, teachers] = await Promise.all([
    listAll((options) =>
      client.models.ChecklistSubmission.list({
        ...options,
        filter: { status: { eq: "SUBMITTED" } },
      })
    ),
    listAll((options) => client.models.Teacher.list(options)),
  ]);
  const teachersById = new Map(
    teachers.map((teacher) => [teacher.id, teacher])
  );

  let reassigned = 0;
  let autoReviewed = 0;
  const now = new Date().toISOString();

  for (const submission of waiting) {
    const teacher = teachersById.get(submission.teacherId);
    const coordinator = teacher?.coordinatorId
      ? teachersById.get(teacher.coordinatorId)
      : undefined;
    const events = parseJson<Event[]>(submission.events, []);
    let fields: Record<string, unknown>;

    if (coordinator?.userId) {
      if (
        submission.coordinatorId === coordinator.id &&
        submission.coordinatorUserId === coordinator.userId
      ) {
        continue;
      }
      events.push({
        type: "REASSIGNED",
        at: now,
        by: null,
        comment: `Now reviewed by ${coordinator.name}`,
      });
      fields = assignTo(coordinator);
      reassigned++;
    } else {
      events.push({ type: "AUTO_REVIEWED", at: now, by: null });
      fields = autoReview(now);
      autoReviewed++;
    }

    unwrap(
      await client.models.ChecklistSubmission.update({
        id: submission.id,
        ...fields,
        events: JSON.stringify(events),
      } as never)
    );
  }

  return { reassigned, autoReviewed };
};

export const handler = async (event: ResolverEvent) => {
  const { identity } = event;
  if (!identity?.sub) {
    throw new Error("You must be signed in.");
  }
  switch (event.fieldName) {
    case "saveChecklist":
      return saveChecklist(
        event.arguments as unknown as SaveArguments,
        identity
      );
    case "reviewChecklist":
      return reviewChecklist(
        event.arguments as unknown as ReviewArguments,
        identity
      );
    case "syncChecklistReviewers":
      return syncChecklistReviewers(identity);
    default:
      throw new Error(`Unknown operation ${event.fieldName}`);
  }
};
