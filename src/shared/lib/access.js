// Pages a teacher may open. Every other page is for admins only.
const TEACHER_ROUTES = [
  "/",
  "/404",
  "/class-timetable",
  "/students-timetable",
  "/teachers-timetable",
  "/calendar",
  "/my-checklists",
  "/reviews",
];

export const canAccess = (pathname, { isAdmin }) =>
  isAdmin || TEACHER_ROUTES.includes(pathname);
