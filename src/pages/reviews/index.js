import { Page } from "@/shared/ui/page";
import { ChecklistReviews } from "@/widgets/checklist-reviews";

function ReviewsPage() {
  return (
    <Page
      showPageHeader
      header={{
        title: "Reviews",
        breadcrumbs: [
          {
            title: "Home",
          },
          {
            title: "Reviews",
          },
        ],
      }}
      content={<ChecklistReviews />}
    />
  );
}

export default ReviewsPage;
