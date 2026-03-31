import { DownloadOutlined } from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import {
    Button,
    Descriptions,
    DescriptionsProps,
    Flex,
    Table,
    TableProps,
    Typography,
} from "antd";
import React, { useState } from "react";
import Performance from "../../../../components/performance";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { AnalyticsData } from "../../../../types";
import {
    createPerformanceColumns,
    formatter,
    getCellStyle,
    PERFORMANCE_COLORS,
    processByPerformance,
} from "../../../../utils";
import { RootRoute } from "../../../__root";
import { VoteFlashReportRoute } from "./route";

import { ExcelBuilder } from "../../../../excel-builder";
import { PDFBuilder } from "../../../../pdf-builder";

const quarterOrder = { Q1: "Q3", Q2: "Q4", Q3: "Q1", Q4: "Q2" };

const fullQuarters = {
    3: "Q1",
    4: "Q2",
    1: "Q3",
    2: "Q4",
};

const makePeriod = (pe: string[], quarters?: boolean) => {
    const periodFilter = new Set(pe);
    if (quarters) {
        for (const p of pe) {
            const year = Number(p?.slice(0, 4));
            const q1 = `${year}Q3`;
            const q2 = `${year}Q4`;
            const q3 = `${year + 1}Q1`;
            const q4 = `${year + 1}Q2`;
            periodFilter.add(q1).add(q2).add(q3).add(q4);
        }
    }
    return Array.from(periodFilter);
};

export const VoteFlashReportIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => VoteFlashReportRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { engine } = VoteFlashReportRoute.useRouteContext();
    const { categories, programs, votes, allOptionsMap } =
        RootRoute.useLoaderData();
    const { v, ou = "", pe = "" } = VoteFlashReportRoute.useSearch();

    const {
        data: outputs,
        dimensions: outputDimensions,
        items: outputItems,
    } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou,
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            quarters: true,
        },
        ndpVersion: v,
        attributeValue: "output",
        queryByOu: true,
    });

    const { data: programData } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou,
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            quarters: true,
        },
        ndpVersion: v,
        queryByOu: true,
    });

    const {
        data: outcomes,
        dimensions: outcomeDimensions,
        items: outcomeItems,
    } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou,
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            quarters: true,
        },
        ndpVersion: v,
        attributeValue: "outcome",
        queryByOu: true,
    });

    const {
        data: intermediateOutcomes,
        dimensions: intermediateOutcomeDimensions,
        items: intermediateOutcomeItems,
    } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou,
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            quarters: true,
        },
        ndpVersion: v,
        attributeValue: "intermediateOutcome",
        queryByOu: true,
    });

    const {
        data: actions,
        dimensions: actionDimensions,
        items: actionItems,
    } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            ou,
            category: "kfnptfEdnYl",
            categoryOptions: categories.get("kfnptfEdnYl") || [],
            quarters: true,
        },
        ndpVersion: v,
        attributeValue: "action",
        queryByOu: true,
    });

    const outcomeData = processByPerformance({
        dataElements: outcomes,
        groupingBy: "UBWSASWdyfi",
        programs,
        pe,
        votes,
    });
    const outputData = processByPerformance({
        dataElements: outputs,
        groupingBy: "UBWSASWdyfi",
        programs,
        pe,
        votes,
    });
    const budgetData = processByPerformance({
        dataElements: actions,
        groupingBy: "UBWSASWdyfi",
        programs,
        pe,
        votes,
    });

    const allPrograms = new Set([
        ...outcomeData.map((d) => d["UBWSASWdyfi"]),
        ...outputData.map((d) => d["UBWSASWdyfi"]),
        ...budgetData.map((d) => d["UBWSASWdyfi"]),
    ]);

    const [finalData, setFinalData] = useState(
        Array.from(allPrograms).map((vote) => {
            const outputPerformance =
                outputData.find((d) => d["UBWSASWdyfi"] === vote)
                    ?.totalWeighted ?? 0;
            const outcomePerformance =
                outcomeData.find((d) => d["UBWSASWdyfi"] === vote)
                    ?.totalWeighted ?? 0;
            const absorptionRate =
                budgetData.find((d) => d["UBWSASWdyfi"] === vote)
                    ?.performance ?? 0;
            const overallScore =
                0.4 * outcomePerformance +
                0.4 * outputPerformance +
                0.2 * absorptionRate;
            return {
                ...(budgetData.find((d) => d["UBWSASWdyfi"] === vote) ?? {}),
                ...(outcomeData.find((d) => d["UBWSASWdyfi"] === vote) ?? {}),
                ...(outputData.find((d) => d["UBWSASWdyfi"] === vote) ?? {}),
                outputPerformance,
                outcomePerformance,
                absorptionRate,
                overallScore,
            };
        }),
    );

    React.useEffect(() => {
        setFinalData(() =>
            Array.from(allPrograms).map((vote) => {
                const outputPerformance =
                    outputData.find((d) => d["UBWSASWdyfi"] === vote)
                        ?.totalWeighted ?? 0;
                const outcomePerformance =
                    outcomeData.find((d) => d["UBWSASWdyfi"] === vote)
                        ?.totalWeighted ?? 0;
                const absorptionRate =
                    budgetData.find((d) => d["UBWSASWdyfi"] === vote)
                        ?.performance ?? 0;
                const overallScore =
                    0.4 * outcomePerformance +
                    0.4 * outputPerformance +
                    0.2 * absorptionRate;
                return {
                    ...(budgetData.find((d) => d["UBWSASWdyfi"] === vote) ??
                        {}),
                    ...(outcomeData.find((d) => d["UBWSASWdyfi"] === vote) ??
                        {}),
                    ...(outputData.find((d) => d["UBWSASWdyfi"] === vote) ??
                        {}),
                    outputPerformance,
                    outcomePerformance,
                    absorptionRate,
                    overallScore,
                };
            }),
        );
    }, [ou]);

    const columns: TableProps<(typeof finalData)[number]>["columns"] = [
        {
            title: "Code",
            dataIndex: "UBWSASWdyfi",
            key: "code",
            align: "center",
            sorter: true,
            width: 150,
        },
        {
            title: "Programme",
            dataIndex: "program",
            key: "program",
            sorter: true,
        },
        {
            title: " Absorption Rate (%)",
            dataIndex: "absorptionRate",
            key: "absorptionRate",
            width: 200,
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.absorptionRate),
            onCell: (record) => ({
                style: getCellStyle(record.absorptionRate ?? 0),
            }),
        },
        {
            title: "Outcome Performance",
            dataIndex: "outcomePerformance",
            key: "outcomePerformance",
            width: 200,
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.outcomePerformance),
            onCell: (record) => ({
                style: getCellStyle(record.outcomePerformance ?? 0),
            }),
        },
        {
            title: "Output Performance",
            dataIndex: "outputPerformance",
            width: 200,
            key: "outputPerformance",
            align: "center",
            sorter: true,
            render: (_, record) => formatter.format(record.outputPerformance),
            onCell: (record) => ({
                style: getCellStyle(record.outputPerformance ?? 0),
            }),
        },
        {
            title: " Overall Score (%)",
            dataIndex: "overallScore",
            key: "overallScore",
            align: "center",
            width: 200,
            sorter: true,
            render: (_, record) => formatter.format(record.overallScore),
            onCell: (record) => ({
                style: getCellStyle(record.overallScore ?? 0),
            }),
        },
    ];

    const budgetColumns: TableProps<AnalyticsData>["columns"] = [
        {
            title: "Code",
            dataIndex: "UBWSASWdyfi",
            key: "code",
            align: "center",
            sorter: true,
            width: 150,
        },
        {
            title: "Programme",
            dataIndex: "program",
            key: "program",
            sorter: true,
        },
        {
            title: `Cumm. Allocation (Ugx Bn)`,
            dataIndex: `approved`,
            key: "approved",
            width: 160,
            align: "center",
            sorter: true,
        },
        {
            title: `Cumm. Release (Ugx Bn)`,
            dataIndex: `target`,
            key: "target",
            width: 160,
            align: "center",
            sorter: true,
        },
        {
            title: `Cumm. Expenditure (Ugx Bn)`,
            dataIndex: `actual`,
            key: "actual",
            width: 160,
            align: "center",
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

    const programColumns: TableProps<AnalyticsData>["columns"] =
        React.useMemo(() => {
            return [
                {
                    title: `Code`,
                    dataIndex: "UBWSASWdyfi",
                    key: "UBWSASWdyfi",
                    width: 150,
                    align: "center",
                    sorter: true,
                },
                {
                    title: `Programme`,
                    dataIndex: "program",
                    key: "program",

                    sorter: true,
                },
            ];
        }, []);

    const outputColumns: TableProps<AnalyticsData>["columns"] =
        React.useMemo(() => {
            return [
                {
                    title: `Code`,
                    dataIndex: "UBWSASWdyfi",
                    key: "UBWSASWdyfi",
                    width: 150,
                    align: "center",
                    sorter: true,
                },
                {
                    title: `Programme`,
                    dataIndex: "program",
                    key: "program",
                    render: (text: string) => {
                        return text.replace(/\d+/g, "").trim();
                    },
                    sorter: true,
                },
                {
                    title: `Output Name`,
                    dataIndex: "AKzxCNn1zkQ",
                    key: "AKzxCNn1zkQ",
                    render: (text: string) => allOptionsMap?.get(text) || text,
                    sorter: true,
                },
            ];
        }, []);
    const outcomeColumns: TableProps<AnalyticsData>["columns"] =
        React.useMemo(() => {
            return [
                {
                    title: `Code`,
                    dataIndex: "UBWSASWdyfi",
                    key: "UBWSASWdyfi",
                    width: 150,
                    align: "center",
                    sorter: true,
                },
                {
                    title: `Programme`,
                    dataIndex: "program",
                    key: "program",
                    render: (text: string) => {
                        return text.replace(/\d+/g, "").trim();
                    },
                    sorter: true,
                },
                {
                    title: `Outcome`,
                    dataIndex: "YlPvYLC4VfO",
                    key: "YlPvYLC4VfO",
                    render: (text: string) => allOptionsMap?.get(text) || text,
                    sorter: true,
                },
            ];
        }, []);

    const performanceColumns: TableProps<AnalyticsData>["columns"] =
        React.useMemo(() => {
            return [
                {
                    title: `No of Indicators`,
                    dataIndex: "total",
                    key: "total",
                    width: 240,
                    align: "center",
                    render: (_, record) => record.total ?? "",
                    sorter: true,
                },
                {
                    title: `A`,
                    dataIndex: "achieved",
                    key: "achieved",
                    width: 110,
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
                    width: 110,
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
                    width: 110,
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
                    width: 110,
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
                    width: 110,
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
                    width: 110,
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
                    width: 110,
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
                    width: 120,
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

    // Complete column sets for Summary Performance tables (initial + performance columns)
    const programCompleteColumns = React.useMemo(
        () => (programColumns ?? []).concat(performanceColumns),
        [programColumns, performanceColumns],
    );
    const outcomeCompleteColumns = React.useMemo(
        () => (outcomeColumns ?? []).concat(performanceColumns),
        [outcomeColumns, performanceColumns],
    );
    const outputCompleteColumns = React.useMemo(
        () => (outputColumns ?? []).concat(performanceColumns),
        [outputColumns, performanceColumns],
    );

    const outComeDetailedColumns = React.useMemo(() => {
        return createPerformanceColumns({
            baseline: "",
            nameColumn: [
                {
                    title: "Indicators",
                    dataIndex: "name",
                    key: "name",
                },
            ],
            items: outcomeItems,
            nonBaseline: false,
            quarters: true,
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            dimensions: outcomeDimensions,
            pe: [pe],
        });
    }, []);

    const intermediateOutcomeDetailedColumns = React.useMemo(() => {
        return createPerformanceColumns({
            baseline: categories.get("Duw5yep8Vae")?.[0] || "",
            nameColumn: [
                {
                    title: "Indicators",
                    dataIndex: "name",
                    key: "name",
                },
            ],
            items: outcomeItems,
            nonBaseline: false,
            quarters: true,
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            dimensions: outcomeDimensions,
            pe: [pe],
        });
    }, []);
    const outputDetailedColumns = React.useMemo(() => {
        return createPerformanceColumns({
            baseline: categories.get("Duw5yep8Vae")?.[0] || "",
            nameColumn: [
                {
                    title: "Indicators",
                    dataIndex: "name",
                    key: "name",
                },
            ],
            items: outputItems,
            nonBaseline: false,
            quarters: true,
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            dimensions: outputDimensions,
            pe: [pe],
        });
    }, [categories, outputItems, outputDimensions, pe]);
    const actionDetailedColumns = React.useMemo(() => {
        return createPerformanceColumns({
            baseline: categories.get("kfnptfEdnYl")?.[0] || "",
            nameColumn: [
                {
                    title: "Indicators",
                    dataIndex: "name",
                    key: "name",
                },
            ],
            items: actionItems,
            nonBaseline: true,
            quarters: true,
            categoryOptions: categories.get("kfnptfEdnYl") || [],
            dimensions: actionDimensions,
            pe: [pe],
        });
    }, []);

    const outcomeTableProps = React.useMemo<TableProps<AnalyticsData>>(
        () => ({
            rowKey: "id",
            bordered: true,
            sticky: true,
            tableLayout: "auto",
            pagination: false,
            size: "small",
            dataSource: outcomes,
            columns: outComeDetailedColumns,
            expandable: {
                expandedRowRender: (record) => {
                    const itemValues: DescriptionsProps["items"] = [pe].flatMap(
                        (pe) => {
                            const year = Number(pe.slice(0, 4));
                            return [3, 4, 1, 2].flatMap((quarter) => {
                                const currentYear =
                                    quarter === 1 || quarter === 2
                                        ? year
                                        : year + 1;
                                const period = `${currentYear}${fullQuarters[quarter]}`;
                                const comment = record[`${period}comment`];
                                if (comment) {
                                    return {
                                        label: `${outcomeItems?.[pe]?.name} ${quarterOrder[fullQuarters[quarter]]}`,
                                        children: comment,
                                        key: `${pe}${quarter}`,
                                    };
                                }
                                return [];
                            });
                        },
                    );
                    return (
                        <Descriptions
                            size="small"
                            column={1}
                            items={itemValues}
                        />
                    );
                },
                rowExpandable: (record) => {
                    const actual = makePeriod([pe], true);
                    return actual.some(
                        (period) => !!record[`${period}comment`],
                    );
                },
            },
        }),
        [outcomes, pe],
    );
    const intermediateOutcomeTableProps = React.useMemo<
        TableProps<AnalyticsData>
    >(
        () => ({
            rowKey: "id",
            bordered: true,
            sticky: true,
            tableLayout: "auto",
            pagination: false,
            size: "small",
            dataSource: intermediateOutcomes,
            columns: intermediateOutcomeDetailedColumns,
            expandable: {
                expandedRowRender: (record) => {
                    const itemValues: DescriptionsProps["items"] = [pe].flatMap(
                        (pe) => {
                            const year = Number(pe.slice(0, 4));
                            return [3, 4, 1, 2].flatMap((quarter) => {
                                const currentYear =
                                    quarter === 1 || quarter === 2
                                        ? year
                                        : year + 1;
                                const period = `${currentYear}${fullQuarters[quarter]}`;
                                const comment = record[`${period}comment`];
                                if (comment) {
                                    return {
                                        label: `${intermediateOutcomeItems?.[pe]?.name} ${quarterOrder[fullQuarters[quarter]]}`,
                                        children: comment,
                                        key: `${pe}${quarter}`,
                                    };
                                }
                                return [];
                            });
                        },
                    );
                    return (
                        <Descriptions
                            size="small"
                            column={1}
                            items={itemValues}
                        />
                    );
                },
                rowExpandable: (record) => {
                    const actual = makePeriod([pe], true);
                    return actual.some(
                        (period) => !!record[`${period}comment`],
                    );
                },
            },
        }),
        [intermediateOutcomes],
    );
    const outputTableProps = React.useMemo<TableProps<AnalyticsData>>(
        () => ({
            rowKey: "id",
            bordered: true,
            sticky: true,
            tableLayout: "auto",
            pagination: false,
            size: "small",
            dataSource: outputs,
            columns: outputDetailedColumns,

            expandable: {
                expandedRowRender: (record) => {
                    const itemValues: DescriptionsProps["items"] = [pe].flatMap(
                        (pe) => {
                            const year = Number(pe.slice(0, 4));
                            return [3, 4, 1, 2].flatMap((quarter) => {
                                const currentYear =
                                    quarter === 1 || quarter === 2
                                        ? year
                                        : year + 1;
                                const period = `${currentYear}${fullQuarters[quarter]}`;
                                const comment = record[`${period}comment`];
                                if (comment) {
                                    return {
                                        label: `${outputItems?.[pe]?.name} ${quarterOrder[fullQuarters[quarter]]}`,
                                        children: comment,
                                        key: `${pe}${quarter}`,
                                    };
                                }
                                return [];
                            });
                        },
                    );
                    return (
                        <Descriptions
                            size="small"
                            column={1}
                            items={itemValues}
                        />
                    );
                },
                rowExpandable: (record) => {
                    const actual = makePeriod([pe], true);
                    return actual.some(
                        (period) => !!record[`${period}comment`],
                    );
                },
            },
        }),
        [outputs],
    );
    const actionTableProps = React.useMemo<TableProps<AnalyticsData>>(
        () => ({
            rowKey: "id",
            bordered: true,
            sticky: true,
            tableLayout: "auto",
            pagination: false,
            size: "small",
            dataSource: actions,
            columns: actionDetailedColumns,

            expandable: {
                expandedRowRender: (record) => {
                    const itemValues: DescriptionsProps["items"] = [pe].flatMap(
                        (pe) => {
                            const year = Number(pe.slice(0, 4));
                            return [3, 4, 1, 2].flatMap((quarter) => {
                                const currentYear =
                                    quarter === 1 || quarter === 2
                                        ? year
                                        : year + 1;
                                const period = `${currentYear}${fullQuarters[quarter]}`;
                                const comment = record[`${period}comment`];
                                if (comment) {
                                    return {
                                        label: `${actionItems?.[pe]?.name} ${quarterOrder[fullQuarters[quarter]]}`,
                                        children: comment,
                                        key: `${pe}${quarter}`,
                                    };
                                }
                                return [];
                            });
                        },
                    );
                    return (
                        <Descriptions
                            size="small"
                            column={1}
                            items={itemValues}
                        />
                    );
                },
                rowExpandable: (record) => {
                    const actual = makePeriod([pe], true);
                    return actual.some(
                        (period) => !!record[`${period}comment`],
                    );
                },
            },
        }),
        [actions],
    );

    // Comment extractor functions for exports
    const extractOutcomeComments = React.useCallback(
        (record: any) => {
            const comments: string[] = [];
            const year = Number(pe.slice(0, 4));
            [1, 2, 3, 4].forEach((quarter) => {
                const currentYear =
                    quarter === 1 || quarter === 2 ? year : year + 1;
                const period = `${currentYear}${fullQuarters[quarter]}`;
                const comment = record[`${period}comment`];
                if (comment) {
                    const quarterLabel = quarterOrder[fullQuarters[quarter]];
                    comments.push(`${quarterLabel}: ${comment}\r`);
                }
            });
            return comments.length > 0 ? comments.join("") : null;
        },
        [pe],
    );

    const extractIntermediateOutcomeComments = React.useCallback(
        (record: any) => {
            const comments: string[] = [];
            const year = Number(pe.slice(0, 4));
            [1, 2, 3, 4].forEach((quarter) => {
                const currentYear =
                    quarter === 1 || quarter === 2 ? year : year + 1;
                const period = `${currentYear}${fullQuarters[quarter]}`;
                const comment = record[`${period}comment`];
                if (comment) {
                    const quarterLabel = quarterOrder[fullQuarters[quarter]];
                    comments.push(`${quarterLabel}: ${comment}\r`);
                }
            });
            return comments.length > 0 ? comments.join("") : null;
        },
        [pe],
    );

    const extractOutputComments = React.useCallback(
        (record: any) => {
            const comments: string[] = [];
            const year = Number(pe.slice(0, 4));
            [1, 2, 3, 4].forEach((quarter) => {
                const currentYear =
                    quarter === 1 || quarter === 2 ? year : year + 1;
                const period = `${currentYear}${fullQuarters[quarter]}`;
                const comment = record[`${period}comment`];
                if (comment) {
                    const quarterLabel = quarterOrder[fullQuarters[quarter]];
                    comments.push(`${quarterLabel}: ${comment}\r`);
                }
            });
            return comments.length > 0 ? comments.join("") : null;
        },
        [pe],
    );

    const extractActionComments = React.useCallback(
        (record: any) => {
            const comments: string[] = [];
            const year = Number(pe.slice(0, 4));
            [1, 2, 3, 4].forEach((quarter) => {
                const currentYear =
                    quarter === 1 || quarter === 2 ? year : year + 1;
                const period = `${currentYear}${fullQuarters[quarter]}`;
                const comment = record[`${period}comment`];
                if (comment) {
                    const quarterLabel = quarterOrder[fullQuarters[quarter]];
                    comments.push(`${quarterLabel}: ${comment}\r`);
                }
            });
            return comments.length > 0 ? comments.join("") : null;
        },
        [pe],
    );

    return (
        <Flex vertical gap="16px">
            <Flex justify="flex-end" gap={10}>
                <Button
                    onClick={() => {
                        // Find the vote name from the votes array
                        const currentVote = votes.find(
                            (vote) => vote.id === ou,
                        );
                        const voteName = currentVote?.name || "";

                        const year = Number(pe.slice(0, 4));
                        const financialYear = `Financial Year ${year}/${year + 1}`;

                        const builder = new PDFBuilder({
                            orientation: "landscape",
                            coverPage: {
                                image: "./ugx2.png",
                                title: "Consolidated Performance Report",
                                voteName: voteName,
                                financialYear: financialYear,
                            },
                        });

                        builder
                            .addTitle(
                                "SECTION 1.0 SUMMARY HIGHLIGHTS OF PERFORMANCE",
                                1,
                            )
                            .addTitle("1.1 Performance Scorecards", 2)
                            .addTitle("1.1.1 Overall Scorecard", 3)
                            .addTable(columns, finalData)
                            .addSpacing(3)
                            .addTitle("1.1.2 Budget Performance Scorecard", 3)
                            .addTable(budgetColumns, budgetData)
                            .addSpacing(3)
                            .addTitle("1.2 Summary Performance", 2)
                            .addTitle(
                                "1.2.1 Indicator Performance by Programme",
                                3,
                            )
                            .addTable(
                                programCompleteColumns,
                                processByPerformance({
                                    dataElements: programData,
                                    groupingBy: "UBWSASWdyfi",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacing(3)
                            .addTitle("1.2.2 Outcome Performance", 3)
                            .addTable(
                                outcomeCompleteColumns,
                                processByPerformance({
                                    dataElements: outcomes,
                                    groupingBy: "YlPvYLC4VfO",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacing(3)
                            .addTitle("1.2.3 Output Performance", 3)
                            .addTable(
                                outputCompleteColumns,
                                processByPerformance({
                                    dataElements: outputs,
                                    groupingBy: "AKzxCNn1zkQ",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacing(3)
                            .addTitle("SECTION 2.0 DETAILED PERFORMANCE", 1)
                            .addTitle("2.1 Detailed Outcome Performance", 2)
                            .addTableWithComments(
                                outComeDetailedColumns,
                                outcomes,
                                extractOutcomeComments,
                            )
                            .addSpacing(3)
                            .addTitle(
                                "2.2 Detailed Intermediate Outcome Performance",
                                2,
                            )
                            .addTableWithComments(
                                intermediateOutcomeDetailedColumns,
                                intermediateOutcomes,
                                extractIntermediateOutcomeComments,
                            )
                            .addSpacing(3)
                            .addTitle("2.3 Detailed Output Performance", 2)
                            .addTableWithComments(
                                outputDetailedColumns,
                                outputs,
                                extractOutputComments,
                            )
                            .addSpacing(3)
                            .addTitle(
                                "2.4 Detailed PIAP Actions Budget Performance",
                                2,
                            )
                            .addTableWithComments(
                                actionDetailedColumns,
                                actions,
                                extractActionComments,
                            )
                            .download("Vote_Flash_Report.pdf");
                    }}
                    icon={<DownloadOutlined />}
                >
                    Download PDF
                </Button>
                <Button
                    onClick={() => {
                        const builder = new ExcelBuilder({
                            title: "Consolidated Performance Report",
                            sheetName: "Consolidated Performance Report",
                        });

                        builder
                            .addSpacer(1)
                            .addTitle(
                                "SECTION 1.0 SUMMARY HIGHLIGHTS OF PERFORMANCE",
                                1,
                            )
                            .addTitle("1.1 Performance Scorecards", 2)
                            .addTitle("1.1.1 Overall Scorecard", 3)
                            .addTable(columns, finalData)
                            .addSpacer(3)
                            .addTitle("1.1.2 Budget Performance Scorecard", 3)
                            .addTable(budgetColumns, budgetData)
                            .addSpacer(3)
                            .addTitle("1.2 Summary Performance", 2)
                            .addTitle(
                                "1.2.1 Indicator Performance by Programme",
                                3,
                            )
                            .addTable(
                                programCompleteColumns,
                                processByPerformance({
                                    dataElements: programData,
                                    groupingBy: "UBWSASWdyfi",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacer(3)
                            .addTitle("1.2.2 Outcome Performance", 3)
                            .addTable(
                                outcomeCompleteColumns,
                                processByPerformance({
                                    dataElements: outcomes,
                                    groupingBy: "YlPvYLC4VfO",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacer(3)
                            .addTitle("1.2.3 Output Performance", 3)
                            .addTable(
                                outputCompleteColumns,
                                processByPerformance({
                                    dataElements: outputs,
                                    groupingBy: "AKzxCNn1zkQ",
                                    programs,
                                    pe,
                                    votes,
                                }),
                            )
                            .addSpacer(3)
                            .addTitle("SECTION 2.0 DETAILED PERFORMANCE", 1)
                            .addTitle("2.1 Detailed Outcome Performance", 2)
                            .addTableWithComments(
                                outComeDetailedColumns,
                                outcomes,
                                extractOutcomeComments,
                            )
                            .addSpacer(3)
                            .addTitle(
                                "2.2 Detailed Intermediate Outcome Performance",
                                2,
                            )
                            .addTableWithComments(
                                intermediateOutcomeDetailedColumns,
                                intermediateOutcomes,
                                extractIntermediateOutcomeComments,
                            )
                            .addSpacer(3)
                            .addTitle("2.3 Detailed Output Performance", 2)
                            .addTableWithComments(
                                outputDetailedColumns,
                                outputs,
                                extractOutputComments,
                            )
                            .addSpacer(3)
                            .addTitle(
                                "2.4 Detailed PIAP Actions Budget Performance",
                                2,
                            )
                            .addTableWithComments(
                                actionDetailedColumns,
                                actions,
                                extractActionComments,
                            )
                            .download("Vote_Flash_Report.xlsx");
                    }}
                    icon={<DownloadOutlined />}
                >
                    Download Excel
                </Button>
            </Flex>
            <Typography.Title level={2} style={{ margin: 0 }}>
                SECTION 1.0 SUMMARY HIGHLIGHTS OF PERFORMANCE
            </Typography.Title>
            <Typography.Title level={3} style={{ margin: 0 }}>
                1.1 Performance Scorecards
            </Typography.Title>
            <Typography.Title level={4} style={{ margin: 0 }}>
                1.1.1 Overall Scorecard
            </Typography.Title>
            <Table
                columns={columns}
                dataSource={finalData}
                rowKey="UBWSASWdyfi"
                bordered={true}
                tableLayout="auto"
                pagination={false}
                size="small"
                // onChange={handleChange}
            />

            <Typography.Title level={4} style={{ margin: 0 }}>
                1.1.2 Budget Performance Scorecard
            </Typography.Title>

            <Table
                columns={budgetColumns}
                dataSource={budgetData}
                rowKey="orgUnit"
                bordered={true}
                sticky={true}
                pagination={false}
                size="small"
                // onChange={handleChange}
            />
            <Typography.Title level={3} style={{ margin: 0 }}>
                1.2 Summary Performance
            </Typography.Title>
            <Typography.Title level={4} style={{ margin: 0 }}>
                1.2.1 Indicator Performance by Programme
            </Typography.Title>

            <Performance
                data={programData}
                groupingBy="UBWSASWdyfi"
                initialColumns={programColumns}
                pe={pe ?? ""}
                showDownload={false}
            />
            <Typography.Title level={4} style={{ margin: 0 }}>
                1.2.2 Outcome Performance
            </Typography.Title>

            <Performance
                data={outcomes}
                groupingBy="YlPvYLC4VfO"
                initialColumns={outcomeColumns}
                pe={pe ?? ""}
                showDownload={false}
            />
            <Typography.Title level={4} style={{ margin: 0 }}>
                1.2.3 Output Performance
            </Typography.Title>

            <Performance
                data={outputs}
                groupingBy="AKzxCNn1zkQ"
                initialColumns={outputColumns}
                pe={pe ?? ""}
                showDownload={false}
            />
            <Typography.Title level={4} style={{ margin: 0 }}>
                1.2.4 Actions Budget Performance
            </Typography.Title>

            <Typography.Title level={2} style={{ margin: 0 }}>
                SECTION 2.0 DETAILED PERFORMANCE
            </Typography.Title>
            <Typography.Title level={3} style={{ margin: 0 }}>
                2.1 Detailed Outcome Performance
            </Typography.Title>
            <Table {...outcomeTableProps} />
            <Typography.Title level={3} style={{ margin: 0 }}>
                2.2 Detailed Intermediate Outcome Performance
            </Typography.Title>
            <Table {...intermediateOutcomeTableProps} />
            <Typography.Title level={3} style={{ margin: 0 }}>
                2.3 Detailed Output Performance
            </Typography.Title>
            <Table {...outputTableProps} />
            <Typography.Title level={3} style={{ margin: 0 }}>
                2.4 Detailed PIAP Actions Budget Performance
            </Typography.Title>
            <Table {...actionTableProps} />
        </Flex>
    );
}
