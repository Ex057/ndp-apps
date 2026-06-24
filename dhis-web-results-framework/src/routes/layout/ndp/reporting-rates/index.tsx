import { DownloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    Col,
    Dropdown,
    Empty,
    InputNumber,
    Row,
    Select,
    Table,
    Typography,
} from "antd";
import type { TableProps } from "antd";
import { OrgUnitSelect } from "../../../../components/organisation";
import { useWindowSize } from "../../../../hooks/use-window-size";
import {
    reportingRatesDatasetOptionsQueryOptions,
    reportingRatesQueryOptions,
    ReportingRatesQuarterOption,
    ReportingRatesRow,
} from "../../../../query-options";
import { RootRoute } from "../../../__root";
import { ReportingRatesRoute } from "./route";
import {
    exportTrackerTableToExcel,
    exportTrackerTableToPdf,
} from "../../../../utils/tracker-report-export";
import {
    getDefaultPeriods,
    PERFORMANCE_COLORS,
} from "../../../../utils";

const { Text } = Typography;

const bandTitles = {
    green: "Achieved",
    yellow: "Moderately achieved",
    red: "Not achieved",
} as const;

export const ReportingRatesIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ReportingRatesRoute,
    component: Component,
});

function Component() {
    const { engine } = ReportingRatesRoute.useRouteContext();
    const { v } = ReportingRatesIndexRoute.useSearch();
    const { configurations, ou: defaultOrgUnit } = RootRoute.useLoaderData();
    const { width: viewportWidth, height: viewportHeight } = useWindowSize();
    const [selectedDataSet, setSelectedDataSet] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [selectedQuarter, setSelectedQuarter] =
        useState<ReportingRatesQuarterOption>();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [reportPanelHeight, setReportPanelHeight] = useState<number>();
    const [tableScrollY, setTableScrollY] = useState(320);
    const reportPanelRef = useRef<HTMLDivElement>(null);
    const reportHeaderRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const financialYears = v
        ? configurations[v]?.data?.financialYears ?? []
        : [];
    const quarterOptions = useMemo(
        () => buildQuarterOptions(financialYears),
        [financialYears],
    );

    const datasetsQuery = useQuery(
        reportingRatesDatasetOptionsQueryOptions(v ?? ""),
    );
    const reportRowsQuery = useQuery({
        ...reportingRatesQueryOptions({
            engine,
            ndpVersion: v ?? "",
            dataSetId: selectedDataSet,
            orgUnitId: selectedMDA,
            quarter: selectedQuarter,
        }),
        enabled: Boolean(v && selectedDataSet && selectedMDA && selectedQuarter),
    });

    useEffect(() => {
        if (defaultOrgUnit) {
            setSelectedMDA(defaultOrgUnit);
        }
    }, [defaultOrgUnit]);

    useEffect(() => {
        if (selectedQuarter || quarterOptions.length === 0) {
            return;
        }
        setSelectedQuarter(getDefaultQuarterOption(quarterOptions));
    }, [quarterOptions, selectedQuarter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, selectedDataSet, selectedMDA, selectedQuarter]);

    const allRows = reportRowsQuery.data ?? [];
    const pagedRows = useMemo(
        () =>
            allRows.slice(
                (currentPage - 1) * pageSize,
                (currentPage - 1) * pageSize + pageSize,
            ),
        [allRows, currentPage, pageSize],
    );
    const totalPages = Math.max(1, Math.ceil(allRows.length / Math.max(pageSize, 1)));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        const updateTableLayout = () => {
            const panelTop =
                reportPanelRef.current?.getBoundingClientRect().top ?? 0;
            const availableHeight = Math.max(
                viewportWidth < 768 ? 500 : 560,
                viewportHeight - panelTop - 20,
            );
            const headerHeight =
                reportHeaderRef.current?.getBoundingClientRect().height ?? 0;
            const summaryHeight =
                summaryRef.current?.getBoundingClientRect().height ?? 0;
            const footerHeight =
                footerRef.current?.getBoundingClientRect().height ?? 0;
            setReportPanelHeight(availableHeight);
            setTableScrollY(
                Math.max(
                    viewportWidth < 768 ? 220 : 280,
                    availableHeight - headerHeight - summaryHeight - footerHeight - 40,
                ),
            );
        };

        updateTableLayout();
        const animationFrame = window.requestAnimationFrame(updateTableLayout);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [pagedRows.length, viewportHeight, viewportWidth]);

    const summary = useMemo(() => {
        const expected = allRows.reduce((sum, row) => sum + row.expectedReports, 0);
        const reported = allRows.reduce((sum, row) => sum + row.completedReports, 0);
        const missing = allRows.reduce((sum, row) => sum + row.missingReports, 0);
        const rate = expected === 0 ? 0 : (reported / expected) * 100;
        return {
            expected,
            reported,
            missing,
            rate,
        };
    }, [allRows]);

    const columns = useMemo<TableProps<ReportingRatesRow>["columns"]>(
        () => [
            makeTextColumn("Org Unit", "orgUnitName", 180),
            makeTextColumn("Dataset", "dataSetName", 180),
            makeTextColumn("Quarter", "quarterLabel", 120),
            makeNumberColumn("Expected", "expectedReports", 110, "right"),
            makeNumberColumn("Reported", "completedReports", 110, "right"),
            makeNumberColumn("Missing", "missingReports", 110, "right"),
            {
                title: "Rate (%)",
                dataIndex: "reportingRateDisplay",
                key: "reportingRateDisplay",
                width: 130,
                align: "center",
                onHeaderCell: () => ({ style: getSharedCellStyle("Rate (%)", 130) }),
                onCell: (record) => ({
                    style: getSharedCellStyle("Rate (%)", 130),
                }),
                render: (_, record) => (
                    <div style={getBandCellStyle(record.performanceBand)}>
                        {record.reportingRateDisplay}
                    </div>
                ),
            },
            {
                title: "Band",
                dataIndex: "performanceBand",
                key: "performanceBand",
                width: 180,
                onHeaderCell: () => ({ style: getSharedCellStyle("Band", 180) }),
                onCell: () => ({ style: getSharedCellStyle("Band", 180) }),
                render: (value: ReportingRatesRow["performanceBand"]) => (
                    <div style={getBandCellStyle(value)}>{bandTitles[value]}</div>
                ),
            },
        ],
        [],
    );

    const handlePdfExport = useCallback(() => {
        if (allRows.length === 0) return;
        void exportTrackerTableToPdf({
            columns,
            rows: allRows,
            title: "Reporting Rates",
            subtitle: buildSubtitle(
                datasetsQuery.data?.find((item) => item.value === selectedDataSet)
                    ?.label,
                selectedQuarter?.label,
            ),
        });
    }, [allRows, columns, datasetsQuery.data, selectedDataSet, selectedQuarter]);

    const handleExcelExport = useCallback(() => {
        if (allRows.length === 0) return;
        void exportTrackerTableToExcel({
            columns,
            rows: allRows,
            title: "Reporting Rates",
            subtitle: buildSubtitle(
                datasetsQuery.data?.find((item) => item.value === selectedDataSet)
                    ?.label,
                selectedQuarter?.label,
            ),
            sheetName: "Reporting Rates",
        });
    }, [allRows, columns, datasetsQuery.data, selectedDataSet, selectedQuarter]);

    const downloadMenuItems = [
        { key: "pdf", label: "PDF", onClick: handlePdfExport },
        { key: "excel", label: "Excel", onClick: handleExcelExport },
    ];

    return (
        <div className="reporting-rates-page">
            <div
                ref={reportPanelRef}
                className="reporting-rates-report-panel"
                style={{
                    background: "#fff",
                    padding: "6px",
                    borderRadius: "3px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                    height: reportPanelHeight,
                }}
            >
                <div
                    ref={reportHeaderRef}
                    className="reporting-rates-report-header"
                    style={{
                        marginBottom: "8px",
                        background: "#eef4fb",
                        border: "1px solid #d7e3f1",
                        borderRadius: "3px",
                        padding: "8px 10px",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: "12px",
                            alignItems: "flex-end",
                            flexWrap: "wrap",
                        }}
                    >
                        <div style={{ minWidth: "260px", flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                                Dataset
                            </Text>
                            <Select
                                allowClear
                                placeholder="Select dataset"
                                value={selectedDataSet}
                                loading={datasetsQuery.isLoading}
                                options={(datasetsQuery.data ?? []).map((item) => ({
                                    label: item.label,
                                    value: item.value,
                                }))}
                                style={{ width: "100%" }}
                                onChange={(value) => setSelectedDataSet(value)}
                            />
                        </div>
                        <div style={{ minWidth: "280px", flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                                MDA/LG
                            </Text>
                            <OrgUnitSelect
                                showFormItem={false}
                                value={selectedMDA}
                                onChange={(value) =>
                                    setSelectedMDA(
                                        typeof value === "string" ? value : undefined,
                                    )
                                }
                                label="MDA/LG"
                            />
                        </div>
                        <div style={{ minWidth: "220px", flex: 0.8 }}>
                            <Text strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                                Quarter
                            </Text>
                            <Select
                                placeholder="Select quarter"
                                value={selectedQuarter?.value}
                                options={quarterOptions.map((item) => ({
                                    label: item.label,
                                    value: item.value,
                                }))}
                                style={{ width: "100%" }}
                                onChange={(value) =>
                                    setSelectedQuarter(
                                        quarterOptions.find((item) => item.value === value),
                                    )
                                }
                            />
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                                marginLeft: "auto",
                            }}
                        >
                            <Dropdown menu={{ items: downloadMenuItems }} trigger={["click"]}>
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    disabled={allRows.length === 0}
                                />
                            </Dropdown>
                        </div>
                    </div>
                </div>

                {!selectedDataSet ? (
                    <div className="reporting-rates-empty-state">
                        <Empty description="Choose a dataset to assess reporting rates." />
                    </div>
                ) : (
                    <>
                        <div ref={summaryRef} style={{ marginBottom: "8px" }}>
                            <Row gutter={[12, 12]} style={{ marginBottom: "8px" }}>
                                {[
                                    {
                                        title: "Expected Reports",
                                        value: summary.expected,
                                        bg: "#d8e8ff",
                                        color: "#1f4b8f",
                                    },
                                    {
                                        title: "Reported",
                                        value: summary.reported,
                                        bg: "#d8f0dd",
                                        color: "#1f6f43",
                                    },
                                    {
                                        title: "Missing",
                                        value: summary.missing,
                                        bg: "#f6d4d0",
                                        color: "#9d2d22",
                                    },
                                    {
                                        title: "Overall Rate",
                                        value: `${summary.rate.toFixed(2)}%`,
                                        bg: "#f8ebc2",
                                        color: "#8c6d1f",
                                    },
                                ].map((card) => (
                                    <Col key={card.title} xs={24} sm={12} md={8} lg={6} xl={24 / 7}>
                                        <Card
                                            size="small"
                                            styles={{
                                                body: {
                                                    backgroundColor: card.bg,
                                                    color: card.color,
                                                    borderRadius: "8px",
                                                    minHeight: "92px",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    justifyContent: "space-between",
                                                },
                                            }}
                                        >
                                            <Text strong style={{ color: card.color, fontSize: "14px" }}>
                                                {card.title}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: card.color,
                                                    fontSize: "28px",
                                                    fontWeight: 700,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {card.value}
                                            </Text>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>

                        {reportRowsQuery.error && (
                            <Typography.Text type="danger">
                                Unable to load reporting rates for the selected criteria.
                            </Typography.Text>
                        )}

                        <div
                            className="reporting-rates-table-region"
                            style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                        >
                            <Table
                                className="reporting-rates-table"
                                rowKey="key"
                                bordered
                                size="small"
                                tableLayout="auto"
                                dataSource={pagedRows}
                                columns={columns}
                                loading={reportRowsQuery.isFetching}
                                pagination={false}
                                sticky
                                scroll={{ x: "max-content", y: tableScrollY }}
                                locale={{
                                    emptyText: (
                                        <Empty description="No reporting-rate rows were found for the selected dataset, quarter, and org unit." />
                                    ),
                                }}
                            />
                        </div>

                        <div
                            ref={footerRef}
                            className="reporting-rates-footer"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "16px",
                                borderTop: "1px solid #dcdcdc",
                                background: "#f4f6f8",
                                padding: "10px 12px",
                                flexWrap: "wrap",
                                marginTop: "auto",
                            }}
                        >
                            <div style={{ minWidth: "180px", color: "#435266" }}>
                                Number of pages: {totalPages}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    justifyContent: "center",
                                    flex: 1,
                                    minWidth: "260px",
                                    color: "#435266",
                                }}
                            >
                                <span>Number of rows per page:</span>
                                <Select
                                    value={pageSize}
                                    style={{ width: 90 }}
                                    options={[5, 10, 25, 50, 100].map((value) => ({
                                        label: value.toString(),
                                        value,
                                    }))}
                                    onChange={(value) => {
                                        setPageSize(value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    gap: "8px",
                                    minWidth: "180px",
                                    color: "#435266",
                                }}
                            >
                                <span>Jump to page:</span>
                                <InputNumber
                                    min={1}
                                    max={totalPages}
                                    value={currentPage}
                                    style={{ width: 84 }}
                                    onChange={(value) => {
                                        if (typeof value === "number") {
                                            setCurrentPage(value);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function buildQuarterOptions(financialYears: string[]): ReportingRatesQuarterOption[] {
    return financialYears
        .slice()
        .sort()
        .flatMap((financialYear) => {
            const year = Number(financialYear.slice(0, 4));
            if (!Number.isFinite(year)) {
                return [];
            }
            return [
                {
                    value: `${year}Q3`,
                    label: `${year}/${year + 1} Q1`,
                    financialYear,
                    quarter: "Q1" as const,
                },
                {
                    value: `${year}Q4`,
                    label: `${year}/${year + 1} Q2`,
                    financialYear,
                    quarter: "Q2" as const,
                },
                {
                    value: `${year + 1}Q1`,
                    label: `${year}/${year + 1} Q3`,
                    financialYear,
                    quarter: "Q3" as const,
                },
                {
                    value: `${year + 1}Q2`,
                    label: `${year}/${year + 1} Q4`,
                    financialYear,
                    quarter: "Q4" as const,
                },
            ];
        });
}

function getDefaultQuarterOption(
    quarterOptions: ReportingRatesQuarterOption[],
) {
    if (quarterOptions.length === 0) {
        return undefined;
    }
    const currentMonth = dayjs().month();
    const currentYear =
        currentMonth < 6 ? dayjs().subtract(1, "year").year() : dayjs().year();
    const currentFinancialYear = `${currentYear}July`;
    const { currentFinancialYear: configuredFinancialYear } = getDefaultPeriods(
        quarterOptions.map((item) => item.financialYear),
    );
    const activeFinancialYear = configuredFinancialYear || currentFinancialYear;
    const currentQuarter =
        currentMonth >= 6 && currentMonth <= 8
            ? "Q1"
            : currentMonth >= 9 && currentMonth <= 11
              ? "Q2"
              : currentMonth <= 2
                ? "Q3"
                : "Q4";

    return (
        quarterOptions.find(
            (option) =>
                option.financialYear === activeFinancialYear &&
                option.quarter === currentQuarter,
        ) ?? quarterOptions.at(-1)
    );
}

function getSharedCellStyle(label: string, width: number): React.CSSProperties {
    return {
        width,
        minWidth: width,
        verticalAlign: "top",
        padding: "6px 8px",
        fontFamily: "Cambria, Georgia, serif",
        lineHeight: 1.4,
        whiteSpace: "normal",
    };
}

function getBandCellStyle(
    band: ReportingRatesRow["performanceBand"],
): React.CSSProperties {
    const color =
        band === "green"
            ? PERFORMANCE_COLORS.green
            : band === "yellow"
              ? PERFORMANCE_COLORS.yellow
              : PERFORMANCE_COLORS.red;

    return {
        backgroundColor: color.bg,
        color: color.fg,
        margin: "-6px -8px",
        padding: "6px 8px",
        minHeight: "100%",
        textAlign: "center",
    };
}

function makeTextColumn(title: string, dataIndex: keyof ReportingRatesRow, width: number) {
    return {
        title,
        dataIndex,
        key: String(dataIndex),
        width,
        onHeaderCell: () => ({ style: getSharedCellStyle(title, width) }),
        onCell: () => ({ style: getSharedCellStyle(title, width) }),
    } satisfies NonNullable<TableProps<ReportingRatesRow>["columns"]>[number];
}

function makeNumberColumn(
    title: string,
    dataIndex: keyof ReportingRatesRow,
    width: number,
    align: "left" | "right" | "center",
) {
    return {
        title,
        dataIndex,
        key: String(dataIndex),
        width,
        align,
        onHeaderCell: () => ({ style: getSharedCellStyle(title, width) }),
        onCell: () => ({ style: getSharedCellStyle(title, width) }),
    } satisfies NonNullable<TableProps<ReportingRatesRow>["columns"]>[number];
}

function buildSubtitle(datasetName?: string, quarterLabel?: string) {
    const parts = ["Reporting Rates"];
    if (datasetName) {
        parts.push(`Dataset: ${datasetName}`);
    }
    if (quarterLabel) {
        parts.push(`Quarter: ${quarterLabel}`);
    }
    return parts.join(" | ");
}
