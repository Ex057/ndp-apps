import ExcelJS, { Alignment } from "exceljs";
import { saveAs } from "file-saver";
import { TableProps } from "antd";

const hexToArgb = (hex?: string): string | undefined => {
    if (!hex || typeof hex !== "string") {
        return undefined;
    }

    const cleanHex = hex.replace("#", "").trim();
    if (!cleanHex) {
        return undefined;
    }

    const namedColors: Record<string, string> = {
        black: "FF000000",
        white: "FFFFFFFF",
        red: "FFFF0000",
        green: "FF008000",
        blue: "FF0000FF",
        yellow: "FFFFFF00",
        gray: "FF808080",
        grey: "FF808080",
    };

    const namedColor = namedColors[cleanHex.toLowerCase()];
    if (namedColor) {
        return namedColor;
    }

    return cleanHex.length === 6 ? `FF${cleanHex}` : cleanHex;
};

const expandHex = (hex?: string): string | undefined => {
    if (!hex || typeof hex !== "string") {
        return undefined;
    }

    const cleanHex = hex.replace("#", "").trim();
    if (!cleanHex) {
        return undefined;
    }

    if (cleanHex.length === 3) {
        return cleanHex
            .split("")
            .map((char) => `${char}${char}`)
            .join("");
    }

    if (cleanHex.length === 8) {
        return cleanHex.slice(2);
    }

    return cleanHex.length === 6 ? cleanHex : undefined;
};

const getReadableFontColor = (backgroundHex?: string): string | undefined => {
    const expandedHex = expandHex(backgroundHex);
    if (!expandedHex) {
        return undefined;
    }

    const red = parseInt(expandedHex.slice(0, 2), 16);
    const green = parseInt(expandedHex.slice(2, 4), 16);
    const blue = parseInt(expandedHex.slice(4, 6), 16);

    if ([red, green, blue].some((value) => Number.isNaN(value))) {
        return undefined;
    }

    const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
    return luminance > 0.6 ? "FF000000" : "FFFFFFFF";
};

const extractHeaderColor = (column: any) => {
    if (column.onHeaderCell) {
        const headerStyle = column.onHeaderCell();
        if (headerStyle?.style) {
            return {
                bg: headerStyle.style.backgroundColor,
                fg: headerStyle.style.color,
            };
        }
    }
    return null;
};

const extractCellColor = (
    column: any,
    value: any,
    record: any,
    index: number,
) => {
    if (column.onCell) {
        const cellProps = column.onCell(record);
        if (cellProps?.style) {
            return {
                bg: cellProps.style.backgroundColor,
                fg: cellProps.style.color,
            };
        }
    }
    return null;
};

const flattenColumns = (columns: any[]): any[] => {
    const result: any[] = [];

    const traverse = (cols: any[]) => {
        cols.forEach((col) => {
            if (col.children && col.children.length > 0) {
                traverse(col.children);
            } else {
                result.push(col);
            }
        });
    };

    traverse(columns);
    return result;
};

const calculateHeaderDepth = (columns: any[]): number => {
    let maxDepth = 1;

    const traverse = (cols: any[], depth: number) => {
        cols.forEach((col) => {
            if (col.children && col.children.length > 0) {
                traverse(col.children, depth + 1);
            } else {
                maxDepth = Math.max(maxDepth, depth);
            }
        });
    };

    traverse(columns, 1);
    return maxDepth;
};

interface HeaderCell {
    title: string;
    colSpan: number;
    rowSpan: number;
    color: any;
    align?: string;
}

const buildHeaderGrid = (
    columns: any[],
    maxDepth: number,
): (HeaderCell | null)[][] => {
    const leafColumns = flattenColumns(columns);
    const totalCols = leafColumns.length;

    const grid: (HeaderCell | null)[][] = Array.from({ length: maxDepth }, () =>
        Array(totalCols).fill(null),
    );

    const traverse = (
        cols: any[],
        rowIndex: number,
        colOffset: number,
    ): number => {
        let currentCol = colOffset;

        cols.forEach((col) => {
            if (col.children && col.children.length > 0) {
                const childLeafCount = flattenColumns([col]).length;

                grid[rowIndex][currentCol] = {
                    title: col.title,
                    colSpan: childLeafCount,
                    rowSpan: 1,
                    color: extractHeaderColor(col),
                    align: col.align || "center",
                };

                for (
                    let c = currentCol + 1;
                    c < currentCol + childLeafCount;
                    c++
                ) {
                    grid[rowIndex][c] = {
                        title: "",
                        colSpan: 0,
                        rowSpan: 0,
                        color: null,
                    };
                }

                traverse(col.children, rowIndex + 1, currentCol);
                currentCol += childLeafCount;
            } else {
                const remainingRows = maxDepth - rowIndex;

                grid[rowIndex][currentCol] = {
                    title: col.title,
                    colSpan: 1,
                    rowSpan: remainingRows,
                    color: extractHeaderColor(col),
                    align: col.align || "center",
                };

                for (let r = rowIndex + 1; r < maxDepth; r++) {
                    grid[r][currentCol] = {
                        title: "",
                        colSpan: 0,
                        rowSpan: 0,
                        color: null,
                    };
                }

                currentCol++;
            }
        });

        return currentCol;
    };

    traverse(columns, 0, 0);
    return grid;
};

interface ExcelBuilderOptions {
    title?: string;
    sheetName?: string;
}

const sanitizeWorksheetName = (sheetName?: string): string => {
    const fallbackName = "Data";

    if (!sheetName) {
        return fallbackName;
    }

    // Excel worksheet names cannot exceed 31 chars or contain these characters.
    const sanitized = sheetName
        .replace(/[\[\]\:\*\?\/\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^'+|'+$/g, "");

    const normalized = sanitized || fallbackName;
    return normalized.slice(0, 31);
};

export class ExcelBuilder {
    private workbook: ExcelJS.Workbook;
    private worksheet: ExcelJS.Worksheet;
    private currentRow: number;
    private maxColumns: number;

    constructor(options: ExcelBuilderOptions = {}) {
        this.workbook = new ExcelJS.Workbook();
        this.worksheet = this.workbook.addWorksheet(
            sanitizeWorksheetName(options.sheetName),
        );
        this.currentRow = 1;
        this.maxColumns = 1;

        // Add document title if provided
        if (options.title) {
            this.addTitle(options.title, 1);
            this.addSpacer(1);
        }
    }

    /**
     * Add a title row to the Excel sheet
     */
    addTitle(text: string, level: 1 | 2 | 3 | 4 = 2): this {
        const row = this.worksheet.getRow(this.currentRow);

        // Update max columns if needed
        this.maxColumns = Math.max(this.maxColumns, 1);

        // Set the title in the first cell
        const cell = row.getCell(1);
        cell.value = text;

        // Style based on level
        const styles = {
            1: { fontSize: 16, fillColor: "FFD9D9D9", textColor: "FF000000" },
            2: { fontSize: 14, fillColor: "FFE6E6E6", textColor: "FF000000" },
            3: { fontSize: 12, fillColor: "FFF0F0F0", textColor: "FF000000" },
            4: { fontSize: 11, fillColor: "FFF7F7F7", textColor: "FF000000" },
        };

        const style = styles[level];

        cell.font = {
            bold: true,
            size: style.fontSize,
            color: { argb: style.textColor },
        };

        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: style.fillColor },
        };

        cell.alignment = {
            vertical: "middle",
            horizontal: "left",
        };

        row.height = level === 1 ? 25 : level === 2 ? 22 : 18;

        this.currentRow++;
        return this;
    }

    /**
     * Add a text row to the Excel sheet
     */
    addText(text: string, options: { italic?: boolean } = {}): this {
        const row = this.worksheet.getRow(this.currentRow);

        const cell = row.getCell(1);
        cell.value = text;

        cell.font = {
            italic: options.italic ?? true,
            size: 10,
        };

        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
        };

        cell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
        };

        row.height = 20;

        this.currentRow++;
        return this;
    }

    /**
     * Add a table to the Excel sheet
     */
    addTable(
        columns: TableProps<any>["columns"],
        data: any[],
        title?: string,
    ): this {
        if (!columns) return this;

        // Add table title if provided
        if (title) {
            this.addTitle(title, 3);
        }

        const leafColumns = flattenColumns(columns);
        const headerDepth = calculateHeaderDepth(columns);
        const headerGrid = buildHeaderGrid(columns, headerDepth);

        // Update max columns
        this.maxColumns = Math.max(this.maxColumns, leafColumns.length);

        // Set up columns based on leaf columns
        const excelColumns = leafColumns.map((col: any) => {
            const width = typeof col.width === "number" ? col.width / 8 : 15;
            return {
                header: "",
                key: col.dataIndex || col.key,
                width: width,
                render: col.render,
                align: col.align,
                onCell: col.onCell,
            };
        });

        // Update worksheet columns
        this.worksheet.columns = excelColumns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width,
        }));

        // Process the header grid and create headers with merges
        const mergeRanges: Array<{
            startRow: number;
            startCol: number;
            endRow: number;
            endCol: number;
        }> = [];

        const headerStartRow = this.currentRow;

        headerGrid.forEach((row, rowIndex) => {
            const excelRow = this.worksheet.getRow(
                headerStartRow + rowIndex,
            );

            row.forEach((cell, colIndex) => {
                if (cell === null || cell.colSpan === 0) {
                    return;
                }

                const excelCell = excelRow.getCell(colIndex + 1);
                excelCell.value = cell.title;
                excelCell.font = { bold: true };
                excelCell.alignment = {
                    vertical: "middle",
                    horizontal: (cell.align || "center") as Alignment["horizontal"],
                    wrapText: false,
                };

                // Apply color if exists
                if (cell.color) {
                    const backgroundColor = hexToArgb(cell.color.bg);
                    const fontColor = hexToArgb(cell.color.fg);

                    if (backgroundColor) {
                        excelCell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: backgroundColor },
                        };
                    }

                    const resolvedFontColor =
                        fontColor || getReadableFontColor(cell.color.bg);

                    if (resolvedFontColor) {
                        excelCell.font = {
                            ...excelCell.font,
                            color: { argb: resolvedFontColor },
                        };
                    }
                }

                // Record merge ranges
                const startRow = headerStartRow + rowIndex;
                const startCol = colIndex + 1;
                const endRow = startRow + cell.rowSpan - 1;
                const endCol = startCol + cell.colSpan - 1;

                if (endRow > startRow || endCol > startCol) {
                    mergeRanges.push({ startRow, startCol, endRow, endCol });
                }
            });
        });

        // Apply all merges
        mergeRanges.forEach((range) => {
            this.worksheet.mergeCells(
                range.startRow,
                range.startCol,
                range.endRow,
                range.endCol,
            );
        });

        // Update current row to after headers
        this.currentRow = headerStartRow + headerDepth;

        // Add data rows
        data.forEach((record, recordIndex) => {
            const rowData: any = {};

            excelColumns.forEach((col) => {
                const value = record[col.key];

                if (col.render && typeof col.render === "function") {
                    try {
                        const rendered = col.render(value, record, recordIndex);
                        rowData[col.key] =
                            typeof rendered === "string" ? rendered : value;
                    } catch {
                        rowData[col.key] = value;
                    }
                } else {
                    rowData[col.key] = value ?? "";
                }
            });

            const row = this.worksheet.addRow(rowData);

            // Apply alignment and colors to data cells
            excelColumns.forEach((col, index) => {
                const cell = row.getCell(index + 1);
                const value = record[col.key];

                // Apply alignment
                if (col.align) {
                    cell.alignment = {
                        horizontal: col.align as any,
                        vertical: "middle",
                    };
                }

                // Extract and apply cell color from onCell function
                if (col.onCell) {
                    const cellColor = extractCellColor(
                        col,
                        value,
                        record,
                        recordIndex,
                    );
                    if (cellColor) {
                        const backgroundColor = hexToArgb(cellColor.bg);
                        const fontColor = hexToArgb(cellColor.fg);

                        if (backgroundColor) {
                            cell.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: backgroundColor },
                            };
                        }
                        const resolvedFontColor =
                            fontColor || getReadableFontColor(cellColor.bg);

                        if (resolvedFontColor) {
                            cell.font = {
                                color: { argb: resolvedFontColor },
                            };
                        }
                    }
                }
            });

            this.currentRow++;
        });

        // Add borders to all table cells
        for (let r = headerStartRow; r < this.currentRow; r++) {
            const row = this.worksheet.getRow(r);
            for (let c = 1; c <= leafColumns.length; c++) {
                const cell = row.getCell(c);
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            }
        }

        return this;
    }

    /**
     * Add a table with comment rows to the Excel sheet
     */
    addTableWithComments(
        columns: TableProps<any>["columns"],
        data: any[],
        commentExtractor: (record: any) => string | null,
        title?: string,
    ): this {
        if (!columns) return this;

        // Add table title if provided
        if (title) {
            this.addTitle(title, 3);
        }

        const leafColumns = flattenColumns(columns);
        const headerDepth = calculateHeaderDepth(columns);
        const headerGrid = buildHeaderGrid(columns, headerDepth);

        // Update max columns
        this.maxColumns = Math.max(this.maxColumns, leafColumns.length);

        // Set up columns based on leaf columns
        const excelColumns = leafColumns.map((col: any) => {
            const width = typeof col.width === "number" ? col.width / 8 : 15;
            return {
                header: "",
                key: col.dataIndex || col.key,
                width: width,
                render: col.render,
                align: col.align,
                onCell: col.onCell,
            };
        });

        // Update worksheet columns
        this.worksheet.columns = excelColumns.map((col) => ({
            header: col.header,
            key: col.key,
            width: col.width,
        }));

        // Process the header grid and create headers with merges
        const mergeRanges: Array<{
            startRow: number;
            startCol: number;
            endRow: number;
            endCol: number;
        }> = [];

        const headerStartRow = this.currentRow;

        headerGrid.forEach((row, rowIndex) => {
            const excelRow = this.worksheet.getRow(
                headerStartRow + rowIndex,
            );

            row.forEach((cell, colIndex) => {
                if (cell === null || cell.colSpan === 0) {
                    return;
                }

                const excelCell = excelRow.getCell(colIndex + 1);
                excelCell.value = cell.title;
                excelCell.font = { bold: true };
                excelCell.alignment = {
                    vertical: "middle",
                    horizontal: (cell.align || "center") as Alignment["horizontal"],
                    wrapText: false,
                };

                // Apply color if exists
                if (cell.color) {
                    const backgroundColor = hexToArgb(cell.color.bg);
                    const fontColor = hexToArgb(cell.color.fg);

                    if (backgroundColor) {
                        excelCell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: backgroundColor },
                        };
                    }

                    const resolvedFontColor =
                        fontColor || getReadableFontColor(cell.color.bg);

                    if (resolvedFontColor) {
                        excelCell.font = {
                            ...excelCell.font,
                            color: { argb: resolvedFontColor },
                        };
                    }
                }

                // Record merge ranges
                const startRow = headerStartRow + rowIndex;
                const startCol = colIndex + 1;
                const endRow = startRow + cell.rowSpan - 1;
                const endCol = startCol + cell.colSpan - 1;

                if (endRow > startRow || endCol > startCol) {
                    mergeRanges.push({ startRow, startCol, endRow, endCol });
                }
            });
        });

        // Apply all merges
        mergeRanges.forEach((range) => {
            this.worksheet.mergeCells(
                range.startRow,
                range.startCol,
                range.endRow,
                range.endCol,
            );
        });

        // Update current row to after headers
        this.currentRow = headerStartRow + headerDepth;

        // Add data rows with comments
        data.forEach((record, recordIndex) => {
            const rowData: any = {};

            excelColumns.forEach((col) => {
                const value = record[col.key];

                if (col.render && typeof col.render === "function") {
                    try {
                        const rendered = col.render(value, record, recordIndex);
                        rowData[col.key] =
                            typeof rendered === "string" ? rendered : value;
                    } catch {
                        rowData[col.key] = value;
                    }
                } else {
                    rowData[col.key] = value ?? "";
                }
            });

            const row = this.worksheet.addRow(rowData);

            // Apply alignment and colors to data cells
            excelColumns.forEach((col, index) => {
                const cell = row.getCell(index + 1);
                const value = record[col.key];

                // Apply alignment
                if (col.align) {
                    cell.alignment = {
                        horizontal: col.align as any,
                        vertical: "middle",
                    };
                }

                // Extract and apply cell color from onCell function
                if (col.onCell) {
                    const cellColor = extractCellColor(
                        col,
                        value,
                        record,
                        recordIndex,
                    );
                    if (cellColor) {
                        const backgroundColor = hexToArgb(cellColor.bg);
                        const fontColor = hexToArgb(cellColor.fg);

                        if (backgroundColor) {
                            cell.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: backgroundColor },
                            };
                        }
                        const resolvedFontColor =
                            fontColor || getReadableFontColor(cellColor.bg);

                        if (resolvedFontColor) {
                            cell.font = {
                                color: { argb: resolvedFontColor },
                            };
                        }
                    }
                }

                // Add border
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            this.currentRow++;

            // Add comment row if comments exist
            const comments = commentExtractor(record);
            if (comments) {
                const commentRow = this.worksheet.addRow([comments]);
                const commentCell = commentRow.getCell(1);

                // Merge all columns for comment
                this.worksheet.mergeCells(
                    this.currentRow,
                    1,
                    this.currentRow,
                    leafColumns.length,
                );

                // Style comment cell
                commentCell.font = { italic: true, size: 9 };
                commentCell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF5F5F5" },
                };
                commentCell.alignment = {
                    vertical: "middle",
                    horizontal: "left",
                    wrapText: true,
                };

                // Add border
                for (let c = 1; c <= leafColumns.length; c++) {
                    const cell = commentRow.getCell(c);
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" },
                    };
                }

                this.currentRow++;
            }
        });

        return this;
    }

    /**
     * Add blank rows (spacer)
     */
    addSpacer(rows: number = 2): this {
        this.currentRow += rows;
        return this;
    }

    /**
     * Merge title/text cells across all columns
     */
    private mergeTitleRow(rowNumber: number): void {
        if (this.maxColumns > 1) {
            try {
                this.worksheet.mergeCells(rowNumber, 1, rowNumber, this.maxColumns);
            } catch (e) {
                // Merging might fail if not enough columns yet
            }
        }
    }

    /**
     * Update merged cells for titles after tables are added
     */
    private updateMergedTitles(): void {
        // Go through all rows and merge title/text rows
        for (let r = 1; r < this.currentRow; r++) {
            const row = this.worksheet.getRow(r);
            const firstCell = row.getCell(1);

            // Check if this is a title or text row (has fill color and only first cell has value)
            if (firstCell.fill && firstCell.value) {
                const hasOtherValues = Array.from(
                    { length: this.maxColumns },
                    (_, i) => i + 2,
                ).some((colNum) => {
                    const cell = row.getCell(colNum);
                    return cell.value !== null && cell.value !== undefined;
                });

                if (!hasOtherValues) {
                    this.mergeTitleRow(r);
                }
            }
        }
    }

    /**
     * Download the generated Excel file
     */
    async download(filename: string = "export.xlsx"): Promise<void> {
        // Update merged titles before download
        this.updateMergedTitles();

        const buffer = await this.workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(blob, filename);
    }
}
