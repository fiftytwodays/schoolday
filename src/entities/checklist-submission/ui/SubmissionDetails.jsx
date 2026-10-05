import { Flex, Timeline, Typography } from "antd";
import { CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";

import { EVENT_LABELS } from "../config/statuses";

/** The activities of a submission as saved, with their comments. */
export function SubmissionItems({ items = [] }) {
  return (
    <Flex vertical gap="small">
      {items.map((item) => (
        <Flex key={item.itemId} vertical gap={2}>
          <Flex gap="small" align="baseline">
            {item.done ? (
              <CheckCircleFilled style={{ color: "#52c41a" }} />
            ) : (
              <CloseCircleFilled style={{ color: "#ff4d4f" }} />
            )}
            <Typography.Text>{item.title}</Typography.Text>
          </Flex>
          {item.comment && (
            <Typography.Text type="secondary" style={{ marginLeft: 22 }}>
              {item.comment}
            </Typography.Text>
          )}
        </Flex>
      ))}
    </Flex>
  );
}

/** What happened to a submission: submitted, sent back, reviewed... */
export function SubmissionTimeline({ events }) {
  if (!events?.length) {
    return null;
  }
  return (
    <>
      <Typography.Title level={5} style={{ margin: 0 }}>
        History
      </Typography.Title>
      <Timeline
        items={events.map((event) => ({
          children: (
            <>
              <div>
                {EVENT_LABELS[event.type] || event.type}
                {event.by && event.type !== "AUTO_REVIEWED"
                  ? ` by ${event.by}`
                  : ""}
              </div>
              <Typography.Text type="secondary">
                {dayjs(event.at).format("D MMM YYYY, h:mm A")}
              </Typography.Text>
              {event.comment && <div>&ldquo;{event.comment}&rdquo;</div>}
            </>
          ),
        }))}
      />
    </>
  );
}
