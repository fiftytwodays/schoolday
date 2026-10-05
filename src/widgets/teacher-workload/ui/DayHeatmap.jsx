import { Flex, Tooltip, Typography } from "antd";

import { HEAT_RAMP, INK } from "./chart-theme";

const NAME_WIDTH = 150;

// A darker blue for more periods; a full day is the darkest step.
const cellColors = (count, periodsPerDay) => {
  if (count === 0) {
    return { background: INK.empty, color: INK.muted };
  }
  const share = Math.min(count / Math.max(periodsPerDay, 1), 1);
  const step = Math.max(Math.ceil(share * HEAT_RAMP.length) - 1, 0);
  return {
    background: HEAT_RAMP[step],
    color: step >= 3 ? "#ffffff" : INK.primary,
  };
};

/**
 * Periods per day for each teacher, to spot uneven weeks: a heavy day next
 * to an empty one even when the weekly total looks fine.
 */
function DayHeatmap({ teachers, days, periodsPerDay }) {
  const columns = `${NAME_WIDTH}px repeat(${days.length}, minmax(36px, 1fr))`;

  return (
    <Flex vertical gap={2} style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: columns, gap: 2 }}>
        <span />
        {days.map((day) => (
          <Typography.Text
            key={day}
            type="secondary"
            style={{ textAlign: "center", fontSize: 12 }}
          >
            {day.slice(0, 3)}
          </Typography.Text>
        ))}
      </div>
      {teachers.map((teacher) => (
        <div
          key={teacher.id}
          style={{
            display: "grid",
            gridTemplateColumns: columns,
            gap: 2,
            alignItems: "center",
          }}
        >
          <Typography.Text ellipsis style={{ paddingRight: 8 }}>
            {teacher.name}
          </Typography.Text>
          {days.map((day) => {
            const count = teacher.perDay[day] || 0;
            return (
              <Tooltip
                key={day}
                title={`${teacher.name} · ${day}: ${count} of ${periodsPerDay} periods`}
              >
                <div
                  style={{
                    ...cellColors(count, periodsPerDay),
                    height: 28,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {count}
                </div>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </Flex>
  );
}

export default DayHeatmap;
