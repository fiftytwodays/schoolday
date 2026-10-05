import { LOAD_STATUS_LABELS } from "./compute-workload";

const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0EFEC" },
};

// Bold header, frozen, with filters; bold totals rows; sensible widths.
const formatSheet = (sheet, boldRows = []) => {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
  boldRows.forEach((row) => {
    row.font = { bold: true };
  });
};

const addSummarySheet = (workbook, workload, teachers) => {
  const sheet = workbook.addWorksheet("Summary");
  sheet.columns = [
    { header: "Teacher", key: "name", width: 24 },
    { header: "Subjects", key: "subjects", width: 28 },
    { header: "Classes", key: "classes", width: 22 },
    { header: "Weekday periods", key: "weekday", width: 16 },
    { header: "Weekend periods", key: "weekend", width: 16 },
    { header: "Total periods", key: "total", width: 14 },
    { header: "Hours per week", key: "hours", width: 15, style: { numFmt: "0.0" } },
    { header: "Free periods", key: "free", width: 13 },
    { header: "Load", key: "loadShare", width: 9, style: { numFmt: "0%" } },
    { header: "Busiest day", key: "busiestDay", width: 16 },
    { header: "Load status", key: "status", width: 13 },
  ];
  teachers.forEach((teacher) =>
    sheet.addRow({
      ...teacher,
      subjects: teacher.subjects.join(", "),
      classes: teacher.classes.join(", "),
      busiestDay: teacher.busiestDay
        ? `${teacher.busiestDay.name} (${teacher.busiestDay.count})`
        : "",
      status: LOAD_STATUS_LABELS[teacher.status],
    })
  );
  const sum = (field) =>
    teachers.reduce((total, teacher) => total + teacher[field], 0);
  const totals = sheet.addRow({
    name: "Total",
    weekday: sum("weekday"),
    weekend: sum("weekend"),
    total: sum("total"),
    hours: sum("hours"),
  });
  sheet.addRow({});
  sheet.addRow({
    name: "School average (teachers with periods)",
    total: Number(workload.average.toFixed(1)),
    hours: workload.averageHours,
  });
  sheet.addRow({
    name: "Capacity per teacher",
    total: workload.capacity,
    hours: workload.capacityHours,
  });
  formatSheet(sheet, [totals]);
};

const addDetailSheet = (workbook, teachers) => {
  const sheet = workbook.addWorksheet("Detail");
  sheet.columns = [
    { header: "Teacher", key: "teacher", width: 24 },
    { header: "Subject", key: "subject", width: 22 },
    { header: "Class", key: "className", width: 14 },
    { header: "Weekday periods", key: "weekday", width: 16 },
    { header: "Weekend periods", key: "weekend", width: 16 },
    { header: "Total periods", key: "total", width: 14 },
    { header: "Hours per week", key: "hours", width: 15, style: { numFmt: "0.0" } },
  ];
  const subtotals = [];
  teachers
    .filter((teacher) => teacher.total > 0)
    .forEach((teacher) => {
      teacher.breakdown.forEach((row) =>
        sheet.addRow({ ...row, teacher: teacher.name })
      );
      subtotals.push(
        sheet.addRow({
          teacher: `${teacher.name} total`,
          weekday: teacher.weekday,
          weekend: teacher.weekend,
          total: teacher.total,
          hours: teacher.hours,
        })
      );
    });
  formatSheet(sheet, subtotals);
};

const addByDaySheet = (workbook, workload, teachers) => {
  const sheet = workbook.addWorksheet("By day");
  sheet.columns = [
    { header: "Teacher", key: "name", width: 24 },
    ...workload.days.map((day) => ({ header: day, key: day, width: 12 })),
    { header: "Total", key: "total", width: 10 },
  ];
  teachers.forEach((teacher) =>
    sheet.addRow({ name: teacher.name, ...teacher.perDay, total: teacher.total })
  );
  formatSheet(sheet);
};

/** The workbook: Summary, Detail and By day sheets for `teachers`. */
export const buildWorkloadWorkbook = (ExcelJS, workload, teachers) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SchoolDay";
  workbook.created = new Date();

  addSummarySheet(workbook, workload, teachers);
  addDetailSheet(workbook, teachers);
  addByDaySheet(workbook, workload, teachers);
  return workbook;
};

/**
 * Downloads the workload of `teachers` (the ones shown) as an Excel file.
 * The library loads on first use.
 */
export const downloadWorkloadExcel = async (workload, teachers, fileDate) => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = buildWorkloadWorkbook(ExcelJS, workload, teachers);

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `Teacher workload ${fileDate}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
