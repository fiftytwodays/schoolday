import {
  assertNotReferenced,
  client,
  createCrudApi,
  deleteWhere,
  listAll,
  unwrap,
} from "@/shared/lib/amplify";

const { create, update, remove } = createCrudApi("Teacher");
const assignments = createCrudApi("ChecklistAssignment");

// A cleared select is undefined, which an update would ignore.
const withCoordinator = (values) =>
  "coordinatorId" in values
    ? { ...values, coordinatorId: values.coordinatorId || null }
    : values;

/**
 * Moves checklists waiting for review to the teachers' current
 * coordinators, or reviews them automatically when there is none with a
 * login. Needed after a coordinator or a login changes.
 */
export const syncChecklistReviewers = async () =>
  unwrap(await client.mutations.syncChecklistReviewers());

const sameCoordinator = (values, teacher) =>
  (values.coordinatorId || null) === (teacher?.coordinatorId || null);

export const createTeacher = (values) => create(withCoordinator(values));

/**
 * Pass the current `teacher` when the coordinator may change, so waiting
 * reviews follow it. Removing a login (`userId: null`) also moves the
 * reviews of the teachers they coordinate.
 */
export const updateTeacher = async (id, values, teacher) => {
  const updated = await update(id, withCoordinator(values));
  const coordinatorChanged =
    "coordinatorId" in values && !sameCoordinator(values, teacher);
  if (coordinatorChanged || values.userId === null) {
    await syncChecklistReviewers();
  }
  return updated;
};

// Checklist assignments only describe who does a checklist, so they are
// removed with the teacher instead of blocking the delete.
const removeChecklistAssignments = async (id) => {
  const teacher = unwrap(
    await client.models.Teacher.get(
      { id },
      { selectionSet: ["id", "checklistAssignments.id"] }
    )
  );
  await Promise.all(
    (teacher?.checklistAssignments || []).map((assignment) =>
      assignments.remove(assignment.id)
    )
  );
};

// Teachers coordinated by a deleted teacher are left without a coordinator.
const removeAsCoordinator = async (id) => {
  const coordinated = await listAll(client.models.Teacher, {
    filter: { coordinatorId: { eq: id } },
    selectionSet: ["id"],
  });
  await Promise.all(
    coordinated.map((teacher) => update(teacher.id, { coordinatorId: null }))
  );
};

/**
 * `deleteSubmissions` also deletes the teacher's checklist submissions;
 * otherwise they are kept as history.
 */
export const deleteTeacher = async (id, { deleteSubmissions = false } = {}) => {
  await assertNotReferenced(
    "Teacher",
    id,
    "associations",
    "class-subject-teacher associations"
  );
  await removeChecklistAssignments(id);
  await removeAsCoordinator(id);
  if (deleteSubmissions) {
    await deleteWhere("ChecklistSubmission", { teacherId: { eq: id } });
  }
  const removed = await remove(id);
  // Their teachers' waiting reviews, and their own kept ones, are settled.
  await syncChecklistReviewers();
  return removed;
};
