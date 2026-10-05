import { Page } from "@/shared/ui/page";
import { ChecklistProgress } from "@/widgets/checklist-progress";

function ChecklistProgressPage() {
  return (
    <Page
      showPageHeader
      header={{
        title: "Checklist progress",
        breadcrumbs: [
          {
            title: "Home",
          },
          {
            title: "Checklist progress",
          },
        ],
      }}
      content={<ChecklistProgress />}
    />
  );
}

export default ChecklistProgressPage;
