import { DownloadOutlined } from "@ant-design/icons";
import { Button, Flex, Table, TableProps } from "antd";
import React from "react";
import { ExcelBuilder } from "../excel-builder";
import { RootRoute } from "../routes/__root";
import { AnalyticsData } from "../types";
import { PERFORMANCE_COLORS, processByPerformance } from "../utils";

export default function Performance({
    data,
    pe,
    groupingBy,
    initialColumns,
    showDownload = true,
}: {
    data: AnalyticsData[];
    pe: string;
    groupingBy: string;
    initialColumns: TableProps<AnalyticsData>["columns"];
    showDownload?: boolean;
}) {
    const { programs, votes } = RootRoute.useLoaderData();
    const handleChange: TableProps<AnalyticsData>["onChange"] = (
        _pagination,
        _filters,
        sorter,
    ) => {
        if (!Array.isArray(sorter)) {
        }
    };
    const columns: TableProps<AnalyticsData>["columns"] = React.useMemo(() => {
        return [
            {
                title: `No of Indicators`,
                dataIndex: "total",
                key: "total",
                width: 140,
                align: "center",
                render: (_, record) => record.total ?? "",
                sorter: true,
            },
            {
                title: `A`,
                dataIndex: "achieved",
                key: "achieved",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.green.bg,
                        color: PERFORMANCE_COLORS.green.fg,
                    },
                }),
                sorter: true,
            },

            {
                title: `M`,
                dataIndex: "moderatelyAchieved",
                key: "moderatelyAchieved",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.yellow.bg,
                        color: PERFORMANCE_COLORS.yellow.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `N`,
                dataIndex: "notAchieved",
                key: "notAchieved",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.red.bg,
                        color: PERFORMANCE_COLORS.red.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `ND`,
                dataIndex: "noData",
                key: "noData",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.gray.bg,
                        color: PERFORMANCE_COLORS.gray.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `% A`,
                dataIndex: "percentAchieved",
                key: "percentAchieved",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.green.bg,
                        color: PERFORMANCE_COLORS.green.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `% M`,
                dataIndex: "percentModeratelyAchieved",
                key: "percentModeratelyAchieved",
                width: 72,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.yellow.bg,
                        color: PERFORMANCE_COLORS.yellow.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `% N`,
                dataIndex: "percentNotAchieved",
                key: "percentNotAchieved",
                width: 70,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.red.bg,
                        color: PERFORMANCE_COLORS.red.fg,
                    },
                }),
                sorter: true,
            },
            {
                title: `% ND`,
                dataIndex: "percentNoData",
                key: "percentNoData",
                width: 83,
                align: "center",
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: PERFORMANCE_COLORS.gray.bg,
                        color: PERFORMANCE_COLORS.gray.fg,
                    },
                }),
                sorter: true,
            },
        ];
    }, []);

    return (
        <Flex vertical gap="16px">
            {showDownload && (
                <Flex justify="flex-end">
                    <Button
                        // onClick={() =>
                        //     downloadExcelFromColumns(
                        //         columns,
                        //         data,
                        //         "performance-report.xlsx",
                        //     )
                        // }
                        icon={<DownloadOutlined />}
                        onClick={() => {
                            const builder = new ExcelBuilder({
                                title: "Consolidated Performance Report",
                                sheetName: "Consolidated Performance Report",
                            });

                            builder
                                .addSpacer(1)

                                .addTable(
                                    (initialColumns ?? []).concat(columns),
                                    processByPerformance({
                                        dataElements: data,
                                        groupingBy,
                                        programs,
                                        pe,
                                        votes,
                                    }),
                                )

                                .download("Vote_Flash_Report.xlsx");
                        }}
                    >
                        Download Excel
                    </Button>
                </Flex>
            )}
            <Table
                columns={(initialColumns ?? []).concat(columns)}
                dataSource={processByPerformance({
                    dataElements: data,
                    groupingBy,
                    programs,
                    pe,
                    votes,
                })}
                scroll={{ y: "calc(100vh - 400px)" }}
                rowKey="id"
                bordered={true}
                sticky={true}
                pagination={false}
                size="small"
                onChange={handleChange}
            />
        </Flex>
    );
}
