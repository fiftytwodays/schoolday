import { client, listAll } from "@/shared/lib/amplify";

import { computeWorkload } from "../lib/compute-workload";

/** Loads the timetable and works out every teacher's workload. */
export const getWorkload = async () => {
  const [entries, teachers, associations, days, periods] = await Promise.all([
    listAll(client.models.ClassTimetable, {
      selectionSet: [
        "id",
        "day.name",
        "period.type",
        "period.startTime",
        "period.endTime",
        "csta.id",
        "csta.teacherId",
        "csta.subjectId",
        "csta.classId",
        "csta.subject.name",
        "csta.schoolClass.name",
      ],
    }),
    listAll(client.models.Teacher, { selectionSet: ["id", "name"] }),
    listAll(client.models.ClassSubjectTeacherAssociation, {
      selectionSet: ["id", "teacherId", "subject.name", "schoolClass.name"],
    }),
    listAll(client.models.Day, { selectionSet: ["id", "name"] }),
    listAll(client.models.Period, {
      selectionSet: ["id", "type", "startTime", "endTime"],
    }),
  ]);

  return computeWorkload({
    entries,
    teachers,
    associations: associations.map((association) => ({
      id: association.id,
      teacherId: association.teacherId,
      subjectName: association.subject?.name,
      className: association.schoolClass?.name,
    })),
    days,
    periods,
  });
};
