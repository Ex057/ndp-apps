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
    onCell?: (record: ExportRow) => { style?: Record<string, unknown> } | undefined;
    onHeaderCell?: () => { style?: Record<string, unknown> } | undefined;
    render?: (
        value: unknown,
        record: ExportRow,
        index: number,
    ) => React.ReactNode;
};

type ExportCellData = {
    text: string;
    style?: Record<string, unknown>;
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
                onCell:
                    typeof column.onCell === "function"
                        ? (record) => column.onCell?.(record as never)
                        : undefined,
                onHeaderCell:
                    typeof column.onHeaderCell === "function"
                        ? () => column.onHeaderCell?.()
                        : undefined,
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

function textAndStyleFromReactNode(value: React.ReactNode): ExportCellData {
    if (value === null || value === undefined || typeof value === "boolean") {
        return { text: "" };
    }
    if (typeof value === "string" || typeof value === "number") {
        return { text: String(value) };
    }
    if (Array.isArray(value)) {
        return {
            text: value.map((item) => textAndStyleFromReactNode(item).text).join(""),
        };
    }
    if (React.isValidElement(value)) {
        const props = value.props as {
            children?: React.ReactNode;
            style?: Record<string, unknown>;
        };
        const child = textAndStyleFromReactNode(props.children);
        return {
            text: child.text,
            style: props.style ?? child.style,
        };
    }
    return { text: "" };
}

function getCellData(
    column: LeafColumn,
    record: ExportRow,
    rowIndex: number,
): ExportCellData {
    const rawValue = record[column.key];
    if (column.render) {
        const rendered = column.render(rawValue, record, rowIndex);
        const extracted = textAndStyleFromReactNode(rendered);
        return {
            text: extracted.text,
            style:
                extracted.style ??
                column.onCell?.(record)?.style,
        };
    }
    return {
        text: textFromReactNode(rawValue as React.ReactNode),
        style: column.onCell?.(record)?.style,
    };
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

function normalizeHexColor(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        if (trimmed.length === 4) {
            return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
        }
        return trimmed;
    }
    const match = trimmed.match(
        /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
    );
    if (!match) return undefined;
    const [, r, g, b] = match;
    return `#${[r, g, b]
        .map((part) =>
            Number(part).toString(16).padStart(2, "0"),
        )
        .join("")}`;
}

function hexToArgb(hex: string): string {
    return `FF${hex.replace("#", "").toUpperCase()}`;
}

function hexToRgbTuple(hex: string): [number, number, number] {
    const normalized = hex.replace("#", "");
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
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
        const headerStyle = column.onHeaderCell?.()?.style;
        const headerBg = normalizeHexColor(headerStyle?.backgroundColor) ?? "#365F91";
        const headerFg = normalizeHexColor(headerStyle?.color) ?? "#FFFFFF";
        cell.font = {
            bold: true,
            color: { argb: hexToArgb(headerFg) },
        };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: hexToArgb(headerBg) },
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
            12,
            Math.min(60, Math.round((column.width ?? 160) / 7)),
        );
    });
    headerRow.height = 24;

    rows.forEach((record, rowIndex) => {
        const excelRow = worksheet.getRow(headerRowIndex + 1 + rowIndex);
        leafColumns.forEach((column, columnIndex) => {
            const cell = excelRow.getCell(columnIndex + 1);
            const exportCell = getCellData(column, record, rowIndex);
            cell.value = exportCell.text;
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
            const backgroundColor = normalizeHexColor(
                exportCell.style?.backgroundColor,
            );
            const textColor = normalizeHexColor(exportCell.style?.color);
            if (backgroundColor) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: hexToArgb(backgroundColor) },
                };
            }
            if (textColor) {
                cell.font = {
                    color: { argb: hexToArgb(textColor) },
                };
            }
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
        leafColumns.map((column) => getCellData(column, record, rowIndex).text),
    );

    doc.setFontSize(14);
    doc.text(title, 14, 14);
    if (subtitle) {
        doc.setFontSize(9);
        doc.text(subtitle, 14, 21);
    }

    const marginLeft = 8;
    const marginRight = 8;
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
        totalRequestedWidth > 0
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
            fillColor: [187, 209, 238],
            textColor: [37, 54, 74],
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        columnStyles,
        didParseCell: (hookData) => {
            if (hookData.section === "head") {
                const headerStyle =
                    leafColumns[hookData.column.index]?.onHeaderCell?.()?.style;
                const backgroundColor = normalizeHexColor(
                    headerStyle?.backgroundColor,
                );
                const textColor = normalizeHexColor(headerStyle?.color);
                if (backgroundColor) {
                    hookData.cell.styles.fillColor = hexToRgbTuple(backgroundColor);
                }
                if (textColor) {
                    hookData.cell.styles.textColor = hexToRgbTuple(textColor);
                }
                return;
            }

            if (hookData.section === "body") {
                const column = leafColumns[hookData.column.index];
                const record = rows[hookData.row.index];
                if (!column || !record) return;
                const exportCell = getCellData(column, record, hookData.row.index);
                const backgroundColor = normalizeHexColor(
                    exportCell.style?.backgroundColor,
                );
                const textColor = normalizeHexColor(exportCell.style?.color);
                if (backgroundColor) {
                    hookData.cell.styles.fillColor = hexToRgbTuple(backgroundColor);
                }
                if (textColor) {
                    hookData.cell.styles.textColor = hexToRgbTuple(textColor);
                }
            }
        },
    });

    doc.save(makeTimestampedReportFilename("pdf"));
}
