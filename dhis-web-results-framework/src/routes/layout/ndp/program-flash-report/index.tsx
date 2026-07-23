import { DownloadOutlined } from "@ant-design/icons";
import { createFixedPeriodFromPeriodId } from "@dhis2/multi-calendar-dates";
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
import { groupBy, orderBy } from "lodash";
import React, { useCallback, useMemo } from "react";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { AnalyticsData, Dx, Option } from "../../../../types";
import {
    calculatePerformanceRatio,
    createPerformanceColumns,
    findBackground,
    PERFORMANCE_COLORS,
    performanceLegendItems,
} from "../../../../utils";
import {
    applySortOrderToColumns,
    normalizeSorterField,
    sortRowsByColumn,
} from "../../../../utils/table-sort";
import { RootRoute } from "../../../__root";
import { ProgramFlashReportRoute } from "./route";
import { ExcelBuilder } from "../../../../excel-builder";
import { PDFBuilder } from "../../../../pdf-builder";

const fullQuarters = {
    3: "Q1",
    4: "Q2",
    1: "Q3",
    2: "Q4",
} as const;
const regularQuarterOrder = [3, 4, 1, 2] as const;
type VoteMetadata = { id: string; name: string; code?: string };
type QuarterDetail = { period: string; quarterLabel: string };
const REPORT_COLORS = {
    section: "#173d7a",
    tableHeader: "#d8e3f5",
    achieved: PERFORMANCE_COLORS.green.bg,
    moderate: PERFORMANCE_COLORS.yellow.bg,
    notAchieved: PERFORMANCE_COLORS.red.bg,
    noData: PERFORMANCE_COLORS.gray.bg,
    composite: "#f4a0a0",
};
const reportPercentFormatter = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
const reportNumberFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const indicatorLegendItems = [
    "A = Achieved",
    "M = Moderately Achieved",
    "N = Not Achieved",
    "ND = No Data",
    "% A = Percentage Achieved",
    "% M = Percentage Moderately Achieved",
    "% N = Percentage Not Achieved",
    "% ND = Percentage No Data",
] as const;
const actionLegendItems = [
    "BP = Budget Planned",
    "BA = Budget Approved",
    "BR = Budget Released",
    "BS = Budget Spent",
    "% = Percentage of Released Budget Spent",
] as const;

function getQuarterDetails(pe: string): QuarterDetail[] {
    const year = Number(pe.slice(0, 4));
    return regularQuarterOrder.map((quarter) => {
        const currentYear = quarter === 1 || quarter === 2 ? year : year + 1;
        const period = `${currentYear}${fullQuarters[quarter]}`;
        return {
            period,
            quarterLabel: fullQuarters[quarter],
        };
    });
}

function buildQuarterNarratives({
    rows,
    quarterDetails,
    voteMap,
}: {
    rows: AnalyticsData[];
    quarterDetails: QuarterDetail[];
    voteMap?: Map<string, VoteMetadata>;
}) {
    return quarterDetails.map(({ period, quarterLabel }) => {
        const comments = rows
            .map((row) => {
                const comment = String(row[`${period}comment`] ?? "").trim();
                if (!comment) {
                    return undefined;
                }
                if (!voteMap) {
                    return comment;
                }
                const vote = voteMap.get(String(row.orgUnit ?? row.ou ?? ""));
                const voteLabel =
                    vote?.name ||
                    formatVoteCode(String(vote?.code ?? "")) ||
                    String(row.orgUnit ?? row.ou ?? "");
                return `${voteLabel}: ${comment}`;
            })
            .filter(
                (comment): comment is string =>
                    typeof comment === "string" && comment.length > 0,
            );

        return {
            period,
            quarterLabel,
            text: Array.from(new Set(comments)).join("\r"),
        };
    });
}

function buildPeriodNarrative({
    rows,
    period,
    voteMap,
}: {
    rows: AnalyticsData[];
    period: string;
    voteMap?: Map<string, VoteMetadata>;
}) {
    const comments = rows
        .map((row) => {
            const comment = String(row[`${period}comment`] ?? "").trim();
            if (!comment) {
                return undefined;
            }
            if (!voteMap) {
                return comment;
            }
            const vote = voteMap.get(String(row.orgUnit ?? row.ou ?? ""));
            const voteLabel =
                vote?.name ||
                formatVoteCode(String(vote?.code ?? "")) ||
                String(row.orgUnit ?? row.ou ?? "");
            return `${voteLabel}: ${comment}`;
        })
        .filter(
            (comment): comment is string =>
                typeof comment === "string" && comment.length > 0,
        );

    return Array.from(new Set(comments)).join("\r");
}

function buildNarrativeDescriptionItems(
    record: AnalyticsData,
    quarterDetails: QuarterDetail[],
) {
    return quarterDetails.flatMap(({ period, quarterLabel }) => {
        const comment = String(record[`${period}comment`] ?? "").trim();
        if (!comment) {
            return [];
        }
        return [
            {
                label: quarterLabel,
                children: comment,
                key: `${record.id ?? record.key ?? record.name ?? "row"}-${period}`,
            },
        ];
    });
}

function extractQuarterNarrativeText(
    record: AnalyticsData,
    quarterDetails: QuarterDetail[],
) {
    const comments = quarterDetails.flatMap(({ period, quarterLabel }) => {
        const comment = String(record[`${period}comment`] ?? "").trim();
        if (!comment) {
            return [];
        }
        return [`${quarterLabel}: ${comment}\r`];
    });

    return comments.length > 0 ? comments.join("") : null;
}

function buildNarrativeExpandableConfig(quarterDetails: QuarterDetail[]) {
    return {
        showExpandColumn: true,
        columnWidth: 56,
        expandRowByClick: true,
        expandedRowRender: (record: AnalyticsData) => (
            <Descriptions
                size="small"
                column={1}
                items={buildNarrativeDescriptionItems(record, quarterDetails)}
            />
        ),
        rowExpandable: (record: AnalyticsData) =>
            quarterDetails.some(
                ({ period }) =>
                    String(record[`${period}comment`] ?? "").trim().length > 0,
            ),
    } satisfies NonNullable<TableProps<AnalyticsData>["expandable"]>;
}

function buildSummaryNarrativeExpandableConfig(periodLabel: string) {
    return {
        showExpandColumn: true,
        columnWidth: 56,
        expandRowByClick: true,
        expandedRowRender: (record: AnalyticsData) => {
            const comment = String(record.summaryComment ?? "").trim();
            if (!comment) {
                return null;
            }
            return (
                <Descriptions
                    size="small"
                    column={1}
                    items={[
                        {
                            key: `${record.key ?? record.id ?? "row"}-summary-comment`,
                            label: periodLabel,
                            children: comment,
                        },
                    ]}
                />
            );
        },
        rowExpandable: (record: AnalyticsData) =>
            String(record.summaryComment ?? "").trim().length > 0,
    } satisfies NonNullable<TableProps<AnalyticsData>["expandable"]>;
}

function getStatusColumnHeaderStyle(color: string) {
    return {
        style: {
            backgroundColor: color,
            color: "#000000",
        },
    };
}

function getStatusColumnCellStyle(color: string) {
    return {
        style: {
            backgroundColor: color,
            color: "#000000",
        },
    };
}

function getConditionalStatusColumnCellStyle(
    value: unknown,
    color: string,
    emptyColor: string = "#ffffff",
) {
    const numericValue =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number(value.replace("%", ""))
              : Number.NaN;

    return {
        style: {
            backgroundColor:
                Number.isFinite(numericValue) && numericValue > 0
                    ? color
                    : emptyColor,
            color: "#000000",
        },
    };
}

function renderLegendRow(items: readonly string[]) {
    return (
        <Typography.Title
            level={4}
            style={{ margin: 0, color: REPORT_COLORS.section }}
        >
            <Flex wrap gap={24}>
                {items.map((item) => (
                    <span key={item}>{item}</span>
                ))}
            </Flex>
        </Typography.Title>
    );
}

function hasProgrammePerformanceData(value: unknown) {
    return typeof value === "number" && value > 0;
}

export const ProgramFlashReportIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ProgramFlashReportRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { engine } = ProgramFlashReportRoute.useRouteContext();
    const {
        categories,
        programs,
        votes,
        allOptionsMap,
        configurations,
        ou: defaultOrgUnit,
    } = RootRoute.useLoaderData();
    const { v, pe = "", program } = ProgramFlashReportRoute.useSearch();
    const baselinePe = configurations[v ?? ""]?.data?.baseline ?? "";
    const summaryPeriodIds = useMemo(
        () => Array.from(new Set([baselinePe, pe].filter(Boolean))),
        [baselinePe, pe],
    );

    const selectedProgram = programs.find(({ code }) => code === program);
    const voteMap = useMemo(
        () => new Map(votes.map((vote) => [vote.id, vote])),
        [votes],
    );
    const quarterDetails = useMemo(() => getQuarterDetails(pe), [pe]);
    const programmeRootOrgUnitId = useMemo(
        () => deriveCommonRootOrgUnitId(votes) ?? defaultOrgUnit ?? "",
        [defaultOrgUnit, votes],
    );
    const voteLevel = useMemo(() => deriveVoteLevel(votes), [votes]);
    const [scorecardSortState, setScorecardSortState] = React.useState<{
        overall: { field?: string; order?: "ascend" | "descend" };
        budget: { field?: string; order?: "ascend" | "descend" };
    }>({
        overall: {},
        budget: {},
    });
    const [byVoteSortState, setByVoteSortState] = React.useState<{
        outcome: { field?: string; order?: "ascend" | "descend" };
        intermediateOutcome: { field?: string; order?: "ascend" | "descend" };
        output: { field?: string; order?: "ascend" | "descend" };
        action: { field?: string; order?: "ascend" | "descend" };
    }>({
        outcome: {},
        intermediateOutcome: {},
        output: {},
        action: {},
    });

    const regularSearch = useMemo(
        () => ({
            pe: summaryPeriodIds,
            ou: programmeRootOrgUnitId,
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            quarters: true,
            program,
            requiresProgram: true,
        }),
        [categories, programmeRootOrgUnitId, program, summaryPeriodIds],
    );
    const budgetSearch = useMemo(
        () => ({
            pe: [pe],
            ou: programmeRootOrgUnitId,
            category: "kfnptfEdnYl",
            categoryOptions: categories.get("kfnptfEdnYl") || [],
            quarters: true,
            program,
            requiresProgram: true,
        }),
        [categories, pe, program, programmeRootOrgUnitId],
    );

    const {
        data: outputs,
        dimensions: outputDimensions,
        items: outputItems,
    } = useAnalyticsQuery({
        engine,
        search: regularSearch,
        ndpVersion: v,
        attributeValue: "output",
        specificLevel: voteLevel,
        ouIsFilter: false,
    });

    const {
        data: outcomes,
        dimensions: outcomeDimensions,
        items: outcomeItems,
    } = useAnalyticsQuery({
        engine,
        search: regularSearch,
        ndpVersion: v,
        attributeValue: "outcome",
        specificLevel: voteLevel,
        ouIsFilter: false,
    });

    const {
        data: intermediateOutcomes,
        dimensions: intermediateOutcomeDimensions,
        items: intermediateOutcomeItems,
    } = useAnalyticsQuery({
        engine,
        search: regularSearch,
        ndpVersion: v,
        attributeValue: "intermediateOutcome",
        specificLevel: voteLevel,
        ouIsFilter: false,
    });

    const {
        data: actions,
        dimensions: actionDimensions,
        items: actionItems,
    } = useAnalyticsQuery({
        engine,
        search: budgetSearch,
        ndpVersion: v,
        attributeValue: "action",
        specificLevel: voteLevel,
        ouIsFilter: false,
    });

    const outcomePerformanceByVote = useMemo(
        () =>
            buildProgrammePerformanceSummaryRows({
                dataElements: outcomes,
                pe,
                voteMap,
                overallLabel: "Programme Overall",
            }),
        [outcomes, pe, voteMap],
    );
    const intermediateOutcomePerformanceByVote = useMemo(
        () =>
            buildProgrammePerformanceSummaryRows({
                dataElements: intermediateOutcomes,
                pe,
                voteMap,
                overallLabel: "Programme Overall",
            }),
        [intermediateOutcomes, pe, voteMap],
    );
    const outputPerformanceByVote = useMemo(
        () =>
            buildProgrammePerformanceSummaryRows({
                dataElements: outputs,
                pe,
                voteMap,
                overallLabel: "Programme Overall",
            }),
        [outputs, pe, voteMap],
    );
    const budgetScorecardRows = useMemo(
        () =>
            buildBudgetScorecardRows({
                dataElements: actions,
                pe,
                voteMap,
                overallLabel: "Programme Overall",
                categoryOptions: categories.get("kfnptfEdnYl") || [],
            }),
        [actions, categories, pe, voteMap],
    );
    const baselinePeriodLabel = useMemo(() => formatPeriodLabel(baselinePe), [
        baselinePe,
    ]);
    const currentPeriodLabel = useMemo(() => formatPeriodLabel(pe), [pe]);

    const actionPerformanceByVoteRows = useMemo(
        () =>
            buildActionPerformanceByVoteRows({
                dataElements: actions,
                pe,
                voteMap,
                categoryOptions: categories.get("kfnptfEdnYl") || [],
                overallLabel: "Programme Overall",
            }),
        [actions, categories, pe, voteMap],
    );

    const overallScorecardRows = useMemo(
        () =>
            buildOverallScorecardRows({
                pe,
                outcomes,
                outputs,
                actions,
                voteMap,
                overallLabel: "Programme Overall",
            }),
        [actions, outcomes, outputs, pe, voteMap],
    );
    const outcomeSummaryRows = useMemo(
        () =>
            buildSummaryPerformanceRows({
                rows: outcomes,
                baselinePe,
                currentPe: pe,
                currentPeriodLabel,
                quarterDetails,
                allOptionsMap,
                rowType: "outcome",
                voteMap,
            }),
        [
            allOptionsMap,
            baselinePe,
            currentPeriodLabel,
            outcomes,
            pe,
            quarterDetails,
            voteMap,
        ],
    );
    const intermediateOutcomeSummaryRows = useMemo(
        () =>
            buildSummaryPerformanceRows({
                rows: intermediateOutcomes,
                baselinePe,
                currentPe: pe,
                currentPeriodLabel,
                quarterDetails,
                allOptionsMap,
                rowType: "intermediateOutcome",
                voteMap,
            }),
        [
            allOptionsMap,
            baselinePe,
            currentPeriodLabel,
            intermediateOutcomes,
            pe,
            quarterDetails,
            voteMap,
        ],
    );
    const outputSummaryRows = useMemo(
        () =>
            buildSummaryPerformanceRows({
                rows: outputs,
                baselinePe,
                currentPe: pe,
                currentPeriodLabel,
                quarterDetails,
                allOptionsMap,
                rowType: "output",
                voteMap,
            }),
        [
            allOptionsMap,
            baselinePe,
            currentPeriodLabel,
            outputs,
            pe,
            quarterDetails,
            voteMap,
        ],
    );
    const performanceLegendColumns = useMemo(
        () => buildPerformanceLegendExportColumns(),
        [],
    );
    const performanceLegendData = useMemo(() => [], []);
    const measurementGuideColumns = useMemo(() => buildMeasurementGuideColumns(), []);
    const measurementGuideData = useMemo(() => buildMeasurementGuideData(), []);

    const voteColumns = useMemo<TableProps<AnalyticsData>["columns"]>(
        () => [
            {
                title: "Code",
                dataIndex: "code",
                key: "code",
                align: "center",
                sorter: true,
                width: 150,
                render: (value: string) => formatVoteCode(value),
            },
            {
                title: "Description",
                dataIndex: "name",
                key: "name",
                sorter: true,
            },
        ],
        [],
    );

    const overallScorecardColumns: TableProps<
        (typeof overallScorecardRows)[number]
    >["columns"] = useMemo(
        () => [
            {
                title: "Code",
                dataIndex: "code",
                key: "code",
                align: "center",
                sorter: true,
                width: 110,
                render: (value: string) => formatVoteCode(value),
            },
            {
                title: "Description",
                dataIndex: "name",
                key: "name",
                sorter: true,
                width: 280,
            },
            {
                title: "Absorption Rate (%)",
                dataIndex: "absorptionRate",
                key: "absorptionRate",
                width: 180,
                align: "center",
                sorter: true,
                render: (_, record) =>
                    formatReportPercent(record.absorptionRate ?? 0),
                onCell: (record) => ({
                    style: hasProgrammePerformanceData(
                        record.approvedAllocation,
                    )
                        ? getProgrammeCellStyle(record.absorptionRate ?? 0)
                        : getStatusColumnCellStyle(REPORT_COLORS.noData).style,
                }),
            },
            {
                title: "Output Performance (%)",
                dataIndex: "outputPerformance",
                width: 180,
                key: "outputPerformance",
                align: "center",
                sorter: true,
                render: (_, record) =>
                    formatReportPercent(record.outputPerformance ?? 0),
                onCell: (record) => ({
                    style:
                        (record.total ?? 0) > 0 &&
                        (record.noData ?? 0) < (record.total ?? 0)
                            ? getProgrammeCellStyle(
                                  record.outputPerformance ?? 0,
                              )
                            : getStatusColumnCellStyle(REPORT_COLORS.noData)
                                  .style,
                }),
            },
            {
                title: "Outcome Performance (%)",
                dataIndex: "outcomePerformance",
                key: "outcomePerformance",
                width: 180,
                align: "center",
                sorter: true,
                render: (_, record) =>
                    formatReportPercent(record.outcomePerformance ?? 0),
                onCell: (record) => ({
                    style:
                        (record.total ?? 0) > 0 &&
                        (record.noData ?? 0) < (record.total ?? 0)
                            ? getProgrammeCellStyle(
                                  record.outcomePerformance ?? 0,
                              )
                            : getStatusColumnCellStyle(REPORT_COLORS.noData)
                                  .style,
                }),
            },
            {
                title: "Composite Score (%)",
                dataIndex: "overallScore",
                key: "overallScore",
                align: "center",
                width: 180,
                sorter: true,
                render: (_, record) =>
                    formatReportPercent(record.overallScore ?? 0),
                onCell: (record) => ({
                    style:
                        hasProgrammePerformanceData(record.approvedAllocation) ||
                        ((record.total ?? 0) > 0 &&
                            (record.noData ?? 0) < (record.total ?? 0))
                            ? getProgrammeCellStyle(record.overallScore ?? 0)
                            : getStatusColumnCellStyle(REPORT_COLORS.noData)
                                  .style,
                }),
            },
        ],
        [],
    );

    const budgetScorecardColumns: TableProps<AnalyticsData>["columns"] =
        useMemo(
            () => [
                ...(voteColumns ?? []),
                {
                    title: "Planned Budget (Ugx Bn)",
                    dataIndex: "baseline",
                    key: "baseline",
                    width: 160,
                    align: "center",
                    sorter: true,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "Approved Budget (Ugx Bn)",
                    dataIndex: "approved",
                    key: "approved",
                    width: 160,
                    align: "center",
                    sorter: true,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "Release (Ugx Bn)",
                    dataIndex: "target",
                    key: "target",
                    width: 160,
                    align: "center",
                    sorter: true,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "Spent (Ugx Bn)",
                    dataIndex: "actual",
                    key: "actual",
                    width: 160,
                    align: "center",
                    sorter: true,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "% Budget Released",
                    key: "allocation",
                    dataIndex: "allocation",
                    width: 160,
                    align: "center",
                    sorter: true,
                },
                {
                    title: "% Release Spent",
                    key: "spend",
                    dataIndex: "spend",
                    align: "center",
                    width: 160,
                    sorter: true,
                },
            ],
            [voteColumns],
        );
    const sortedOverallScorecardRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: overallScorecardRows,
                columns: overallScorecardColumns,
                sortField: scorecardSortState.overall.field,
                sortOrder: scorecardSortState.overall.order,
            }),
        [
            overallScorecardColumns,
            overallScorecardRows,
            scorecardSortState.overall.field,
            scorecardSortState.overall.order,
        ],
    );
    const sortedBudgetScorecardRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: budgetScorecardRows,
                columns: budgetScorecardColumns,
                sortField: scorecardSortState.budget.field,
                sortOrder: scorecardSortState.budget.order,
            }),
        [
            budgetScorecardColumns,
            budgetScorecardRows,
            scorecardSortState.budget.field,
            scorecardSortState.budget.order,
        ],
    );
    const sortedOverallScorecardColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: overallScorecardColumns,
                sortField: scorecardSortState.overall.field,
                sortOrder: scorecardSortState.overall.order,
            }),
        [
            overallScorecardColumns,
            scorecardSortState.overall.field,
            scorecardSortState.overall.order,
        ],
    );
    const sortedBudgetScorecardColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: budgetScorecardColumns,
                sortField: scorecardSortState.budget.field,
                sortOrder: scorecardSortState.budget.order,
            }),
        [
            budgetScorecardColumns,
            scorecardSortState.budget.field,
            scorecardSortState.budget.order,
        ],
    );
    const summaryPerformanceColumns = useMemo<
        TableProps<AnalyticsData>["columns"]
    >(
        () =>
            buildSummaryPerformanceColumns({
                baselinePeriodLabel,
                currentPeriodLabel,
            }),
        [baselinePeriodLabel, currentPeriodLabel],
    );
    const handleScorecardTableChange = useCallback(
        (tableKey: "overall" | "budget"): TableProps<AnalyticsData>["onChange"] =>
            (_pagination, _filters, sorter) => {
                if (Array.isArray(sorter)) {
                    return;
                }

                const field = normalizeSorterField(
                    sorter.field ?? sorter.columnKey,
                );

                setScorecardSortState((previous) => ({
                    ...previous,
                    [tableKey]:
                        !field || !sorter.order
                            ? {}
                            : {
                                  field,
                                  order:
                                      sorter.order === "descend"
                                          ? "descend"
                                          : "ascend",
                              },
                }));
            },
        [],
    );
    const handleByVoteTableChange = useCallback(
        (
            tableKey:
                | "outcome"
                | "intermediateOutcome"
                | "output"
                | "action",
        ): TableProps<AnalyticsData>["onChange"] =>
            (_pagination, _filters, sorter) => {
                if (Array.isArray(sorter)) {
                    return;
                }

                const field = normalizeSorterField(
                    sorter.field ?? sorter.columnKey,
                );

                setByVoteSortState((previous) => ({
                    ...previous,
                    [tableKey]:
                        !field || !sorter.order
                            ? {}
                            : {
                                  field,
                                  order:
                                      sorter.order === "descend"
                                          ? "descend"
                                          : "ascend",
                              },
                }));
            },
        [],
    );

    const actionPerformanceByVoteColumns = useMemo<
        TableProps<AnalyticsData>["columns"]
    >(
        () => [
            ...(voteColumns ?? []),
            {
                title: "No. of Actions",
                dataIndex: "totalActions",
                key: "totalActions",
                align: "center",
                width: 140,
            },
            {
                title: "BP",
                dataIndex: "plannedBudget",
                key: "plannedBudget",
                align: "center",
                width: 120,
                render: (value: unknown) => formatReportNumberish(value),
            },
            {
                title: "BA",
                dataIndex: "approvedBudget",
                key: "approvedBudget",
                align: "center",
                width: 120,
                render: (value: unknown) => formatReportNumberish(value),
            },
            ...buildBudgetQuarterColumns(pe),
        ],
        [pe, voteColumns],
    );

    const performanceColumns: TableProps<AnalyticsData>["columns"] = useMemo(
        () => [
            {
                title: "No of Indicators",
                dataIndex: "total",
                key: "total",
                width: 180,
                align: "center",
                render: (_, record) => record.total ?? "",
                sorter: true,
            },
            {
                title: "A",
                dataIndex: "achieved",
                key: "achieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.achieved),
                sorter: true,
            },
            {
                title: "M",
                dataIndex: "moderatelyAchieved",
                key: "moderatelyAchieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.moderate),
                sorter: true,
            },
            {
                title: "N",
                dataIndex: "notAchieved",
                key: "notAchieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.notAchieved),
                sorter: true,
            },
            {
                title: "ND",
                dataIndex: "noData",
                key: "noData",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.noData),
                sorter: true,
            },
            {
                title: "% A",
                dataIndex: "percentAchieved",
                key: "percentAchieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.achieved),
                onCell: (record) =>
                    getConditionalStatusColumnCellStyle(
                        record.percentAchieved,
                        REPORT_COLORS.achieved,
                    ),
                sorter: true,
            },
            {
                title: "% M",
                dataIndex: "percentModeratelyAchieved",
                key: "percentModeratelyAchieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.moderate),
                onCell: (record) =>
                    getConditionalStatusColumnCellStyle(
                        record.percentModeratelyAchieved,
                        REPORT_COLORS.moderate,
                    ),
                sorter: true,
            },
            {
                title: "% N",
                dataIndex: "percentNotAchieved",
                key: "percentNotAchieved",
                width: 100,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.notAchieved),
                onCell: (record) =>
                    getConditionalStatusColumnCellStyle(
                        record.percentNotAchieved,
                        REPORT_COLORS.notAchieved,
                    ),
                sorter: true,
            },
            {
                title: "% ND",
                dataIndex: "percentNoData",
                key: "percentNoData",
                width: 110,
                align: "center",
                onHeaderCell: () =>
                    getStatusColumnHeaderStyle(REPORT_COLORS.noData),
                onCell: (record) =>
                    getConditionalStatusColumnCellStyle(
                        record.percentNoData,
                        REPORT_COLORS.noData,
                    ),
                sorter: true,
            },
        ],
        [],
    );

    const indicatorPerformanceColumns = useMemo(
        () => (voteColumns ?? []).concat(performanceColumns),
        [performanceColumns, voteColumns],
    );
    const sortedOutcomePerformanceByVoteRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: outcomePerformanceByVote,
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.outcome.field,
                sortOrder: byVoteSortState.outcome.order,
            }),
        [
            byVoteSortState.outcome.field,
            byVoteSortState.outcome.order,
            indicatorPerformanceColumns,
            outcomePerformanceByVote,
        ],
    );
    const sortedIntermediateOutcomePerformanceByVoteRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: intermediateOutcomePerformanceByVote,
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.intermediateOutcome.field,
                sortOrder: byVoteSortState.intermediateOutcome.order,
            }),
        [
            byVoteSortState.intermediateOutcome.field,
            byVoteSortState.intermediateOutcome.order,
            indicatorPerformanceColumns,
            intermediateOutcomePerformanceByVote,
        ],
    );
    const sortedOutputPerformanceByVoteRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: outputPerformanceByVote,
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.output.field,
                sortOrder: byVoteSortState.output.order,
            }),
        [
            byVoteSortState.output.field,
            byVoteSortState.output.order,
            indicatorPerformanceColumns,
            outputPerformanceByVote,
        ],
    );
    const sortedActionPerformanceByVoteRows = useMemo(
        () =>
            sortRowsByColumn({
                rows: actionPerformanceByVoteRows as AnalyticsData[],
                columns: actionPerformanceByVoteColumns,
                sortField: byVoteSortState.action.field,
                sortOrder: byVoteSortState.action.order,
            }),
        [
            actionPerformanceByVoteColumns,
            actionPerformanceByVoteRows,
            byVoteSortState.action.field,
            byVoteSortState.action.order,
        ],
    );
    const sortedOutcomePerformanceByVoteColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.outcome.field,
                sortOrder: byVoteSortState.outcome.order,
            }),
        [
            byVoteSortState.outcome.field,
            byVoteSortState.outcome.order,
            indicatorPerformanceColumns,
        ],
    );
    const sortedIntermediateOutcomePerformanceByVoteColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.intermediateOutcome.field,
                sortOrder: byVoteSortState.intermediateOutcome.order,
            }),
        [
            byVoteSortState.intermediateOutcome.field,
            byVoteSortState.intermediateOutcome.order,
            indicatorPerformanceColumns,
        ],
    );
    const sortedOutputPerformanceByVoteColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: indicatorPerformanceColumns,
                sortField: byVoteSortState.output.field,
                sortOrder: byVoteSortState.output.order,
            }),
        [
            byVoteSortState.output.field,
            byVoteSortState.output.order,
            indicatorPerformanceColumns,
        ],
    );
    const sortedActionPerformanceByVoteColumns = useMemo(
        () =>
            applySortOrderToColumns({
                columns: actionPerformanceByVoteColumns,
                sortField: byVoteSortState.action.field,
                sortOrder: byVoteSortState.action.order,
            }),
        [
            actionPerformanceByVoteColumns,
            byVoteSortState.action.field,
            byVoteSortState.action.order,
        ],
    );

    const outcomeDetailedColumns = useMemo(
        () =>
            createPerformanceColumns({
                baseline: "",
                nameColumn: [
                    {
                        title: "Outcome Indicator",
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
            }),
        [categories, outcomeDimensions, outcomeItems, pe],
    );

    const intermediateOutcomeDetailedColumns = useMemo(
        () =>
            createPerformanceColumns({
                baseline: categories.get("Duw5yep8Vae")?.[0] || "",
                nameColumn: [
                    {
                        title: "Intermediate Outcome Indicator",
                        dataIndex: "name",
                        key: "name",
                    },
                ],
                items: intermediateOutcomeItems,
                nonBaseline: false,
                quarters: true,
                categoryOptions: categories.get("Duw5yep8Vae") || [],
                dimensions: intermediateOutcomeDimensions,
                pe: [pe],
            }),
        [categories, intermediateOutcomeDimensions, intermediateOutcomeItems, pe],
    );

    const outputDetailedColumns = useMemo(
        () =>
            createPerformanceColumns({
                baseline: categories.get("Duw5yep8Vae")?.[0] || "",
                nameColumn: [
                    {
                        title: "Output Indicator",
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
            }),
        [categories, outputDimensions, outputItems, pe],
    );

    const actionDetailedColumns = useMemo(
        () =>
            createPerformanceColumns({
                baseline: categories.get("kfnptfEdnYl")?.[0] || "",
                nameColumn: [
                    {
                        title: "Action",
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
            }),
        [actionDimensions, actionItems, categories, pe],
    );

    const outcomeDetailedData = useMemo(
        () =>
            aggregateProgrammeDetailedRows({
                rows: outcomes,
                pe,
                quarterDetails,
                voteMap,
                categoryOptions: categories.get("Duw5yep8Vae") || [],
                nonBaseline: false,
            }),
        [categories, outcomes, pe, quarterDetails, voteMap],
    );
    const intermediateOutcomeDetailedData = useMemo(
        () =>
            aggregateProgrammeDetailedRows({
                rows: intermediateOutcomes,
                pe,
                quarterDetails,
                voteMap,
                categoryOptions: categories.get("Duw5yep8Vae") || [],
                nonBaseline: false,
            }),
        [categories, intermediateOutcomes, pe, quarterDetails, voteMap],
    );
    const outputDetailedData = useMemo(
        () =>
            aggregateProgrammeDetailedRows({
                rows: outputs,
                pe,
                quarterDetails,
                voteMap,
                categoryOptions: categories.get("Duw5yep8Vae") || [],
                nonBaseline: false,
            }),
        [categories, outputs, pe, quarterDetails, voteMap],
    );
    const actionDetailedData = useMemo(
        () =>
            aggregateProgrammeDetailedRows({
                rows: actions,
                pe,
                quarterDetails,
                voteMap,
                categoryOptions: categories.get("kfnptfEdnYl") || [],
                nonBaseline: true,
            }),
        [actions, categories, pe, quarterDetails, voteMap],
    );

    const extractOutcomeComments = useCallback(
        (record: AnalyticsData) =>
            extractQuarterNarrativeText(record, quarterDetails),
        [quarterDetails],
    );

    const outcomeTableProps = useMemo(
        () =>
            buildDetailedTableProps({
                rows: outcomeDetailedData,
                columns: outcomeDetailedColumns,
                quarterDetails,
            }),
        [outcomeDetailedColumns, outcomeDetailedData, quarterDetails],
    );
    const intermediateOutcomeTableProps = useMemo(
        () =>
            buildDetailedTableProps({
                rows: intermediateOutcomeDetailedData,
                columns: intermediateOutcomeDetailedColumns,
                quarterDetails,
            }),
        [
            intermediateOutcomeDetailedColumns,
            intermediateOutcomeDetailedData,
            quarterDetails,
        ],
    );
    const outputTableProps = useMemo(
        () =>
            buildDetailedTableProps({
                rows: outputDetailedData,
                columns: outputDetailedColumns,
                quarterDetails,
            }),
        [outputDetailedColumns, outputDetailedData, quarterDetails],
    );
    const actionTableProps = useMemo(
        () =>
            buildDetailedTableProps({
                rows: actionDetailedData,
                columns: actionDetailedColumns,
                quarterDetails,
            }),
        [actionDetailedColumns, actionDetailedData, quarterDetails],
    );
    const outcomeSummaryTableProps = useMemo(
        () =>
            buildSummaryTableProps({
                rows: outcomeSummaryRows,
                columns: summaryPerformanceColumns,
                quarterDetails,
            }),
        [outcomeSummaryRows, quarterDetails, summaryPerformanceColumns],
    );
    const intermediateOutcomeSummaryTableProps = useMemo(
        () =>
            buildSummaryTableProps({
                rows: intermediateOutcomeSummaryRows,
                columns: summaryPerformanceColumns,
                quarterDetails,
            }),
        [
            intermediateOutcomeSummaryRows,
            quarterDetails,
            summaryPerformanceColumns,
        ],
    );
    const outputSummaryTableProps = useMemo(
        () =>
            buildSummaryTableProps({
                rows: outputSummaryRows,
                columns: summaryPerformanceColumns,
                quarterDetails,
            }),
        [outputSummaryRows, quarterDetails, summaryPerformanceColumns],
    );
    const handlePdfExport = useCallback(() => {
        const year = Number(pe.slice(0, 4));
        const financialYear = `Financial Year ${year}/${year + 1}`;
        const builder = new PDFBuilder({
            orientation: "landscape",
            coverPage: {
                image: "./ugx2.png",
                title: "Consolidated Program Performance Report",
                voteName: selectedProgram?.name || "",
                financialYear,
            },
        });

        builder
            .addTitle("SECTION 1.0 OVERVIEW OF PERFORMANCE", 1)
            .addTable(performanceLegendColumns, performanceLegendData)
            .addSpacing(2)
            .addTable(measurementGuideColumns, measurementGuideData)
            .addSpacing(3)
            .addTitle("1.1 Performance Scorecards", 2)
            .addTitle("1.1.1 Overall Programme Performance Scorecard", 3)
            .addTable(
                sortedOverallScorecardColumns,
                sortedOverallScorecardRows,
            )
            .addSpacing(3)
            .addTitle("1.2.1 Outcome Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedOutcomePerformanceByVoteColumns,
                sortedOutcomePerformanceByVoteRows,
            )
            .addSpacing(3)
            .addTitle("1.2.2 Intermediate Outcome Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedIntermediateOutcomePerformanceByVoteColumns,
                sortedIntermediateOutcomePerformanceByVoteRows,
            )
            .addSpacing(3)
            .addTitle("1.2.3 Output Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedOutputPerformanceByVoteColumns,
                sortedOutputPerformanceByVoteRows,
            )
            .addSpacing(3)
            .addTitle("1.2.4 Action (Budget) Performance by Vote", 3)
            .addTitle(actionLegendItems.join(" | "), 4)
            .addTable(
                sortedActionPerformanceByVoteColumns,
                sortedActionPerformanceByVoteRows,
            )
            .addSpacing(3)
            .addTitle("1.3 Summary Performance", 2)
            .addTitle("1.3.1 Summary Outcome Performance", 3)
            .addTable(summaryPerformanceColumns, outcomeSummaryRows)
            .addSpacing(3)
            .addTitle("1.3.2 Summary Intermediate Outcome Performance", 3)
            .addTable(summaryPerformanceColumns, intermediateOutcomeSummaryRows)
            .addSpacing(3)
            .addTitle("1.3.3 Summary Output Performance", 3)
            .addTable(summaryPerformanceColumns, outputSummaryRows)
            .addSpacing(3)
            .addTitle("1.3.4 Summary Actions (Budget) Performance Scorecard", 3)
            .addTable(
                sortedBudgetScorecardColumns,
                sortedBudgetScorecardRows,
            )
            .addSpacing(3)
            .addTitle("SECTION 3.0: DETAILED PERFORMANCE", 1)
            .addTitle("3.1.1 Detailed Outcome Performance", 2)
            .addTableWithComments(
                outcomeDetailedColumns,
                outcomeDetailedData,
                extractOutcomeComments,
            )
            .addSpacing(3)
            .addTitle("3.1.2 Detailed Intermediate Outcome Performance", 2)
            .addTableWithComments(
                intermediateOutcomeDetailedColumns,
                intermediateOutcomeDetailedData,
                extractOutcomeComments,
            )
            .addSpacing(3)
            .addTitle("3.1.3 Detailed Output Indicator Performance", 2)
            .addTableWithComments(
                outputDetailedColumns,
                outputDetailedData,
                extractOutcomeComments,
            )
            .addSpacing(3)
            .addTitle("3.1.4 Detailed Actions (Budget) Performance", 2)
            .addTitle(
                "BP = Budget Planned | BA = Budget Approved | BR = Budget Released | BS = Budget Spent",
                3,
            )
            .addTableWithComments(
                actionDetailedColumns,
                actionDetailedData,
                extractOutcomeComments,
            )
            .download("Program_Flash_Report.pdf");
    }, [
        actionPerformanceByVoteColumns,
        actionPerformanceByVoteRows,
        actionDetailedColumns,
        actionDetailedData,
        byVoteSortState.action.field,
        byVoteSortState.action.order,
        byVoteSortState.intermediateOutcome.field,
        byVoteSortState.intermediateOutcome.order,
        byVoteSortState.outcome.field,
        byVoteSortState.outcome.order,
        byVoteSortState.output.field,
        byVoteSortState.output.order,
        budgetScorecardColumns,
        budgetScorecardRows,
        extractOutcomeComments,
        indicatorPerformanceColumns,
        measurementGuideColumns,
        measurementGuideData,
        intermediateOutcomePerformanceByVote,
        intermediateOutcomeDetailedColumns,
        intermediateOutcomeDetailedData,
        intermediateOutcomeSummaryRows,
        outcomeDetailedColumns,
        outcomeDetailedData,
        outcomePerformanceByVote,
        outcomeSummaryRows,
        outputDetailedColumns,
        outputDetailedData,
        outputPerformanceByVote,
        outputSummaryRows,
        overallScorecardColumns,
        overallScorecardRows,
        pe,
        performanceLegendColumns,
        performanceLegendData,
        selectedProgram,
        sortedActionPerformanceByVoteColumns,
        sortedActionPerformanceByVoteRows,
        sortedIntermediateOutcomePerformanceByVoteColumns,
        sortedIntermediateOutcomePerformanceByVoteRows,
        sortedOutcomePerformanceByVoteColumns,
        sortedOutcomePerformanceByVoteRows,
        sortedOutputPerformanceByVoteColumns,
        sortedOutputPerformanceByVoteRows,
        summaryPerformanceColumns,
    ]);

    const handleExcelExport = useCallback(() => {
        const builder = new ExcelBuilder({
            title: "Consolidated Program Performance Report",
            sheetName: "Program Performance Report",
        });

        builder
            .addSpacer(1)
            .addTitle("SECTION 1.0 OVERVIEW OF PERFORMANCE", 1)
            .addTable(performanceLegendColumns, performanceLegendData)
            .addSpacer(2)
            .addTable(measurementGuideColumns, measurementGuideData)
            .addSpacer(3)
            .addTitle("1.1 Performance Scorecards", 2)
            .addTitle("1.1.1 Overall Programme Performance Scorecard", 3)
            .addTable(
                sortedOverallScorecardColumns,
                sortedOverallScorecardRows,
            )
            .addSpacer(3)
            .addTitle("1.2.1 Outcome Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedOutcomePerformanceByVoteColumns,
                sortedOutcomePerformanceByVoteRows,
            )
            .addSpacer(3)
            .addTitle("1.2.2 Intermediate Outcome Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedIntermediateOutcomePerformanceByVoteColumns,
                sortedIntermediateOutcomePerformanceByVoteRows,
            )
            .addSpacer(3)
            .addTitle("1.2.3 Output Performance by Vote", 3)
            .addTitle(indicatorLegendItems.join(" | "), 4)
            .addTable(
                sortedOutputPerformanceByVoteColumns,
                sortedOutputPerformanceByVoteRows,
            )
            .addSpacer(3)
            .addTitle("1.2.4 Action (Budget) Performance by Vote", 3)
            .addTitle(actionLegendItems.join(" | "), 4)
            .addTable(
                sortedActionPerformanceByVoteColumns,
                sortedActionPerformanceByVoteRows,
            )
            .addSpacer(3)
            .addTitle("1.3 Summary Performance", 2)
            .addTitle("1.3.1 Summary Outcome Performance", 3)
            .addTable(summaryPerformanceColumns, outcomeSummaryRows)
            .addSpacer(3)
            .addTitle("1.3.2 Summary Intermediate Outcome Performance", 3)
            .addTable(summaryPerformanceColumns, intermediateOutcomeSummaryRows)
            .addSpacer(3)
            .addTitle("1.3.3 Summary Output Performance", 3)
            .addTable(summaryPerformanceColumns, outputSummaryRows)
            .addSpacer(3)
            .addTitle("1.3.4 Summary Actions (Budget) Performance Scorecard", 3)
            .addTable(
                sortedBudgetScorecardColumns,
                sortedBudgetScorecardRows,
            )
            .addSpacer(3)
            .addTitle("SECTION 3.0: DETAILED PERFORMANCE", 1)
            .addTitle("3.1.1 Detailed Outcome Performance", 2)
            .addTableWithComments(
                outcomeDetailedColumns,
                outcomeDetailedData,
                extractOutcomeComments,
            )
            .addSpacer(3)
            .addTitle("3.1.2 Detailed Intermediate Outcome Performance", 2)
            .addTableWithComments(
                intermediateOutcomeDetailedColumns,
                intermediateOutcomeDetailedData,
                extractOutcomeComments,
            )
            .addSpacer(3)
            .addTitle("3.1.3 Detailed Output Indicator Performance", 2)
            .addTableWithComments(
                outputDetailedColumns,
                outputDetailedData,
                extractOutcomeComments,
            )
            .addSpacer(3)
            .addTitle("3.1.4 Detailed Actions (Budget) Performance", 2)
            .addTitle(
                "BP = Budget Planned | BA = Budget Approved | BR = Budget Released | BS = Budget Spent",
                3,
            )
            .addTableWithComments(
                actionDetailedColumns,
                actionDetailedData,
                extractOutcomeComments,
            )
            .download("Program_Flash_Report.xlsx");
    }, [
        actionPerformanceByVoteColumns,
        actionPerformanceByVoteRows,
        actionDetailedColumns,
        actionDetailedData,
        byVoteSortState.action.field,
        byVoteSortState.action.order,
        byVoteSortState.intermediateOutcome.field,
        byVoteSortState.intermediateOutcome.order,
        byVoteSortState.outcome.field,
        byVoteSortState.outcome.order,
        byVoteSortState.output.field,
        byVoteSortState.output.order,
        budgetScorecardColumns,
        budgetScorecardRows,
        extractOutcomeComments,
        indicatorPerformanceColumns,
        measurementGuideColumns,
        measurementGuideData,
        intermediateOutcomePerformanceByVote,
        intermediateOutcomeDetailedColumns,
        intermediateOutcomeDetailedData,
        intermediateOutcomeSummaryRows,
        outcomeDetailedColumns,
        outcomeDetailedData,
        outcomePerformanceByVote,
        outcomeSummaryRows,
        outputDetailedColumns,
        outputDetailedData,
        outputPerformanceByVote,
        outputSummaryRows,
        overallScorecardColumns,
        overallScorecardRows,
        performanceLegendColumns,
        performanceLegendData,
        sortedActionPerformanceByVoteColumns,
        sortedActionPerformanceByVoteRows,
        sortedIntermediateOutcomePerformanceByVoteColumns,
        sortedIntermediateOutcomePerformanceByVoteRows,
        sortedOutcomePerformanceByVoteColumns,
        sortedOutcomePerformanceByVoteRows,
        sortedOutputPerformanceByVoteColumns,
        sortedOutputPerformanceByVoteRows,
        summaryPerformanceColumns,
    ]);

    return (
        <Flex vertical gap="16px">
            <style>
                {`
                    .programme-report-table .ant-table-thead > tr > th {
                        background: ${REPORT_COLORS.tableHeader} !important;
                    }

                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(4),
                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(8) {
                        background: ${REPORT_COLORS.achieved} !important;
                    }

                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(5),
                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(9) {
                        background: ${REPORT_COLORS.moderate} !important;
                    }

                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(6),
                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(10) {
                        background: ${REPORT_COLORS.notAchieved} !important;
                    }

                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(7),
                    .programme-indicator-performance-table .ant-table-thead > tr > th:nth-child(11) {
                        background: ${REPORT_COLORS.noData} !important;
                    }

                    .programme-guide-row > div {
                        border: 1px solid #1f1f1f;
                        padding: 12px 14px;
                        font-weight: 700;
                        color: ${REPORT_COLORS.section};
                        flex: 1;
                        text-align: center;
                    }
                `}
            </style>
            <Flex justify="flex-end" gap={10}>
                <Button onClick={handlePdfExport} icon={<DownloadOutlined />}>
                    Download PDF
                </Button>
                <Button onClick={handleExcelExport} icon={<DownloadOutlined />}>
                    Download Excel
                </Button>
            </Flex>

            <Typography.Title
                level={2}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                SECTION 1.0 OVERVIEW OF PERFORMANCE
            </Typography.Title>
            <Flex className="programme-guide-row" gap={0} wrap>
                <div>B: Baseline</div>
                <div>T: Target</div>
                <div>A: Actual</div>
            </Flex>
            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.1 Performance Scorecards
            </Typography.Title>
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.1.1 Overall Programme Performance Scorecard
            </Typography.Title>
            <Table
                className="programme-report-table programme-overall-table"
                columns={sortedOverallScorecardColumns}
                dataSource={sortedOverallScorecardRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleScorecardTableChange("overall")}
            />

            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.2.1 Outcome Performance by Vote
            </Typography.Title>
            {renderLegendRow(indicatorLegendItems)}
            <Table
                className="programme-report-table programme-indicator-performance-table"
                columns={sortedOutcomePerformanceByVoteColumns}
                dataSource={sortedOutcomePerformanceByVoteRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleByVoteTableChange("outcome")}
            />

            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.2.2 Intermediate Outcome Performance by Vote
            </Typography.Title>
            {renderLegendRow(indicatorLegendItems)}
            <Table
                className="programme-report-table programme-indicator-performance-table"
                columns={sortedIntermediateOutcomePerformanceByVoteColumns}
                dataSource={sortedIntermediateOutcomePerformanceByVoteRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleByVoteTableChange("intermediateOutcome")}
            />

            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.2.3 Output Performance by Vote
            </Typography.Title>
            {renderLegendRow(indicatorLegendItems)}
            <Table
                className="programme-report-table programme-indicator-performance-table"
                columns={sortedOutputPerformanceByVoteColumns}
                dataSource={sortedOutputPerformanceByVoteRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleByVoteTableChange("output")}
            />

            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.2.4 Action (Budget) Performance by Vote
            </Typography.Title>
            {renderLegendRow(actionLegendItems)}
            <Table
                className="programme-report-table"
                columns={sortedActionPerformanceByVoteColumns}
                dataSource={sortedActionPerformanceByVoteRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleByVoteTableChange("action")}
            />

            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.3 Summary Performance
            </Typography.Title>
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.3.1 Summary Outcome Performance
            </Typography.Title>
            <Table
                className="programme-report-table"
                {...outcomeSummaryTableProps}
            />
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.3.2 Summary Intermediate Outcome Performance
            </Typography.Title>
            <Table
                className="programme-report-table"
                {...intermediateOutcomeSummaryTableProps}
            />
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.3.3 Summary Output Performance
            </Typography.Title>
            <Table
                className="programme-report-table"
                {...outputSummaryTableProps}
            />
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                1.3.4 Summary Actions (Budget) Performance Scorecard
            </Typography.Title>
            <Table
                className="programme-report-table"
                columns={sortedBudgetScorecardColumns}
                dataSource={sortedBudgetScorecardRows}
                rowKey={(record) => record.key}
                bordered
                tableLayout="auto"
                pagination={false}
                size="small"
                onChange={handleScorecardTableChange("budget")}
            />

            <Typography.Title
                level={2}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                SECTION 3.0: DETAILED PERFORMANCE
            </Typography.Title>
            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                3.1.1 Detailed Outcome Performance
            </Typography.Title>
            <Table className="programme-report-table" {...outcomeTableProps} />
            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                3.1.2 Detailed Intermediate Outcome Performance
            </Typography.Title>
            <Table
                className="programme-report-table"
                {...intermediateOutcomeTableProps}
            />
            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                3.1.3 Detailed Output Indicator Performance
            </Typography.Title>
            <Table className="programme-report-table" {...outputTableProps} />
            <Typography.Title
                level={3}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                3.1.4 Detailed Actions (Budget) Performance
            </Typography.Title>
            <Typography.Title
                level={4}
                style={{ margin: 0, color: REPORT_COLORS.section }}
            >
                <Flex wrap gap={24}>
                    <span>BP = Budget Planned</span>
                    <span>BA = Budget Approved</span>
                    <span>BR = Budget Released</span>
                    <span>BS = Budget Spent</span>
                </Flex>
            </Typography.Title>
            <Table className="programme-report-table" {...actionTableProps} />
        </Flex>
    );
}

function deriveCommonRootOrgUnitId(
    votes: Array<{ path?: string }>,
) {
    const pathParts = votes
        .map(({ path }) => String(path ?? "").split("/").filter(Boolean))
        .filter((parts) => parts.length > 0);

    if (pathParts.length === 0) {
        return undefined;
    }

    const commonParts: string[] = [];
    const shortestLength = Math.min(...pathParts.map((parts) => parts.length));

    for (let index = 0; index < shortestLength; index++) {
        const currentPart = pathParts[0]?.[index];
        if (pathParts.every((parts) => parts[index] === currentPart)) {
            commonParts.push(currentPart);
            continue;
        }
        break;
    }

    return commonParts.at(-1);
}

function deriveVoteLevel(
    votes: Array<{ path?: string }>,
) {
    return votes[0]?.path?.split("/").filter(Boolean).length;
}

function buildProgrammePerformanceSummaryRows({
    dataElements,
    pe,
    voteMap,
    overallLabel,
}: {
    dataElements: AnalyticsData[];
    pe: string;
    voteMap: Map<string, VoteMetadata>;
    overallLabel: string;
}) {
    const groupedRows = orderBy(
        Object.entries(groupBy(dataElements, "ou")).map(([voteId, rows]) =>
            summarizeProgrammePerformanceGroup({
                rows,
                pe,
                voteId,
                vote: voteMap.get(voteId),
            }),
        ),
        ["code", "name"],
        ["asc", "asc"],
    );

    if (dataElements.length === 0) {
        return groupedRows;
    }

    const overallRow = summarizeProgrammePerformanceGroup({
        rows: dataElements,
        pe,
        voteId: "__overall",
        label: overallLabel,
    });

    return [overallRow, ...groupedRows];
}

function buildOverallScorecardRows({
    pe,
    outcomes,
    outputs,
    actions,
    voteMap,
    overallLabel,
}: {
    pe: string;
    outcomes: AnalyticsData[];
    outputs: AnalyticsData[];
    actions: AnalyticsData[];
    voteMap: Map<string, VoteMetadata>;
    overallLabel: string;
}) {
    const outcomeRows = buildProgrammePerformanceSummaryRows({
        dataElements: outcomes,
        pe,
        voteMap,
        overallLabel,
    });
    const outputRows = buildProgrammePerformanceSummaryRows({
        dataElements: outputs,
        pe,
        voteMap,
        overallLabel,
    });
    const budgetRows = buildProgrammePerformanceSummaryRows({
        dataElements: actions,
        pe,
        voteMap,
        overallLabel,
    });
    const outputRowsByVote = new Map(
        outputRows.slice(1).map((row) => [String(row.ou ?? ""), row]),
    );
    const outcomeRowsByVote = new Map(
        outcomeRows.slice(1).map((row) => [String(row.ou ?? ""), row]),
    );
    const budgetRowsByVote = new Map(
        budgetRows.slice(1).map((row) => [String(row.ou ?? ""), row]),
    );

    const voteIds = new Set(
        [
            ...outcomeRowsByVote.keys(),
            ...outputRowsByVote.keys(),
            ...budgetRowsByVote.keys(),
        ].filter(Boolean),
    );

    const childRows = orderBy(
        Array.from(voteIds).map((voteId) => {
            const outputRow = outputRowsByVote.get(voteId);
            const outcomeRow = outcomeRowsByVote.get(voteId);
            const budgetRow = budgetRowsByVote.get(voteId);
            const outputPerformance = outputRow?.totalWeighted ?? 0;
            const outcomePerformance = outcomeRow?.totalWeighted ?? 0;
            const absorptionRate = budgetRow?.performance ?? 0;
            return {
                ...(budgetRow ?? {}),
                ...(outcomeRow ?? {}),
                ...(outputRow ?? {}),
                outputPerformance,
                outcomePerformance,
                absorptionRate,
                overallScore:
                    0.4 * outcomePerformance +
                    0.4 * outputPerformance +
                    0.2 * absorptionRate,
            };
        }),
        ["code", "name"],
        ["asc", "asc"],
    );

    const overallOutput = outputRows[0];
    const overallOutcome = outcomeRows[0];
    const overallBudget = budgetRows[0];

    const overallRow = {
        ...(overallBudget ?? {}),
        ...(overallOutcome ?? {}),
        ...(overallOutput ?? {}),
        key: "__overall-scorecard",
        code: "",
        name: overallLabel,
        outputPerformance: overallOutput?.totalWeighted ?? 0,
        outcomePerformance: overallOutcome?.totalWeighted ?? 0,
        absorptionRate: overallBudget?.performance ?? 0,
        overallScore:
            0.4 * (overallOutcome?.totalWeighted ?? 0) +
            0.4 * (overallOutput?.totalWeighted ?? 0) +
            0.2 * (overallBudget?.performance ?? 0),
    };

    return [overallRow, ...childRows];
}

function summarizeProgrammePerformanceGroup({
    rows,
    pe,
    voteId,
    vote,
    label,
}: {
    rows: AnalyticsData[];
    pe: string;
    voteId: string;
    vote?: { id: string; name: string; code?: string };
    label?: string;
}) {
    const total = rows.length;
    const current = rows[0] ?? {};
    const groupedPerformance = groupBy(rows, `${pe}performance-group`);
    const achieved = groupedPerformance["a"]?.length ?? 0;
    const moderatelyAchieved = groupedPerformance["m"]?.length ?? 0;
    const notAchieved = groupedPerformance["n"]?.length ?? 0;
    const noData = groupedPerformance["x"]?.length ?? 0;
    const percentAchieved = total !== 0 ? achieved / total : 0;
    const percentModeratelyAchieved = total !== 0 ? moderatelyAchieved / total : 0;
    const percentNotAchieved = total !== 0 ? notAchieved / total : 0;
    const percentNoData = total !== 0 ? noData / total : 0;
    const totalWeighted =
        percentAchieved * 0.5 +
        percentModeratelyAchieved * 0.35 +
        percentNotAchieved * 0.15 +
        percentNoData * 0;
    const approved = getNumericValue(rows, `${pe}approved`).sum;
    const target = getNumericValue(rows, `${pe}target`).sum;
    const actual = getNumericValue(rows, `${pe}actual`).sum;
    const approvedAllocation = approved !== 0 ? target / approved : 0;
    const actualSpend = target !== 0 ? actual / target : 0;
    const name = label ?? vote?.name ?? String(current.ouName ?? current.ou ?? voteId);
    const code = label ? "" : String(vote?.code ?? "");

    return {
        ...current,
        key: voteId,
        ou: voteId,
        code,
        name,
        total,
        achieved,
        moderatelyAchieved,
        notAchieved,
        noData,
        percentAchieved: formatReportPercent(percentAchieved),
        percentModeratelyAchieved: formatReportPercent(
            percentModeratelyAchieved,
        ),
        percentNotAchieved: formatReportPercent(percentNotAchieved),
        percentNoData: formatReportPercent(percentNoData),
        totalWeighted,
        performance: actualSpend,
        approved,
        target,
        actual,
        approvedAllocation,
        allocation:
            approved !== 0 ? formatReportPercent(approvedAllocation) : "-",
        actualSpend,
        spend: target !== 0 ? formatReportPercent(actualSpend) : "-",
    };
}

function buildActionPerformanceByVoteRows({
    dataElements,
    pe,
    voteMap,
    categoryOptions,
    overallLabel,
}: {
    dataElements: AnalyticsData[];
    pe: string;
    voteMap: Map<string, VoteMetadata>;
    categoryOptions: string[];
    overallLabel: string;
}) {
    const plannedId = categoryOptions[0] ?? "";
    const approvedId = categoryOptions[1] ?? "";
    const releasedId = categoryOptions[2] ?? "";
    const spentId = categoryOptions[3] ?? "";

    const makeRow = (
        voteId: string,
        rows: AnalyticsData[],
        label?: string,
    ) => {
        const vote = voteMap.get(voteId);
        const row: AnalyticsData = {
            key: voteId,
            ou: voteId,
            code: label ? "" : String(vote?.code ?? ""),
            name: label ?? vote?.name ?? String(rows[0]?.ouName ?? voteId),
            totalActions: new Set(rows.map(({ id }) => id)).size,
            plannedBudget: getNumericDisplayValue(rows, `${pe}${plannedId}`),
            approvedBudget: getNumericDisplayValue(rows, `${pe}${approvedId}`),
        };

        regularQuarterOrder.forEach((quarter) => {
            const year = Number(pe.slice(0, 4));
            const currentYear =
                quarter === 1 || quarter === 2 ? year + 1 : year;
            const quarterKey = `${currentYear}Q${quarter}`;
            const released = getNumericValue(rows, `${quarterKey}${releasedId}`);
            const spent = getNumericValue(rows, `${quarterKey}${spentId}`);
            const ratio = calculatePerformanceRatio(
                spent.sum,
                released.sum,
                String(rows[0]?.aggregationType ?? ""),
                String(rows[0]?.["descending indicator type"] ?? ""),
            );
            row[`${quarterKey}released`] = released.hasValue ? released.sum : "-";
            row[`${quarterKey}spent`] = spent.hasValue ? spent.sum : "-";
            row[`${quarterKey}performance`] = Number.isNaN(ratio)
                ? "-"
                : formatReportPercent(ratio / 100);
            row[`${quarterKey}style`] = findBackground(ratio).style;
        });

        return row;
    };

    const voteRows = orderBy(
        Object.entries(groupBy(dataElements, "ou")).map(([voteId, rows]) =>
            makeRow(voteId, rows),
        ),
        ["code", "name"],
        ["asc", "asc"],
    );

    if (dataElements.length === 0) {
        return voteRows;
    }

    return [makeRow("__overall", dataElements, overallLabel), ...voteRows];
}

function buildBudgetScorecardRows({
    dataElements,
    pe,
    voteMap,
    overallLabel,
    categoryOptions,
}: {
    dataElements: AnalyticsData[];
    pe: string;
    voteMap: Map<string, VoteMetadata>;
    overallLabel: string;
    categoryOptions: string[];
}) {
    const plannedId = categoryOptions[0] ?? "";
    const approvedId = categoryOptions[1] ?? "";
    const releasedId = categoryOptions.at(-2) ?? "";
    const spentId = categoryOptions.at(-1) ?? "";

    const summarize = (
        voteId: string,
        rows: AnalyticsData[],
        label?: string,
    ) => {
        const vote = voteMap.get(voteId);
        const baseline = getNumericValue(rows, `${pe}${plannedId}`).sum;
        const approved = getNumericValue(rows, `${pe}${approvedId}`).sum;
        const target = getNumericValue(rows, `${pe}${releasedId}`).sum;
        const actual = getNumericValue(rows, `${pe}${spentId}`).sum;
        const approvedAllocation = approved !== 0 ? target / approved : 0;
        const actualSpend = target !== 0 ? actual / target : 0;

        return {
            key: voteId,
            ou: voteId,
            code: label ? "" : String(vote?.code ?? ""),
            name: label ?? vote?.name ?? String(rows[0]?.ouName ?? voteId),
            baseline: baseline || "-",
            approved: approved || "-",
            target: target || "-",
            actual: actual || "-",
            approvedAllocation,
            actualSpend,
            allocation:
                approved !== 0 ? formatReportPercent(approvedAllocation) : "-",
            spend: target !== 0 ? formatReportPercent(actualSpend) : "-",
        };
    };

    const voteRows = orderBy(
        Object.entries(groupBy(dataElements, "ou")).map(([voteId, rows]) =>
            summarize(voteId, rows),
        ),
        ["code", "name"],
        ["asc", "asc"],
    );

    if (dataElements.length === 0) {
        return voteRows;
    }

    return [summarize("__overall", dataElements, overallLabel), ...voteRows];
}

function buildBudgetQuarterColumns(pe: string): NonNullable<
    TableProps<AnalyticsData>["columns"]
> {
    const year = Number(pe.slice(0, 4));
    return regularQuarterOrder.map((quarter) => {
        const currentYear = quarter === 1 || quarter === 2 ? year + 1 : year;
        const quarterKey = `${currentYear}Q${quarter}`;
        const title = fullQuarters[quarter];
        return {
            title,
            children: [
                {
                    title: "BR",
                    dataIndex: `${quarterKey}released`,
                    key: `${quarterKey}released`,
                    align: "center" as const,
                    width: 110,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "BS",
                    dataIndex: `${quarterKey}spent`,
                    key: `${quarterKey}spent`,
                    align: "center" as const,
                    width: 110,
                    render: (value: unknown) => formatReportNumberish(value),
                },
                {
                    title: "%",
                    dataIndex: `${quarterKey}performance`,
                    key: `${quarterKey}performance`,
                    align: "center" as const,
                    width: 90,
                    onCell: (record: AnalyticsData) => ({
                        style: record[`${quarterKey}style`] as Record<
                            string,
                            unknown
                        >,
                    }),
                },
            ],
        };
    });
}

function buildSummaryPerformanceColumns({
    baselinePeriodLabel,
    currentPeriodLabel,
}: {
    baselinePeriodLabel: string;
    currentPeriodLabel: string;
}): TableProps<AnalyticsData>["columns"] {
    return [
        {
            title: "Programme Objective",
            dataIndex: "programObjective",
            key: "programObjective",
            width: 180,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
        },
        {
            title: "Outcome",
            dataIndex: "outcome",
            key: "outcome",
            width: 180,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
        },
        {
            title: "Indicator",
            dataIndex: "indicator",
            key: "indicator",
            width: 220,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
        },
        {
            title: baselinePeriodLabel,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
            children: [
                {
                    title: "Baseline",
                    dataIndex: "baselinePeriodBaseline",
                    key: "baselinePeriodBaseline",
                    align: "center",
                    width: 110,
                    render: (value: unknown) => formatReportNumberish(value),
                    onHeaderCell: () => ({
                        style: { backgroundColor: REPORT_COLORS.tableHeader },
                    }),
                },
            ],
        },
        {
            title: currentPeriodLabel,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
            children: [
                {
                    title: "Target",
                    dataIndex: "currentPeriodTarget",
                    key: "currentPeriodTarget",
                    align: "center",
                    width: 110,
                    render: (value: unknown) => formatReportNumberish(value),
                    onHeaderCell: () => ({
                        style: { backgroundColor: REPORT_COLORS.tableHeader },
                    }),
                },
                {
                    title: "Actual",
                    dataIndex: "currentPeriodActual",
                    key: "currentPeriodActual",
                    align: "center",
                    width: 110,
                    render: (value: unknown) => formatReportNumberish(value),
                    onHeaderCell: () => ({
                        style: { backgroundColor: REPORT_COLORS.tableHeader },
                    }),
                },
            ],
        },
        {
            title: "Performance Rating (%)",
            dataIndex: "performanceRating",
            key: "performanceRating",
            align: "center",
            width: 160,
            onHeaderCell: () => ({
                style: { backgroundColor: REPORT_COLORS.tableHeader },
            }),
            onCell: (record) => ({
                style:
                    typeof record.performanceRatingValue === "number"
                        ? getProgrammeCellStyle(record.performanceRatingValue)
                        : undefined,
            }),
        },
    ];
}

function buildSummaryPerformanceRows({
    rows,
    baselinePe,
    currentPe,
    currentPeriodLabel,
    quarterDetails,
    allOptionsMap,
    rowType,
    voteMap,
}: {
    rows: AnalyticsData[];
    baselinePe: string;
    currentPe: string;
    currentPeriodLabel: string;
    quarterDetails: QuarterDetail[];
    allOptionsMap: Map<string, string>;
    rowType: "outcome" | "intermediateOutcome" | "output";
    voteMap: Map<string, VoteMetadata>;
}) {
    return orderBy(
        Object.values(groupBy(rows, "id")).map((group) => {
            const current = group[0];
            const baselineBaseline = getNumericValue(
                group,
                `${baselinePe}baseline`,
            );
            const currentTarget = getNumericValue(group, `${currentPe}target`);
            const currentActual = getNumericValue(group, `${currentPe}actual`);
            const annualNarrative = buildPeriodNarrative({
                rows: group,
                period: currentPe,
                voteMap,
            });
            const aggregatedQuarterNarratives = buildQuarterNarratives({
                rows: group,
                quarterDetails,
                voteMap,
            });
            const performanceRatingValue = calculateSummaryRatioValue(
                currentActual.sum,
                currentTarget.sum,
                String(current?.aggregationType ?? ""),
                String(current?.["descending indicator type"] ?? ""),
            );

            const summaryRow: AnalyticsData = {
                ...current,
                key: current?.id,
                programObjective: resolveMetadataLabel(
                    current?.programObjective ??
                        current?.GuoVDNEBAXA ??
                        current?.objective,
                    allOptionsMap,
                ),
                outcome: resolveSummaryOutcomeLabel(
                    current,
                    allOptionsMap,
                    rowType,
                ),
                indicator: current?.name ?? "-",
                baselinePeriodBaseline: baselineBaseline.hasValue
                    ? baselineBaseline.sum
                    : "-",
                currentPeriodTarget: currentTarget.hasValue
                    ? currentTarget.sum
                    : "-",
                currentPeriodActual: currentActual.hasValue
                    ? currentActual.sum
                    : "-",
                summaryComment: annualNarrative,
                summaryCommentLabel: currentPeriodLabel,
                performanceRating: Number.isNaN(performanceRatingValue)
                    ? "-"
                    : formatReportPercent(performanceRatingValue),
                performanceRatingValue: Number.isNaN(performanceRatingValue)
                    ? undefined
                    : performanceRatingValue,
            };
            aggregatedQuarterNarratives.forEach(({ period, text }) => {
                summaryRow[`${period}comment`] = text;
            });

            return summaryRow;
        }),
        ["programObjective", "outcome", "indicator"],
        ["asc", "asc", "asc"],
    );
}

function resolveSummaryOutcomeLabel(
    row: AnalyticsData,
    allOptionsMap: Map<string, string>,
    rowType: "outcome" | "intermediateOutcome" | "output",
) {
    if (rowType === "intermediateOutcome") {
        return resolveMetadataLabel(
            row?.intermediateOutcome ?? row?.k9c6BOHIohu,
            allOptionsMap,
        );
    }
    return resolveMetadataLabel(row?.YlPvYLC4VfO ?? row?.outcome, allOptionsMap);
}

function resolveMetadataLabel(
    value: unknown,
    allOptionsMap: Map<string, string>,
) {
    if (!value) {
        return "-";
    }
    const label = allOptionsMap.get(String(value));
    return label ?? String(value);
}

function formatPeriodLabel(periodId: string) {
    if (!periodId) {
        return "";
    }
    try {
        return createFixedPeriodFromPeriodId({
            calendar: "gregory",
            periodId,
        }).name;
    } catch {
        return periodId;
    }
}

function buildPerformanceLegendExportColumns(): TableProps<AnalyticsData>["columns"] {
    return performanceLegendItems.map((item, index) => ({
        title: item.label.trim(),
        dataIndex: `legend-${index}`,
        key: `legend-${index}`,
        align: "left" as const,
        onHeaderCell: () => ({
            style: { backgroundColor: item.bg, color: item.color },
        }),
    }));
}

function buildMeasurementGuideColumns(): TableProps<AnalyticsData>["columns"] {
    return [
        {
            title: "B: Baseline",
            dataIndex: "baseline",
            key: "baseline",
            align: "center",
            onHeaderCell: () => ({
                style: { backgroundColor: "#ffffff", color: "#000000" },
            }),
        },
        {
            title: "T: Target",
            dataIndex: "target",
            key: "target",
            align: "center",
            onHeaderCell: () => ({
                style: { backgroundColor: "#ffffff", color: "#000000" },
            }),
        },
        {
            title: "A: Actual",
            dataIndex: "actual",
            key: "actual",
            align: "center",
            onHeaderCell: () => ({
                style: { backgroundColor: "#ffffff", color: "#000000" },
            }),
        },
    ];
}

function buildMeasurementGuideData() {
    return [];
}

function formatReportPercent(value: number) {
    return reportPercentFormatter.format(value);
}

function formatReportNumberish(value: unknown) {
    if (value === "-" || value === "" || value === null || value === undefined) {
        return "-";
    }
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        return String(value);
    }
    return reportNumberFormatter.format(numericValue);
}

function calculateSummaryRatioValue(
    actual: number,
    comparisonValue: number,
    aggregationType: string,
    isReducing: string,
) {
    const ratio = calculatePerformanceRatio(
        actual,
        comparisonValue,
        aggregationType,
        isReducing,
    );

    if (!Number.isFinite(ratio)) {
        return Number.NaN;
    }

    return aggregationType === "LAST" ? ratio : ratio / 100;
}

function getProgrammeCellStyle(value: number) {
    if (value >= 1) {
        return { backgroundColor: REPORT_COLORS.achieved, color: "#000000" };
    }
    if (value >= 0.75) {
        return { backgroundColor: REPORT_COLORS.moderate, color: "#000000" };
    }
    if (value > 0) {
        return {
            backgroundColor: REPORT_COLORS.notAchieved,
            color: "#000000",
        };
    }
    return { backgroundColor: REPORT_COLORS.notAchieved, color: "#000000" };
}

function aggregateProgrammeDetailedRows({
    rows,
    pe,
    quarterDetails,
    voteMap,
    categoryOptions,
    nonBaseline,
}: {
    rows: AnalyticsData[];
    pe: string;
    quarterDetails: QuarterDetail[];
    voteMap: Map<string, VoteMetadata>;
    categoryOptions: string[];
    nonBaseline: boolean;
}) {
    return orderBy(
        Object.values(groupBy(rows, "id")).map((group) => {
            const current = group[0];
            const aggregated: Record<string, unknown> = {};

            if (nonBaseline) {
                categoryOptions.slice(0, 2).forEach((optionId) => {
                    aggregated[`${pe}${optionId}`] = getNumericDisplayValue(
                        group,
                        `${pe}${optionId}`,
                    );
                });
            } else {
                const periodTarget = getNumericValue(group, `${pe}target`);
                const periodActual = getNumericValue(group, `${pe}actual`);
                const ratio = calculatePerformanceRatio(
                    periodActual.sum,
                    periodTarget.sum,
                    String(current.aggregationType ?? ""),
                    String(current["descending indicator type"] ?? ""),
                );
                const { performance, style } = findBackground(ratio);

                aggregated[`${pe}baseline`] = getNumericDisplayValue(
                    group,
                    `${pe}baseline`,
                );
                aggregated[`${pe}target`] = periodTarget.hasValue
                    ? periodTarget.sum
                    : "-";
                aggregated[`${pe}actual`] = periodActual.hasValue
                    ? periodActual.sum
                    : "-";
                aggregated[`${pe}performance`] = Number.isNaN(ratio)
                    ? "-"
                    : formatReportPercent(ratio / 100);
                aggregated[`${pe}style`] = style;
                aggregated[`${pe}performance-group`] = performance;
            }

            quarterDetails.forEach(({ period: quarterKey }) => {
                if (nonBaseline) {
                    categoryOptions.slice(2).forEach((optionId) => {
                        aggregated[`${quarterKey}${optionId}`] =
                            getNumericDisplayValue(group, `${quarterKey}${optionId}`);
                    });

                    const quarterTarget = getNumericValue(
                        group,
                        `${quarterKey}${categoryOptions.at(-2) ?? ""}`,
                    );
                    const quarterActual = getNumericValue(
                        group,
                        `${quarterKey}${categoryOptions.at(-1) ?? ""}`,
                    );
                    const ratio = calculatePerformanceRatio(
                        quarterActual.sum,
                        quarterTarget.sum,
                        String(current.aggregationType ?? ""),
                        String(current["descending indicator type"] ?? ""),
                    );
                    const { performance, style } = findBackground(ratio);
                    aggregated[`${quarterKey}performance`] = Number.isNaN(ratio)
                        ? "-"
                        : formatReportPercent(ratio / 100);
                    aggregated[`${quarterKey}style`] = style;
                    aggregated[`${quarterKey}performance-group`] = performance;
                } else {
                    const quarterActual = getNumericValue(
                        group,
                        `${quarterKey}actual`,
                    );
                    const periodTarget = getNumericValue(group, `${pe}target`);
                    const ratio = calculatePerformanceRatio(
                        quarterActual.sum,
                        periodTarget.sum,
                        String(current.aggregationType ?? ""),
                        String(current["descending indicator type"] ?? ""),
                    );
                    const { performance, style } = findBackground(ratio);

                    aggregated[`${quarterKey}actual`] = quarterActual.hasValue
                        ? quarterActual.sum
                        : "-";
                    aggregated[`${quarterKey}performance`] = Number.isNaN(ratio)
                        ? "-"
                        : formatReportPercent(ratio / 100);
                    aggregated[`${quarterKey}style`] = style;
                    aggregated[`${quarterKey}performance-group`] = performance;
                }
            });

            buildQuarterNarratives({
                rows: group,
                quarterDetails,
                voteMap,
            }).forEach(({ period: quarterKey, text }) => {
                aggregated[`${quarterKey}comment`] = text;
            });

            return {
                ...current,
                ...aggregated,
            };
        }),
        ["name"],
        ["asc"],
    );
}

function getNumericValue(
    rows: AnalyticsData[],
    key: string,
) {
    return rows.reduce(
        (acc, row) => {
            const value = Number(row[key]);
            if (!Number.isNaN(value)) {
                acc.sum += value;
                acc.hasValue = true;
            }
            return acc;
        },
        { sum: 0, hasValue: false },
    );
}

function getNumericDisplayValue(
    rows: AnalyticsData[],
    key: string,
) {
    const { sum, hasValue } = getNumericValue(rows, key);
    return hasValue ? sum : "-";
}

function buildDetailedTableProps({
    rows,
    columns,
    quarterDetails,
}: {
    rows: AnalyticsData[];
    columns: TableProps<AnalyticsData>["columns"];
    quarterDetails: QuarterDetail[];
}) {
    return {
        rowKey: "id",
        bordered: true,
        sticky: true,
        tableLayout: "auto",
        pagination: false,
        size: "small",
        dataSource: rows,
        columns,
        expandable: buildNarrativeExpandableConfig(quarterDetails),
    } satisfies TableProps<AnalyticsData>;
}

function buildSummaryTableProps({
    rows,
    columns,
    quarterDetails,
}: {
    rows: AnalyticsData[];
    columns: TableProps<AnalyticsData>["columns"];
    quarterDetails: QuarterDetail[];
}) {
    return {
        rowKey: "key",
        bordered: true,
        sticky: true,
        tableLayout: "auto",
        pagination: false,
        size: "small",
        dataSource: rows,
        columns,
        expandable: buildNarrativeExpandableConfig(quarterDetails),
    } satisfies TableProps<AnalyticsData>;
}

function formatVoteCode(value: string) {
    return value ? value.replace(/^V/i, "") : "";
}
