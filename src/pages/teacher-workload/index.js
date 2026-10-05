import { Page } from "@/shared/ui/page";
import { TeacherWorkload } from "@/widgets/teacher-workload";

function TeacherWorkloadPage() {
  return (
    <Page
      showPageHeader
      header={{
        title: "Teacher workload",
        breadcrumbs: [
          {
            title: "Home",
          },
          {
            title: "Teacher workload",
          },
        ],
      }}
      content={<TeacherWorkload />}
    />
  );
}

export default TeacherWorkloadPage;
