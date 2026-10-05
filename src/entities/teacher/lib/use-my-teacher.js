import useSWR from "swr";

import useCurrentUser from "@/shared/lib/use-current-user";
import { getAllTeachers } from "../api/get-teachers";

/**
 * The teacher linked to the signed-in login, or null if there is none, and
 * whether they coordinate other teachers. `isLoading` is true until both
 * are known.
 */
export default function useMyTeacher() {
  const currentUser = useCurrentUser();
  const { data: teachers, error } = useSWR(["/api/teachers"], getAllTeachers);

  const isLoading = currentUser.isLoading || (!teachers && !error);
  const teacher =
    teachers?.find((candidate) => candidate.userId === currentUser.userId) ??
    null;

  const isCoordinator = Boolean(
    teacher && teachers?.some((other) => other.coordinatorId === teacher.id)
  );

  return { teacher, isCoordinator, isLoading, error, currentUser };
}
