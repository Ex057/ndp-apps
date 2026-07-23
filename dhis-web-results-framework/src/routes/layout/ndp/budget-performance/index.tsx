import { createRoute } from "@tanstack/react-router";
import { Flex, Table, TableProps,Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import React from "react";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { AnalyticsData } from "../../../../types";
import { getCellStyle, processByPerformance } from "../../../../utils";
import {
    applySortOrderToColumns,
    normalizeSorterField,
    sortRowsByColumn,
} from "../../../../utils/table-sort";
import { RootRoute } from "../../../__root";
import { BudgetPerformanceRoute } from "./route";
import downloadExcelFromColumns from "../../../../download-antd-table";

const budgetNumberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatBudgetScorecardValue(value: unknown) {
    if (value === "-" || value === "" || value === null || value === undefined) {
        return "-";
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        return String(value);
    }

    return budgetNumberFormatter.format(numericValue);
}

export const BudgetPerformanceIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => BudgetPerformanceRoute,
    component: Component,
});

function Component() {
    const { votes, ou, programs } = RootRoute.useLoaderData();
    const { engine } = BudgetPerformanceRoute.useRouteContext();
    const search = BudgetPerformanceIndexRoute.useSearch();
    const { data } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: [search.pe ?? ""],
            ou,
        },
        ndpVersion: search.v,
        attributeValue: "action",
        specificLevel: 3,
        ouIsFilter: false,
    });
    const [sortField, setSortField] = React.useState<string>();
    const [sortOrder, setSortOrder] = React.useState<
        "ascend" | "descend" | undefined
    >();

    const columns: TableProps<AnalyticsData>["columns"] = [
        {
            title: "Vote",
            dataIndex: "vote",
            key: "vote",
            width: 80,
            align: "center",
            render: (_, record) => record.code?.replace("V", ""),
            sorter: true,
        },
        {
            title: "Institution",
            dataIndex: "name",
            key: "name",
            filterSearch: true,
            filters: votes.map((v) => ({ text: v.name, value: v.name })),
            onFilter: (value, record) =>
                record.name.indexOf(value as string) === 0,

            sorter: true,
        },
        {
            title: `Cumm. Allocation (Ugx Bn)`,
            dataIndex: `approved`,
            key: "approved",
            width: 160,
            align: "center",
            render: (value: unknown) => formatBudgetScorecardValue(value),
            sorter: true,
        },
        {
            title: `Cumm. Release (Ugx Bn)`,
            dataIndex: `target`,
            key: "target",
            width: 160,
            align: "center",
            render: (value: unknown) => formatBudgetScorecardValue(value),
            sorter: true,
        },
        {
            title: `Cumm. Expenditure (Ugx Bn)`,
            dataIndex: `actual`,
            key: "actual",
            width: 160,
            align: "center",
            render: (value: unknown) => formatBudgetScorecardValue(value),
            sorter: true,
        },
        {
            title: `% Budget Released`,
            key: "allocation",
            dataIndex: "allocation",
            width: 160,
            align: "center",
            onCell: (record) => ({
                style: getCellStyle(record.approvedAllocation),
            }),
            sorter: true,
        },
        {
            title: `% Release Spent`,
            key: "spend",
            dataIndex: "spend",
            align: "center",
            width: 160,
            onCell: (record) => ({
                style: getCellStyle(record.actualSpend),
            }),
            sorter: true,
        },
    ];
    const processedRows = React.useMemo(
        () =>
            processByPerformance({
                dataElements: data,
                groupingBy: "orgUnit",
                programs,
                pe: search.pe ?? "",
                votes,
            }),
        [data, programs, search.pe, votes],
    );
    const sortedRows = React.useMemo(
        () =>
            sortRowsByColumn({
                rows: processedRows,
                columns,
                sortField,
                sortOrder,
            }),
        [columns, processedRows, sortField, sortOrder],
    );
    const sortedColumns = React.useMemo(
        () =>
            applySortOrderToColumns({
                columns,
                sortField,
                sortOrder,
            }),
        [columns, sortField, sortOrder],
    );
    const handleChange: TableProps<AnalyticsData>["onChange"] = React.useCallback(
        (_pagination, _filters, sorter) => {
            if (Array.isArray(sorter)) {
                return;
            }

            const field = normalizeSorterField(sorter.field ?? sorter.columnKey);
            if (!field || !sorter.order) {
                setSortField(undefined);
                setSortOrder(undefined);
                return;
            }

            setSortField(field);
            setSortOrder(sorter.order === "descend" ? "descend" : "ascend");
        },
        [],
    );

    return (
        <Flex vertical gap="16px">
            <Flex justify="flex-end">
                <Button
                    onClick={() =>
                        downloadExcelFromColumns(
                            sortedColumns,
                            sortedRows,
                            "budget-performance-report.xlsx",
                        )
                    }
                    icon={<DownloadOutlined />}
                >
                    Download Excel
                </Button>
            </Flex>
            <Table
                columns={sortedColumns}
                dataSource={sortedRows}
                scroll={{ y: "calc(100vh - 300px)" }}
                rowKey="orgUnit"
                bordered={true}
                sticky={true}
                pagination={false}
                size="small"
                onChange={handleChange}
            />
        </Flex>
    );
}
