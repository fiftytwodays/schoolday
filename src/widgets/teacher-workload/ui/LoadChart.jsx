import { Flex, Tooltip, Typography } from "antd";

import LoadStatus from "./LoadStatus";
import { INK, SERIES, formatHours } from "./chart-theme";

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 16;
const NAME_WIDTH = 150;
const VALUE_WIDTH = 150;

function Legend() {
  return (
    <Flex gap="middle" wrap style={{ color: INK.secondary, fontSize: 12 }}>
      {Object.values(SERIES).map(({ color, label }) => (
        <Flex key={label} gap={6} align="center">
          <span
            style={{ width: 12, height: 12, borderRadius: 2, background: color }}
          />
          {label}
        </Flex>
      ))}
      <Flex gap={6} align="center">
        <span
          style={{ width: 14, borderTop: `2px dashed ${INK.secondary}` }}
        />
        School average
      </Flex>
    </Flex>
  );
}

const tooltipFor = (teacher, capacity) => (
  <>
    <div>
      <strong>{teacher.name}</strong>
    </div>
    <div>
      {teacher.total} periods: {teacher.weekday} weekday, {teacher.weekend}{" "}
      weekend
    </div>
    <div>
      {formatHours(teacher.hours)} h per week ·{" "}
      {Math.round(teacher.loadShare * 100)}% of {capacity} periods
    </div>
  </>
);

/**
 * Periods per week for each teacher, most loaded first: weekday and weekend
 * stacked, with the school average marked.
 */
function LoadChart({ teachers, average, capacity }) {
  const max = Math.max(1, average, ...teachers.map((teacher) => teacher.total));
  const percent = (value) => `${(value / max) * 100}%`;

  return (
    <Flex vertical gap="small">
      <Legend />
      <div style={{ position: "relative" }}>
        {/* The average line spans the bar area of every row. */}
        {average > 0 && (
          <div
            style={{
              position: "absolute",
              top: -18,
              bottom: 0,
              left: NAME_WIDTH,
              right: VALUE_WIDTH,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: percent(average),
                top: 0,
                bottom: 0,
                borderLeft: `2px dashed ${INK.secondary}`,
              }}
            >
              <Typography.Text
                style={{
                  position: "absolute",
                  top: -2,
                  left: 4,
                  fontSize: 12,
                  color: INK.secondary,
                  whiteSpace: "nowrap",
                }}
              >
                Average {average.toFixed(1)}
              </Typography.Text>
            </div>
          </div>
        )}
        <div style={{ paddingTop: 18 }}>
          {teachers.map((teacher) => (
            <Tooltip
              key={teacher.id}
              title={tooltipFor(teacher, capacity)}
              placement="topLeft"
            >
              <Flex
                align="center"
                style={{ height: ROW_HEIGHT, cursor: "default" }}
              >
                <Typography.Text
                  ellipsis
                  style={{ width: NAME_WIDTH, paddingRight: 8, flexShrink: 0 }}
                >
                  {teacher.name}
                </Typography.Text>
                <Flex
                  style={{
                    flex: 1,
                    height: BAR_HEIGHT,
                    borderLeft: `1px solid ${INK.baseline}`,
                  }}
                >
                  {teacher.weekday > 0 && (
                    <div
                      style={{
                        width: percent(teacher.weekday),
                        background: SERIES.weekday.color,
                        borderRadius: teacher.weekend > 0 ? 0 : "0 4px 4px 0",
                      }}
                    />
                  )}
                  {teacher.weekend > 0 && (
                    <div
                      style={{
                        width: percent(teacher.weekend),
                        background: SERIES.weekend.color,
                        borderRadius: "0 4px 4px 0",
                        // A surface gap separates the two segments.
                        borderLeft:
                          teacher.weekday > 0
                            ? `2px solid ${INK.surface}`
                            : undefined,
                      }}
                    />
                  )}
                </Flex>
                <Flex
                  gap="small"
                  align="center"
                  style={{ width: VALUE_WIDTH, paddingLeft: 8, flexShrink: 0 }}
                >
                  <Typography.Text strong style={{ width: 24 }}>
                    {teacher.total}
                  </Typography.Text>
                  <LoadStatus status={teacher.status} />
                </Flex>
              </Flex>
            </Tooltip>
          ))}
        </div>
      </div>
    </Flex>
  );
}

export default LoadChart;
