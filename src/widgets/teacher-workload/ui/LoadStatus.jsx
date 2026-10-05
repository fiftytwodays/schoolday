import { Space } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  MinusCircleOutlined,
} from "@ant-design/icons";

import { LOAD_STATUS_LABELS } from "@/entities/workload/lib/compute-workload";
import { STATUS_COLORS } from "./chart-theme";

const ICONS = {
  OVER: ArrowUpOutlined,
  BALANCED: CheckCircleFilled,
  UNDER: ArrowDownOutlined,
  NONE: MinusCircleOutlined,
};

/** A teacher's load against the school average: icon plus label. */
function LoadStatus({ status }) {
  const Icon = ICONS[status];
  return (
    <Space size={4}>
      <Icon style={{ color: STATUS_COLORS[status] }} />
      <span>{LOAD_STATUS_LABELS[status]}</span>
    </Space>
  );
}

export default LoadStatus;
