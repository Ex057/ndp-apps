import React from "react";
import type { TableProps } from "antd";
import ExcelJS, { Alignment } from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ExportRow = Record<string, unknown>;

type LeafColumn = {
    key: string;
    title: string;
    width?: number;
    align?: "left" | "center" | "right";
    render?: (
        value: unknown,
        record: ExportRow,
        index: number,
    ) => React.ReactNode;
};

function flattenColumns(columns: TableProps<ExportRow>["columns"]): LeafColumn[] {
    const result: LeafColumn[] = [];

    const visit = (items: NonNullable<TableProps<ExportRow>["columns"]>) => {
        items.forEach((column) => {
            if (!column) return;
            if ("children" in column && Array.isArray(column.children)) {
                visit(column.children as NonNullable<TableProps<ExportRow>["columns"]>);
                return;
            }

            const key = String(column.dataIndex ?? column.key ?? "");
            if (!key) return;
            result.push({
                key,
                title: textFromReactNode(column.title),
                width: typeof column.width === "number" ? column.width : undefined,
                align: column.align as LeafColumn["align"],
                render:
                    typeof column.render === "function"
                        ? (value, record, index) =>
                              column.render?.(
                                  value,
                                  record as never,
                                  index,
                              ) ?? null
                        : undefined,
            });
        });
    };

    visit(columns ?? []);
    return result;
}

function textFromReactNode(value: React.ReactNode): string {
    if (value === null || value === undefined || typeof value === "boolean") {
        return "";
    }
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(textFromReactNode).join("");
    }
    if (React.isValidElement(value)) {
        const props = value.props as { children?: React.ReactNode };
        return textFromReactNode(props.children);
    }
    return "";
}

function getCellText(
    column: LeafColumn,
    record: ExportRow,
    rowIndex: number,
): string {
    const rawValue = record[column.key];
    if (column.render) {
        return textFromReactNode(column.render(rawValue, record, rowIndex));
    }
    return textFromReactNode(rawValue as React.ReactNode);
}

function mapExcelAlignment(
    align?: LeafColumn["align"],
): Partial<Alignment>["horizontal"] {
    if (align === "center" || align === "right") return align;
    return "left";
}

function makeTimestampedReportFilename(extension: "pdf" | "xlsx") {
    return `${new Date().toISOString()}-report.${extension}`;
}

export async function exportTrackerTableToExcel({
    columns,
    rows,
    title,
    subtitle,
    sheetName,
}: {
    columns: TableProps<ExportRow>["columns"];
    rows: ExportRow[];
    title: string;
    subtitle?: string;
    sheetName: string;
}) {
    const leafColumns = flattenColumns(columns);
    if (leafColumns.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = {
        bold: true,
        size: 14,
        color: { argb: "FFFFFFFF" },
    };
    titleRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF365F91" },
    };
    titleRow.getCell(1).alignment = {
        horizontal: "left",
        vertical: "middle",
    };
    titleRow.height = 22;

    worksheet.mergeCells(1, 1, 1, Math.max(1, leafColumns.length));

    if (subtitle) {
        const subtitleRow = worksheet.getRow(2);
        subtitleRow.getCell(1).value = subtitle;
        subtitleRow.getCell(1).font = {
            italic: true,
            size: 10,
            color: { argb: "FF2F3D4C" },
        };
        subtitleRow.getCell(1).alignment = {
            horizontal: "left",
            vertical: "middle",
            wrapText: true,
        };
        subtitleRow.height = 18;
        worksheet.mergeCells(2, 1, 2, Math.max(1, leafColumns.length));
    }

    const headerRowIndex = subtitle ? 4 : 3;
    const headerRow = worksheet.getRow(headerRowIndex);

    leafColumns.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.title;
        cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF365F91" },
        };
        cell.alignment = {
            horizontal: mapExcelAlignment(column.align),
            vertical: "middle",
            wrapText: true,
        };
        cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        };
        worksheet.getColumn(index + 1).width = Math.max(
            14,
            Math.min(42, Math.round((column.width ?? 140) / 7)),
        );
    });
    headerRow.height = 24;

    rows.forEach((record, rowIndex) => {
        const excelRow = worksheet.getRow(headerRowIndex + 1 + rowIndex);
        leafColumns.forEach((column, columnIndex) => {
            const cell = excelRow.getCell(columnIndex + 1);
            cell.value = getCellText(column, record, rowIndex);
            cell.alignment = {
                horizontal: mapExcelAlignment(column.align),
                vertical: "top",
                wrapText: true,
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });
    });

    worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, makeTimestampedReportFilename("xlsx"));
}

export function exportTrackerTableToPdf({
    columns,
    rows,
    title,
    subtitle,
}: {
    columns: TableProps<ExportRow>["columns"];
    rows: ExportRow[];
    title: string;
    subtitle?: string;
}) {
    const leafColumns = flattenColumns(columns);
    if (leafColumns.length === 0) return;

    const doc = new jsPDF({ orientation: "landscape" });
    const body = rows.map((record, rowIndex) =>
        leafColumns.map((column) => getCellText(column, record, rowIndex)),
    );

    doc.setFontSize(14);
    doc.text(title, 14, 14);
    if (subtitle) {
        doc.setFontSize(9);
        doc.text(subtitle, 14, 21);
    }

    const marginLeft = 14;
    const marginRight = 14;
    const availableWidth =
        doc.internal.pageSize.getWidth() - marginLeft - marginRight;
    const requestedWidths = leafColumns.map((column) =>
        Math.max(16, Math.min(44, (column.width ?? 140) / 7)),
    );
    const totalRequestedWidth = requestedWidths.reduce(
        (sum, width) => sum + width,
        0,
    );
    const widthRatio =
        totalRequestedWidth > availableWidth
            ? availableWidth / totalRequestedWidth
            : 1;

    const columnStyles = requestedWidths.reduce<Record<number, { cellWidth: number; halign: "left" | "center" | "right" }>>(
        (styles, width, index) => {
            styles[index] = {
                cellWidth: Math.max(12, Number((width * widthRatio).toFixed(2))),
                halign:
                    leafColumns[index].align === "center" ||
                    leafColumns[index].align === "right"
                        ? leafColumns[index].align
                        : "left",
            };
            return styles;
        },
        {},
    );

    autoTable(doc, {
        head: [leafColumns.map((column) => column.title)],
        body,
        startY: subtitle ? 26 : 19,
        margin: { left: marginLeft, right: marginRight },
        theme: "grid",
        tableWidth: availableWidth,
        styles: {
            fontSize: 8,
            cellPadding: 2,
            overflow: "linebreak",
            valign: "top",
        },
        headStyles: {
            fillColor: [54, 95, 145],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        columnStyles,
    });

    doc.save(makeTimestampedReportFilename("pdf"));
}
