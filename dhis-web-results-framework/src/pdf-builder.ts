import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TableProps } from "antd";

// Import helper functions from existing PDF generator
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

const hexToRgb = (hex: string): [number, number, number] | null => {
    if (!hex || typeof hex !== "string") return null;

    const cleanHex = hex.replace("#", "").trim();

    if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
        console.warn(`Invalid hex color: ${hex}`);
        return null;
    }

    const fullHex =
        cleanHex.length === 3
            ? cleanHex
                  .split("")
                  .map((char) => char + char)
                  .join("")
            : cleanHex;

    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn(`Invalid RGB values from hex: ${hex}`);
        return null;
    }

    return [r, g, b];
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

const buildHeaderRows = (columns: any[], maxDepth: number) => {
    const headerRows: any[][] = Array.from({ length: maxDepth }, () => []);

    const traverse = (
        cols: any[],
        rowIndex: number,
        colOffset: number,
    ): number => {
        let currentCol = colOffset;

        cols.forEach((col) => {
            if (col.children && col.children.length > 0) {
                const childLeafCount = flattenColumns([col]).length;
                const color = extractHeaderColor(col);

                const cellStyle: any = {
                    halign: col.align || "center",
                    valign: "middle",
                    fontStyle: "bold",
                };

                if (color?.bg) {
                    const bgRgb = hexToRgb(color.bg);
                    if (bgRgb) cellStyle.fillColor = bgRgb;
                } else {
                    cellStyle.fillColor = [200, 200, 200];
                }

                if (color?.fg) {
                    const fgRgb = hexToRgb(color.fg);
                    if (fgRgb) cellStyle.textColor = fgRgb;
                } else {
                    cellStyle.textColor = [0, 0, 0];
                }

                headerRows[rowIndex].push({
                    content: col.title,
                    colSpan: childLeafCount,
                    rowSpan: 1,
                    styles: cellStyle,
                });

                traverse(col.children, rowIndex + 1, currentCol);
                currentCol += childLeafCount;
            } else {
                const remainingRows = maxDepth - rowIndex;
                const color = extractHeaderColor(col);

                const cellStyle: any = {
                    halign: col.align || "center",
                    valign: "middle",
                    fontStyle: "bold",
                };

                if (color?.bg) {
                    const bgRgb = hexToRgb(color.bg);
                    if (bgRgb) cellStyle.fillColor = bgRgb;
                } else {
                    cellStyle.fillColor = [200, 200, 200];
                }

                if (color?.fg) {
                    const fgRgb = hexToRgb(color.fg);
                    if (fgRgb) cellStyle.textColor = fgRgb;
                } else {
                    cellStyle.textColor = [0, 0, 0];
                }

                headerRows[rowIndex].push({
                    content: col.title,
                    colSpan: 1,
                    rowSpan: remainingRows,
                    styles: cellStyle,
                });

                currentCol++;
            }
        });

        return currentCol;
    };

    traverse(columns, 0, 0);
    return headerRows;
};

const buildColumnStyles = (
    doc: jsPDF,
    margin: number,
    leafColumns: any[],
) => {
    const columnStyles: Record<number, { cellWidth: number; halign: string }> = {};
    const tableWidth = doc.internal.pageSize.width - margin * 2;
    const fallbackWidth = 15;
    const requestedWidths = leafColumns.map((col: any) =>
        typeof col.width === "number" ? col.width / 10 : fallbackWidth,
    );
    const totalRequestedWidth = requestedWidths.reduce(
        (sum, width) => sum + width,
        0,
    );
    const widthScale =
        totalRequestedWidth > 0 ? tableWidth / totalRequestedWidth : 1;

    leafColumns.forEach((col: any, index: number) => {
        columnStyles[index] = {
            cellWidth: Math.max(
                8,
                Number((requestedWidths[index]! * widthScale).toFixed(2)),
            ),
            halign: col.align || "left",
        };
    });

    return columnStyles;
};

interface PDFBuilderOptions {
    orientation?: "portrait" | "landscape";
    title?: string;
    coverPage?: {
        image?: string; // base64 data URL or file path
        title?: string;
        voteName?: string;
        financialYear?: string;
    };
}

export class PDFBuilder {
    private doc: jsPDF;
    private currentY: number;
    private pageHeight: number;
    private margin: number;

    constructor(options: PDFBuilderOptions = {}) {
        this.doc = new jsPDF({
            orientation: options.orientation || "landscape",
            unit: "mm",
            format: "a4",
        });

        this.margin = 14;
        this.currentY = this.margin;
        this.pageHeight = this.doc.internal.pageSize.height - this.margin * 2;

        // Add cover page if provided
        if (options.coverPage) {
            this.addCoverPage(options.coverPage);
        }
        // Otherwise add document title if provided
        else if (options.title) {
            this.doc.setFontSize(16);
            this.doc.text(options.title, this.margin, this.currentY);
            this.currentY += 10;
        }
    }

    /**
     * Add a title to the PDF
     * Levels 1-2 automatically trigger page breaks
     */
    addTitle(text: string, level: 1 | 2 | 3 | 4 = 2): this {
        // Set font size based on level
        const fontSizes = { 1: 16, 2: 14, 3: 12, 4: 11 };
        this.doc.setFontSize(fontSizes[level]);
        this.doc.setFont("helvetica", "bold");

        // Check if we need a new page
        if (this.currentY + 10 > this.pageHeight) {
            this.doc.addPage();
            this.currentY = this.margin;
        }

        this.doc.text(text, this.margin, this.currentY);
        this.currentY += level === 1 ? 10 : level === 2 ? 8 : 6;

        // Reset to normal font
        this.doc.setFont("helvetica", "normal");

        return this;
    }

    /**
     * Add regular text to the PDF
     */
    addText(text: string, options: { italic?: boolean } = {}): this {
        this.doc.setFontSize(10);
        this.doc.setFont("helvetica", options.italic ? "italic" : "normal");

        // Check if we need a new page
        if (this.currentY + 8 > this.pageHeight) {
            this.doc.addPage();
            this.currentY = this.margin;
        }

        const splitText = this.doc.splitTextToSize(
            text,
            this.doc.internal.pageSize.width - this.margin * 2,
        );
        this.doc.text(splitText, this.margin, this.currentY);
        this.currentY += splitText.length * 5 + 5;

        // Reset to normal font
        this.doc.setFont("helvetica", "normal");

        return this;
    }

    /**
     * Add a centered cover page with image, title, vote name, and financial year
     */
    private addCoverPage(coverData: {
        image?: string;
        title?: string;
        voteName?: string;
        financialYear?: string;
    }): void {
        const pageWidth = this.doc.internal.pageSize.width;
        const pageHeight = this.doc.internal.pageSize.height;
        let yPosition = pageHeight / 4; // Start at 1/4 from top

        // Add image if provided
        if (coverData.image) {
            try {
                const imgWidth = 50; // Image width in mm
                const imgHeight = 50; // Image height in mm
                const imgX = (pageWidth - imgWidth) / 2; // Center horizontally

                this.doc.addImage(
                    coverData.image,
                    "PNG",
                    imgX,
                    yPosition,
                    imgWidth,
                    imgHeight,
                );
                yPosition += imgHeight + 15; // Add spacing after image
            } catch (error) {
                console.error("Failed to add image to PDF:", error);
            }
        }

        // Add title if provided
        if (coverData.title) {
            this.doc.setFontSize(20);
            this.doc.setFont("helvetica", "bold");
            const titleWidth = this.doc.getTextWidth(coverData.title);
            const titleX = (pageWidth - titleWidth) / 2;
            this.doc.text(coverData.title, titleX, yPosition);
            yPosition += 12;
        }

        // Add vote name if provided
        if (coverData.voteName) {
            this.doc.setFontSize(16);
            this.doc.setFont("helvetica", "bold");
            const voteWidth = this.doc.getTextWidth(coverData.voteName);
            const voteX = (pageWidth - voteWidth) / 2;
            this.doc.text(coverData.voteName, voteX, yPosition);
            yPosition += 10;
        }

        // Add financial year if provided
        if (coverData.financialYear) {
            this.doc.setFontSize(14);
            this.doc.setFont("helvetica", "normal");
            const yearWidth = this.doc.getTextWidth(coverData.financialYear);
            const yearX = (pageWidth - yearWidth) / 2;
            this.doc.text(coverData.financialYear, yearX, yPosition);
        }

        // Reset font to normal
        this.doc.setFont("helvetica", "normal");
        this.doc.setFontSize(10);

        // Add page break after cover page
        this.doc.addPage();
        this.currentY = this.margin;
    }

    /**
     * Add a table to the PDF
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
        const headerRows = buildHeaderRows(columns, headerDepth);

        // Prepare body data
        const bodyData = data.map((record, recordIndex) => {
            return leafColumns.map((col: any) => {
                const value = record[col.dataIndex || col.key];

                if (col.render && typeof col.render === "function") {
                    try {
                        const rendered = col.render(value, record, recordIndex);
                        return typeof rendered === "string"
                            ? rendered
                            : (value ?? "");
                    } catch {
                        return value ?? "";
                    }
                }

                return value ?? "";
            });
        });

        const columnStyles = buildColumnStyles(
            this.doc,
            this.margin,
            leafColumns,
        );

        // Generate table
        autoTable(this.doc, {
            head: headerRows,
            body: bodyData,
            startY: this.currentY,
            theme: "grid",
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: 2,
            },
            columnStyles: columnStyles,
            didParseCell: (hookData) => {
                // Apply onCell styling to body cells
                if (hookData.section === "body") {
                    const colIndex = hookData.column.index;
                    const rowIndex = hookData.row.index;
                    const col = leafColumns[colIndex];
                    const record = data[rowIndex];

                    if (col.onCell && record) {
                        const value = record[col.dataIndex || col.key];
                        const cellColor = extractCellColor(
                            col,
                            value,
                            record,
                            rowIndex,
                        );

                        if (cellColor) {
                            if (cellColor.bg) {
                                const bgRgb = hexToRgb(cellColor.bg);
                                if (bgRgb) {
                                    hookData.cell.styles.fillColor = bgRgb;
                                }
                            }
                            if (cellColor.fg) {
                                const fgRgb = hexToRgb(cellColor.fg);
                                if (fgRgb) {
                                    hookData.cell.styles.textColor = fgRgb;
                                }
                            }
                        }
                    }
                }
            },
        });

        // Update currentY to after the table
        this.currentY = (this.doc as any).lastAutoTable.finalY + 8;

        return this;
    }

    /**
     * Add a table with comment rows to the PDF
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
        const headerRows = buildHeaderRows(columns, headerDepth);

        // Prepare body data with comment rows
        const bodyData: any[] = [];
        const bodyRowToDataIndex = new Map<number, number>(); // Maps body row index to data array index
        let currentBodyIndex = 0;

        data.forEach((record, recordIndex) => {
            // Add main data row
            const dataRow = leafColumns.map((col: any) => {
                const value = record[col.dataIndex || col.key];

                if (col.render && typeof col.render === "function") {
                    try {
                        const rendered = col.render(value, record, recordIndex);
                        return typeof rendered === "string"
                            ? rendered
                            : (value ?? "");
                    } catch {
                        return value ?? "";
                    }
                }

                return value ?? "";
            });
            bodyData.push(dataRow);
            bodyRowToDataIndex.set(currentBodyIndex, recordIndex); // Map body row to data index
            currentBodyIndex++;

            // Add comment row if comments exist
            const comments = commentExtractor(record);
            if (comments) {
                bodyData.push([comments]);
                currentBodyIndex++;
            }
        });

        const columnStyles = buildColumnStyles(
            this.doc,
            this.margin,
            leafColumns,
        );

        // Build set of comment row indices from the mapping
        const commentRowIndices = new Set<number>();
        for (let i = 0; i < bodyData.length; i++) {
            if (!bodyRowToDataIndex.has(i)) {
                commentRowIndices.add(i);
            }
        }

        // Generate table
        autoTable(this.doc, {
            head: headerRows,
            body: bodyData,
            startY: this.currentY,
            theme: "grid",
            styles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: 2,
            },
            columnStyles: columnStyles,
            didParseCell: (hookData) => {
                // Apply onCell styling to body cells
                if (hookData.section === "body") {
                    const rowIndex = hookData.row.index;

                    // Check if this is a comment row
                    if (commentRowIndices.has(rowIndex)) {
                        // Style comment row
                        hookData.cell.styles.fillColor = [245, 245, 245];
                        hookData.cell.styles.fontStyle = "italic";
                        hookData.cell.styles.fontSize = 7;

                        // Merge all columns for comment row
                        if (hookData.column.index === 0) {
                            hookData.cell.colSpan = leafColumns.length;
                        } else {
                            hookData.cell.styles.cellWidth = 0;
                        }
                    } else {
                        // Apply normal cell styling
                        const colIndex = hookData.column.index;
                        const actualDataIndex = bodyRowToDataIndex.get(rowIndex);
                        const col = leafColumns[colIndex];

                        if (actualDataIndex !== undefined && col.onCell) {
                            const record = data[actualDataIndex];
                            const value = record[col.dataIndex || col.key];
                            const cellColor = extractCellColor(
                                col,
                                value,
                                record,
                                actualDataIndex,
                            );

                            if (cellColor) {
                                if (cellColor.bg) {
                                    const bgRgb = hexToRgb(cellColor.bg);
                                    if (bgRgb) {
                                        hookData.cell.styles.fillColor = bgRgb;
                                    }
                                }
                                if (cellColor.fg) {
                                    const fgRgb = hexToRgb(cellColor.fg);
                                    if (fgRgb) {
                                        hookData.cell.styles.textColor = fgRgb;
                                    }
                                }
                            }
                        }
                    }
                }
            },
        });

        // Update currentY to after the table
        this.currentY = (this.doc as any).lastAutoTable.finalY + 8;

        return this;
    }

    /**
     * Force a page break
     */
    addPageBreak(): this {
        this.doc.addPage();
        this.currentY = this.margin;
        return this;
    }

    /**
     * Add spacing (vertical gap)
     */
    addSpacing(mm: number = 5): this {
        this.currentY += mm;
        if (this.currentY > this.pageHeight) {
            this.doc.addPage();
            this.currentY = this.margin;
        }
        return this;
    }

    /**
     * Download the generated PDF
     */
    download(filename: string = "export.pdf"): void {
        this.doc.save(filename);
    }
}
