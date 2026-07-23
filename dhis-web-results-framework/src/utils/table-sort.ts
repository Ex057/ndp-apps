import type { TableProps } from "antd";
import React from "react";

type SortOrder = "ascend" | "descend" | undefined;

type SortableColumn<T> = NonNullable<TableProps<T>["columns"]>[number];

function textFromReactNode(value: React.ReactNode): string {
    if (value === null || value === undefined || typeof value === "boolean") {
        return "";
    }
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint"
    ) {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(textFromReactNode).join("");
    }
    if (React.isValidElement(value)) {
        const props = value.props as { children?: React.ReactNode };
        return textFromReactNode(props.children);
    }
    if (typeof value === "object" && "children" in value) {
        return textFromReactNode(
            (value as { children?: React.ReactNode }).children,
        );
    }
    return "";
}

function getColumnId<T>(column: SortableColumn<T>): string | undefined {
    const typedColumn = column as {
        dataIndex?: string | number | Array<string | number>;
        key?: React.Key;
    };

    if (Array.isArray(typedColumn.dataIndex)) {
        const last = typedColumn.dataIndex.at(-1);
        return last === undefined ? undefined : String(last);
    }

    if (
        typeof typedColumn.dataIndex === "string" ||
        typeof typedColumn.dataIndex === "number"
    ) {
        return String(typedColumn.dataIndex);
    }

    if (
        typeof typedColumn.key === "string" ||
        typeof typedColumn.key === "number"
    ) {
        return String(typedColumn.key);
    }

    return undefined;
}

function getRecordValue(
    record: Record<string, unknown>,
    dataIndex?: string | number | Array<string | number>,
    key?: React.Key,
): unknown {
    if (Array.isArray(dataIndex)) {
        return dataIndex.reduce<unknown>((current, part) => {
            if (current && typeof current === "object") {
                return (current as Record<string, unknown>)[String(part)];
            }
            return undefined;
        }, record);
    }

    if (typeof dataIndex === "string" || typeof dataIndex === "number") {
        return record[String(dataIndex)];
    }

    if (typeof key === "string" || typeof key === "number") {
        return record[String(key)];
    }

    return undefined;
}

function normalizeSortValue(value: unknown): number | string | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    if (typeof value === "bigint") {
        return Number(value);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const numeric = trimmed.replace(/,/g, "").replace(/%$/, "");
        if (/^-?\d+(\.\d+)?$/.test(numeric)) {
            const parsed = Number(numeric);
            return Number.isFinite(parsed) ? parsed : trimmed.toLowerCase();
        }

        return trimmed.toLowerCase();
    }

    return textFromReactNode(value as React.ReactNode).trim().toLowerCase() || null;
}

function compareSortValues(left: unknown, right: unknown): number {
    const normalizedLeft = normalizeSortValue(left);
    const normalizedRight = normalizeSortValue(right);

    if (normalizedLeft === null && normalizedRight === null) {
        return 0;
    }
    if (normalizedLeft === null) {
        return 1;
    }
    if (normalizedRight === null) {
        return -1;
    }

    if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
        return normalizedLeft - normalizedRight;
    }

    return String(normalizedLeft).localeCompare(String(normalizedRight), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

export function normalizeSorterField(
    field: React.Key | readonly React.Key[] | undefined,
): string | undefined {
    if (Array.isArray(field)) {
        const last = field.at(-1);
        return last === undefined ? undefined : String(last);
    }

    if (typeof field === "string" || typeof field === "number") {
        return String(field);
    }

    return undefined;
}

export function sortRowsByColumn<T extends Record<string, unknown>>({
    rows,
    columns,
    sortField,
    sortOrder,
}: {
    rows: T[];
    columns: TableProps<T>["columns"];
    sortField?: string;
    sortOrder?: SortOrder;
}): T[] {
    if (!columns || !sortField || !sortOrder) {
        return rows;
    }

    const flattened = flattenSortableColumns(columns);
    const activeColumn = flattened.find((column) => getColumnId(column) === sortField);

    if (!activeColumn) {
        return rows;
    }

    const direction = sortOrder === "descend" ? -1 : 1;
    const typedColumn = activeColumn as {
        dataIndex?: string | number | Array<string | number>;
        key?: React.Key;
        render?: (value: unknown, record: T, index: number) => React.ReactNode;
    };

    return rows
        .map((row, index) => ({ row, index }))
        .sort((left, right) => {
            const leftRaw = getRecordValue(
                left.row,
                typedColumn.dataIndex,
                typedColumn.key,
            );
            const rightRaw = getRecordValue(
                right.row,
                typedColumn.dataIndex,
                typedColumn.key,
            );

            const leftValue =
                typedColumn.render?.(leftRaw, left.row, left.index) ?? leftRaw;
            const rightValue =
                typedColumn.render?.(rightRaw, right.row, right.index) ??
                rightRaw;

            const comparison = compareSortValues(leftValue, rightValue);
            if (comparison !== 0) {
                return comparison * direction;
            }
            return left.index - right.index;
        })
        .map(({ row }) => row);
}

export function applySortOrderToColumns<T>({
    columns,
    sortField,
    sortOrder,
}: {
    columns: TableProps<T>["columns"];
    sortField?: string;
    sortOrder?: SortOrder;
}): TableProps<T>["columns"] {
    if (!columns) {
        return columns;
    }

    return columns.map((column) => {
        if (!column) {
            return column;
        }

        const typedColumn = column as SortableColumn<T> & {
            children?: TableProps<T>["columns"];
        };

        if (typedColumn.children) {
            return {
                ...typedColumn,
                children: applySortOrderToColumns({
                    columns: typedColumn.children,
                    sortField,
                    sortOrder,
                }),
            };
        }

        if (!typedColumn.sorter) {
            return typedColumn;
        }

        return {
            ...typedColumn,
            sortOrder:
                sortField && getColumnId(typedColumn) === sortField
                    ? sortOrder ?? null
                    : null,
        };
    });
}

function flattenSortableColumns<T>(
    columns: TableProps<T>["columns"],
): Array<SortableColumn<T>> {
    const flattened: Array<SortableColumn<T>> = [];

    (columns ?? []).forEach((column) => {
        if (!column) {
            return;
        }

        const typedColumn = column as SortableColumn<T> & {
            children?: TableProps<T>["columns"];
        };

        if (typedColumn.children) {
            flattened.push(...flattenSortableColumns(typedColumn.children));
            return;
        }

        flattened.push(typedColumn);
    });

    return flattened;
}
