import { DownloadOutlined } from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import { Button, Flex, Table, type TableProps } from "antd";
import React, { useState } from "react";
import PerformanceLegend from "../../../../components/performance-legend";
import downloadExcelFromColumns from "../../../../download-antd-table";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import {
    formatter,
    getCellStyle,
    legendItems,
    processByPerformance,
} from "../../../../utils";
import {
    applySortOrderToColumns,
    normalizeSorterField,
    sortRowsByColumn,
} from "../../../../utils/table-sort";
import { RootRoute } from "../../../__root";
import { OverallPerformanceRoute } from "./route";

export const OverallPerformanceIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => OverallPerformanceRoute,
    component: OverallPerformance,
    // errorComponent: () => <div>{null}</div>,
});

export function OverallPerformance() {
    const { votes, categories, ou, programs } = RootRoute.useLoaderData();
    const { engine } = OverallPerformanceRoute.useRouteContext();
    const { pe = "", v } = OverallPerformanceIndexRoute.useSearch();
    const targetCategoryOptions = categories.get("Duw5yep8Vae");
    const budgetCategoryOptions = categories.get("kfnptfEdnYl");
    const { data: outcome } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou: ou,
            category: "Duw5yep8Vae",
            categoryOptions: targetCategoryOptions,
        },
        ndpVersion: v,
        attributeValue: "intermediateOutcome",
        specificLevel: 3,
        ouIsFilter: false,
    });

    const { data: output } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou: ou,
            category: "Duw5yep8Vae",
            categoryOptions: targetCategoryOptions,
        },
        ndpVersion: v,
        attributeValue: "output",
        specificLevel: 3,
        ouIsFilter: false,
    });

    const { data: budget } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou: ou,
            category: "kfnptfEdnYl",
            categoryOptions: budgetCategoryOptions,
        },
        ndpVersion: v,
        attributeValue: "action",
        specificLevel: 3,
        ouIsFilter: false,
    });

    const outcomeData = processByPerformance({
        dataElements: outcome,
        groupingBy: "orgUnit",
        programs,
        pe,
        votes,
    });
    const outputData = processByPerformance({
        dataElements: output,
        groupingBy: "orgUnit",
        programs,
        pe,
        votes,
    });
    const budgetData = processByPerformance({
        dataElements: budget,
        groupingBy: "orgUnit",
        programs,
        pe,
        votes,
    });

    const [finalData, setFinalData] = useState(
        votes.map((vote) => {
            const outputPerformance =
                outputData.find(({ orgUnit }) => orgUnit === vote.id)
                    ?.totalWeighted ?? 0;
            const outcomePerformance =
                outcomeData.find(({ orgUnit }) => orgUnit === vote.id)
                    ?.totalWeighted ?? 0;
            const absorptionRate =
                budgetData.find(({ orgUnit }) => orgUnit === vote.id)
                    ?.performance ?? 0;
            const overallScore =
                0.4 * outcomePerformance +
                0.4 * outputPerformance +
                0.2 * absorptionRate;
            return {
                ...vote,
                outputPerformance,
                outcomePerformance,
                absorptionRate,
                overallScore,
            };
        }),
    );
    const [sortField, setSortField] = useState<string>();
    const [sortOrder, setSortOrder] = useState<
        "ascend" | "descend" | undefined
    >();

    React.useEffect(() => {
        setFinalData(() =>
            votes.map((vote) => {
                const outputPerformance =
                    outputData.find(({ orgUnit }) => orgUnit === vote.id)
                        ?.totalWeighted ?? 0;
                const outcomePerformance =
                    outcomeData.find(({ orgUnit }) => orgUnit === vote.id)
                        ?.totalWeighted ?? 0;
                const absorptionRate =
                    budgetData.find(({ orgUnit }) => orgUnit === vote.id)
                        ?.performance ?? 0;
                const overallScore =
                    0.4 * outcomePerformance +
                    0.4 * outputPerformance +
                    0.2 * absorptionRate;
                return {
                    ...vote,
                    outputPerformance,
                    outcomePerformance,
                    absorptionRate,
                    overallScore,
                };
            }),
        );
    }, [outputData, outcomeData, budgetData, votes]);

    const columns: TableProps<(typeof finalData)[number]>["columns"] = [
        {
            title: "Code",
            dataIndex: "code",
            key: "code",
            align: "center",
            sorter: true,
            width: 70,
            render: (_, record) => record.code?.replace("V", ""),
        },
        {
            title: "Institution",
            dataIndex: "name",
            key: "name",
            sorter: true,
        },

        {
            title: " Absorption Rate (%)",
            dataIndex: "absorptionRate",
            key: "absorptionRate",
            width: 180,
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.absorptionRate),
            onCell: (record) => ({
                style: getCellStyle(record.absorptionRate ?? 0),
            }),
        },
        {
            title: "Output Performance",
            dataIndex: "outputPerformance",
            width: 180,
            key: "outputPerformance",
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.outputPerformance),
            onCell: (record) => ({
                style: getCellStyle(record.outputPerformance ?? 0),
            }),
        },
        {
            title: "Outcome Performance",
            dataIndex: "outcomePerformance",
            key: "outcomePerformance",
            width: 180,
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.outcomePerformance),
            onCell: (record) => ({
                style: getCellStyle(record.outcomePerformance ?? 0),
            }),
        },
        {
            title: " Overall Score (%)",
            dataIndex: "overallScore",
            key: "overallScore",
            align: "center",
            width: 180,
            sorter: true,
            render: (_, record) => formatter.format(record.overallScore),
            onCell: (record) => ({
                style: getCellStyle(record.overallScore ?? 0),
            }),
        },
    ];
    const sortedRows = React.useMemo(
        () =>
            sortRowsByColumn({
                rows: finalData,
                columns,
                sortField,
                sortOrder,
            }),
        [columns, finalData, sortField, sortOrder],
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

    const handleChange: TableProps<(typeof finalData)[number]>["onChange"] =
        React.useCallback((_pagination, _filters, sorter) => {
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
        }, []);
    return (
        <Flex vertical gap={10}>
            <PerformanceLegend legendItems={legendItems} />
            <Flex justify="flex-end">
                <Button
                    onClick={() =>
                        downloadExcelFromColumns(
                            sortedColumns,
                            sortedRows,
                            "performance-report.xlsx",
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
                scroll={{ y: "calc(100vh - 242px)" }}
                rowKey="orgUnit"
                bordered={true}
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleChange}
            />
        </Flex>
    );
}
