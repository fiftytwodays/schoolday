import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  List,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import useSWR from "swr";

import { getWorkload } from "@/entities/workload/api/get-workload";
import { LOAD_STATUS_LABELS } from "@/entities/workload/lib/compute-workload";
import { downloadWorkloadExcel } from "@/entities/workload/lib/export-workload";
import { todayInSchool } from "@/shared/lib/checklist-rules";
import DayHeatmap from "./DayHeatmap";
import LoadChart from "./LoadChart";
import LoadStatus from "./LoadStatus";
import { formatHours } from "./chart-theme";

const STATUSES = ["OVER", "BALANCED", "UNDER", "NONE"];

const toOptions = (values) =>
  values.map((value) => ({ value, label: value }));

const breakdownColumns = [
  { title: "Subject", dataIndex: "subject" },
  { title: "Class", dataIndex: "className" },
  { title: "Weekday", dataIndex: "weekday", align: "right", width: 100 },
  { title: "Weekend", dataIndex: "weekend", align: "right", width: 100 },
  { title: "Total", dataIndex: "total", align: "right", width: 90 },
  {
    title: "Hours",
    dataIndex: "hours",
    align: "right",
    width: 90,
    render: formatHours,
  },
];

function TeacherWorkload() {
  const { data: workload, error, isLoading } = useSWR(
    ["/api/teacher-workload"],
    getWorkload
  );
  const [teacherFilter, setTeacherFilter] = useState(null);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [classFilter, setClassFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isExporting, setIsExporting] = useState(false);

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Could not load the timetable"
        description={error.message}
      />
    );
  }
  if (isLoading || !workload) {
    return <Skeleton active />;
  }

  const allTeachers = workload.teachers;
  const matchesFilters = (teacher) =>
    (!teacherFilter || teacher.id === teacherFilter) &&
    (!subjectFilter || teacher.subjects.includes(subjectFilter)) &&
    (!classFilter || teacher.classes.includes(classFilter));
  const filtered = allTeachers.filter(matchesFilters);
  const counts = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      filtered.filter((teacher) => teacher.status === status).length,
    ])
  );
  const shownStatus =
    statusFilter !== "ALL" && !counts[statusFilter] ? "ALL" : statusFilter;
  const teachers =
    shownStatus === "ALL"
      ? filtered
      : filtered.filter((teacher) => teacher.status === shownStatus);
  const teaching = teachers.filter((teacher) => teacher.total > 0);

  const onDownload = async () => {
    setIsExporting(true);
    try {
      await downloadWorkloadExcel(workload, teachers, todayInSchool());
    } catch (exportError) {
      message.error(`Could not create the Excel file. ${exportError.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    {
      title: "Teacher",
      dataIndex: "name",
      fixed: "left",
      width: 170,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Subjects",
      key: "subjects",
      width: 180,
      render: (_, teacher) => teacher.subjects.join(", ") || "---",
    },
    {
      title: "Classes",
      key: "classes",
      width: 150,
      render: (_, teacher) => teacher.classes.join(", ") || "---",
    },
    {
      title: "Weekday",
      dataIndex: "weekday",
      align: "right",
      width: 95,
      sorter: (a, b) => a.weekday - b.weekday,
    },
    {
      title: "Weekend",
      dataIndex: "weekend",
      align: "right",
      width: 95,
      sorter: (a, b) => a.weekend - b.weekend,
    },
    {
      title: "Total",
      dataIndex: "total",
      align: "right",
      width: 85,
      sorter: (a, b) => a.total - b.total,
      defaultSortOrder: "descend",
    },
    {
      title: "Hours",
      dataIndex: "hours",
      align: "right",
      width: 85,
      render: formatHours,
      sorter: (a, b) => a.hours - b.hours,
    },
    {
      title: "Free",
      dataIndex: "free",
      align: "right",
      width: 80,
      sorter: (a, b) => a.free - b.free,
    },
    {
      title: "Load",
      dataIndex: "loadShare",
      align: "right",
      width: 80,
      render: (share) => `${Math.round(share * 100)}%`,
    },
    {
      title: "Busiest day",
      key: "busiestDay",
      width: 130,
      render: (_, teacher) =>
        teacher.busiestDay
          ? `${teacher.busiestDay.name.slice(0, 3)} (${teacher.busiestDay.count})`
          : "---",
    },
    {
      title: "Load status",
      dataIndex: "status",
      width: 130,
      render: (status) => <LoadStatus status={status} />,
    },
  ];

  const sum = (field) =>
    teachers.reduce((total, teacher) => total + teacher[field], 0);

  const subjectOptions = toOptions(
    [...new Set(allTeachers.flatMap((teacher) => teacher.subjects))].sort()
  );
  const classOptions = toOptions(
    [...new Set(allTeachers.flatMap((teacher) => teacher.classes))].sort()
  );

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Space wrap>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All teachers"
            style={{ minWidth: 180 }}
            value={teacherFilter}
            onChange={setTeacherFilter}
            options={allTeachers
              .map((teacher) => ({ value: teacher.id, label: teacher.name }))
              .sort((a, b) => a.label.localeCompare(b.label))}
          />
          <Select
            allowClear
            showSearch
            placeholder="All subjects"
            style={{ minWidth: 160 }}
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={subjectOptions}
          />
          <Select
            allowClear
            showSearch
            placeholder="All classes"
            style={{ minWidth: 140 }}
            value={classFilter}
            onChange={setClassFilter}
            options={classOptions}
          />
        </Space>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={isExporting}
          disabled={teachers.length === 0}
          onClick={onDownload}
        >
          Download Excel
        </Button>
      </Flex>

      <Flex vertical gap={4}>
        <Typography.Text>
          School average:{" "}
          <strong>{workload.average.toFixed(1)} periods</strong> (
          {formatHours(Number(workload.averageHours.toFixed(1)))} h) per week,
          for teachers with periods. Each teacher can teach up to{" "}
          {workload.capacity} periods ({formatHours(workload.capacityHours)} h):{" "}
          {workload.days.length} days × {workload.periodsPerDay} lessons.
        </Typography.Text>
        <Typography.Text type="secondary">
          Over and Under mean more than 20% above or below the average.
          Weekend is Saturday and Sunday.
        </Typography.Text>
      </Flex>

      <Segmented
        value={shownStatus}
        onChange={setStatusFilter}
        options={[
          { value: "ALL", label: `All (${filtered.length})` },
          ...STATUSES.filter((status) => counts[status] > 0).map((status) => ({
            value: status,
            label: `${LOAD_STATUS_LABELS[status]} (${counts[status]})`,
          })),
        ]}
      />

      <Card title="Load per teacher" size="small">
        {teaching.length > 0 ? (
          <LoadChart
            teachers={teaching}
            average={workload.average}
            capacity={workload.capacity}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No periods in the timetable for these teachers"
          />
        )}
      </Card>

      <Card title="Teachers" size="small">
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={teachers}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          expandable={{
            rowExpandable: (teacher) => teacher.breakdown.length > 0,
            expandedRowRender: (teacher) => (
              <Table
                rowKey="key"
                size="small"
                columns={breakdownColumns}
                dataSource={teacher.breakdown}
                pagination={false}
              />
            ),
          }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} />
              <Table.Summary.Cell index={1}>
                <strong>Total</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} align="right">
                <strong>{sum("weekday")}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong>{sum("weekend")}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <strong>{sum("total")}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <strong>{formatHours(sum("hours"))}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} colSpan={4} />
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Card title="Periods per day" size="small">
        {teaching.length > 0 ? (
          <DayHeatmap
            teachers={teaching}
            days={workload.days}
            periodsPerDay={workload.periodsPerDay}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {workload.unscheduled.length > 0 && (
        <Card
          title={`Assigned but not in the timetable (${workload.unscheduled.length})`}
          size="small"
        >
          <Typography.Paragraph type="secondary">
            These teaching assignments have no lessons in the timetable yet, so
            they are not counted in anyone&apos;s load.
          </Typography.Paragraph>
          <List
            size="small"
            dataSource={workload.unscheduled}
            renderItem={(item) => (
              <List.Item>
                {item.teacherName} · {item.subject} · {item.className}
              </List.Item>
            )}
          />
        </Card>
      )}
    </Flex>
  );
}

export default TeacherWorkload;
