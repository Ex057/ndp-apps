import {
    CloseCircleOutlined,
    DownloadOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { uniqBy } from "lodash";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    Checkbox,
    Col,
    Collapse,
    Dropdown,
    Empty,
    InputNumber,
    Row,
    Select,
    Space,
    Table,
    Typography,
} from "antd";
import type { TableProps } from "antd";
import { OrgUnitSelect } from "../../../../components/organisation";
import { db } from "../../../../db";
import { useWindowSize } from "../../../../hooks/use-window-size";
import {
    reportingRateSummariesQueryOptions,
    type ReportingRateSummaryRow,
} from "../../../../query-options";
import { RootRoute } from "../../../__root";
import { ReportingRatesRoute } from "./route";
import {
    exportTrackerTableToExcel,
    exportTrackerTableToPdf,
} from "../../../../utils/tracker-report-export";
import { getDefaultPeriods, PERFORMANCE_COLORS } from "../../../../utils";

const { Text } = Typography;

const QUARTER_KEYS = ["Q1", "Q2", "Q3", "Q4"] as const;

type QuarterKey = (typeof QUARTER_KEYS)[number];
type PeriodColumnKey = QuarterKey | "financialYear";
type Band = "green" | "yellow" | "red";
type PeriodSortOrder = "ascend" | "descend";

export const ReportingRatesIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ReportingRatesRoute,
    component: Component,
});

function Component() {
    const { engine } = ReportingRatesRoute.useRouteContext();
    const { v } = ReportingRatesIndexRoute.useSearch();
    const { configurations, programs, ou: defaultOrgUnit } =
        RootRoute.useLoaderData();
    const { width: viewportWidth, height: viewportHeight } = useWindowSize();
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [selectedFinancialYear, setSelectedFinancialYear] = useState<string>();
    const [selectedQuarters, setSelectedQuarters] = useState<QuarterKey[]>([
        ...QUARTER_KEYS,
    ]);
    const [hasInitializedDefaultMda, setHasInitializedDefaultMda] =
        useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
    const [selectedPeriodByRowKey, setSelectedPeriodByRowKey] = useState<
        Partial<Record<string, PeriodColumnKey>>
    >({});
    const [sortField, setSortField] = useState<PeriodColumnKey>();
    const [sortOrder, setSortOrder] = useState<PeriodSortOrder>();
    const [reportPanelHeight, setReportPanelHeight] = useState<number>();
    const [tableScrollY, setTableScrollY] = useState(320);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const reportPanelRef = useRef<HTMLDivElement>(null);
    const reportHeaderRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);

    const financialYears = v ? configurations[v]?.data?.financialYears ?? [] : [];

    const cachedIndicators =
        useLiveQuery(async () => {
            if (!v) {
                return [];
            }
            return db.dataElements.where("fsIKncW1Eps").equals(v).toArray();
        }, [v]) ?? [];

    const uniqueIndicators = useMemo(
        () => uniqBy(cachedIndicators, "id"),
        [cachedIndicators],
    );

    useEffect(() => {
        if (selectedFinancialYear || financialYears.length === 0) {
            return;
        }
        const { currentFinancialYear } = getDefaultPeriods(financialYears);
        const fallbackFinancialYear = financialYears.slice().sort().at(-1) ?? "";
        setSelectedFinancialYear(currentFinancialYear || fallbackFinancialYear);
    }, [financialYears, selectedFinancialYear]);

    useEffect(() => {
        setSelectedQuarters([...QUARTER_KEYS]);
    }, [selectedFinancialYear]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, selectedFinancialYear, selectedMDA, selectedProgramme, selectedQuarters]);

    useEffect(() => {
        setExpandedRowKeys([]);
    }, [selectedFinancialYear, selectedMDA, selectedProgramme, selectedQuarters]);

    useEffect(() => {
        setSelectedPeriodByRowKey({});
    }, [selectedFinancialYear, selectedMDA, selectedProgramme, selectedQuarters]);

    useEffect(() => {
        if (hasInitializedDefaultMda) return;
        if (defaultOrgUnit) {
            setSelectedMDA(defaultOrgUnit);
        }
        setHasInitializedDefaultMda(true);
    }, [defaultOrgUnit, hasInitializedDefaultMda]);

    const programmeOptions = useMemo(() => {
        const scopeRootOrgUnitId = selectedMDA ?? defaultOrgUnit;
        const availableProgrammeCodes = new Set<string>();
        uniqueIndicators.forEach((indicator) => {
            const assignments = Array.isArray(indicator.datasetAssignments)
                ? indicator.datasetAssignments
                : [];
            const isInScope =
                !scopeRootOrgUnitId ||
                assignments.some((assignment) =>
                    String(assignment.path ?? "")
                        .split("/")
                        .filter(Boolean)
                        .includes(scopeRootOrgUnitId),
                );
            if (!isInScope) {
                return;
            }
            const code = getProgrammeCode(indicator);
            if (code) {
                availableProgrammeCodes.add(code);
            }
        });

        return programs
            .filter((programme) => availableProgrammeCodes.has(programme.code))
            .map((programme) => ({
                id: programme.id,
                name: programme.name,
                code: programme.code,
            }));
    }, [defaultOrgUnit, programs, selectedMDA, uniqueIndicators]);

    const selectedProgrammeOption = useMemo(
        () =>
            programmeOptions.find((programme) => programme.id === selectedProgramme),
        [programmeOptions, selectedProgramme],
    );

    useEffect(() => {
        if (
            selectedProgramme &&
            !programmeOptions.some((programme) => programme.id === selectedProgramme)
        ) {
            setSelectedProgramme(undefined);
        }
    }, [programmeOptions, selectedProgramme]);

    const financialYearOptions = useMemo(
        () =>
            financialYears.slice().sort().map((financialYear) => ({
                label: formatFinancialYearLabel(financialYear),
                value: financialYear,
            })),
        [financialYears],
    );

    const quarterOptions = useMemo(
        () =>
            QUARTER_KEYS.map((quarter) => ({
                label: quarter,
                value: quarter,
            })),
        [],
    );

    const reportRowsQuery = useQuery(
        reportingRateSummariesQueryOptions({
            engine,
            ndpVersion: v ?? "",
            programme: selectedProgrammeOption?.code,
            programmes: programs,
            orgUnitId: selectedMDA,
            defaultOrgUnitId: defaultOrgUnit,
            financialYear: selectedFinancialYear,
            quarters: selectedQuarters,
            view: "vote",
        }),
    );

    const allRows = reportRowsQuery.data ?? [];
    const sortedRows = useMemo(
        () => sortReportingRateRows(allRows, sortField, sortOrder),
        [allRows, sortField, sortOrder],
    );
    const pagedRows = useMemo(
        () =>
            sortedRows.slice(
                (currentPage - 1) * pageSize,
                (currentPage - 1) * pageSize + pageSize,
            ),
        [sortedRows, currentPage, pageSize],
    );
    const totalPages = Math.max(
        1,
        Math.ceil(sortedRows.length / Math.max(pageSize, 1)),
    );

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

    const selectedPeriodColumns = useMemo(
        () => [...selectedQuarters, "financialYear"] as PeriodColumnKey[],
        [selectedQuarters],
    );

    const summaryCards = useMemo(() => {
        const assigned = sortedRows.reduce(
            (sum, row) => sum + row.assignedDataSetCount,
            0,
        );
        const financialYearRate =
            sortedRows.length === 0
                ? 0
                : sortedRows.reduce(
                    (sum, row) => sum + row.periodSummaries.financialYear.rate,
                    0,
                ) / sortedRows.length;

        return [
            {
                title: "MDA/LG",
                value: sortedRows.length,
                bg: "#d8e8ff",
                color: "#1f4b8f",
            },
            {
                title: "Assigned Datasets",
                value: assigned,
                bg: "#d7f1ef",
                color: "#16656b",
            },
            {
                title: "Financial Year Rate",
                value: `${Math.round(financialYearRate)}%`,
                bg: "#f8ebc2",
                color: "#8c6d1f",
            },
        ];
    }, [sortedRows]);

    const columns = useMemo<TableProps<ReportingRateSummaryRow>["columns"]>(
        () => [
            makeTextColumn("MDA/LG", "entityName", 220),
            ...selectedPeriodColumns.map((periodKey) =>
                makePeriodColumn(
                    periodKey === "financialYear" ? "Financial Year" : periodKey,
                    periodKey,
                    periodKey === "financialYear" ? 180 : 160,
                    sortField,
                    sortOrder,
                    selectedPeriodByRowKey,
                    setExpandedRowKeys,
                    setSelectedPeriodByRowKey,
                ),
            ),
        ],
        [selectedPeriodByRowKey, selectedPeriodColumns, sortField, sortOrder],
    );

    const handlePdfExport = useCallback(() => {
        if (sortedRows.length === 0) return;
        void exportTrackerTableToPdf({
            columns,
            rows: sortedRows,
            title: "Reporting Rate Completeness",
            subtitle: buildSubtitle(
                selectedProgramme ? selectedProgrammeOption?.name : undefined,
                selectedFinancialYear,
                selectedQuarters,
                selectedMDA ? "Filtered subtree" : "All org units",
            ),
        });
    }, [
        columns,
        selectedFinancialYear,
        selectedMDA,
        selectedProgramme,
        selectedProgrammeOption,
        selectedQuarters,
        sortedRows,
    ]);

    const handleExcelExport = useCallback(() => {
        if (sortedRows.length === 0) return;
        void exportTrackerTableToExcel({
            columns,
            rows: sortedRows,
            title: "Reporting Rate Completeness",
            subtitle: buildSubtitle(
                selectedProgramme ? selectedProgrammeOption?.name : undefined,
                selectedFinancialYear,
                selectedQuarters,
                selectedMDA ? "Filtered subtree" : "All org units",
            ),
            sheetName: "Reporting Rate Completeness",
        });
    }, [
        columns,
        selectedFinancialYear,
        selectedMDA,
        selectedProgramme,
        selectedProgrammeOption,
        selectedQuarters,
        sortedRows,
    ]);

    const handleTableChange: TableProps<ReportingRateSummaryRow>["onChange"] = (
        _pagination,
        _filters,
        sorter,
    ) => {
        if (Array.isArray(sorter)) {
            return;
        }
        const field = sorter.field ?? sorter.columnKey;
        if (
            field !== "Q1" &&
            field !== "Q2" &&
            field !== "Q3" &&
            field !== "Q4" &&
            field !== "financialYear"
        ) {
            setSortField(undefined);
            setSortOrder(undefined);
            return;
        }

        if (!sorter.order) {
            setSortField(undefined);
            setSortOrder(undefined);
            return;
        }

        setSortField(field);
        setSortOrder(sorter.order === "descend" ? "descend" : "ascend");
    };

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
                <div ref={reportHeaderRef} style={{ marginBottom: "12px" }}>
                    <Row gutter={[16, 16]} align="stretch">
                        <Col xs={24} md={14}>
                            <Card
                                size="small"
                                style={{
                                    backgroundColor: "#d0ebd0",
                                    borderColor: "#a4d2a3",
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "3px",
                                }}
                                styles={{
                                    body: {
                                        padding: "12px",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "flex-start",
                                    },
                                }}
                            >
                                <Row align="middle" gutter={[12, 12]} style={{ width: "100%" }}>
                                    <Col xs={24} sm={5}>
                                        <Text strong style={{ fontSize: "14px" }}>
                                            Programme
                                        </Text>
                                    </Col>
                                    <Col xs={24} sm={19}>
                                        <Select
                                            allowClear
                                            placeholder="Select programme"
                                            value={selectedProgramme}
                                            options={programmeOptions}
                                            fieldNames={{ label: "name", value: "id" }}
                                            style={{ width: "100%" }}
                                            onChange={(value) => setSelectedProgramme(value)}
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                        <Col xs={24} md={10}>
                            <Card
                                size="small"
                                style={{
                                    backgroundColor: "#bbd1ee",
                                    borderColor: "#729fcf",
                                    height: "100%",
                                    width: "100%",
                                    borderRadius: "3px",
                                }}
                                styles={{ body: { padding: "12px", height: "100%" } }}
                            >
                                <Collapse
                                    bordered={false}
                                    activeKey={isAdvancedFiltersOpen ? ["filters"] : []}
                                    onChange={(keys) =>
                                        setIsAdvancedFiltersOpen(
                                            Array.isArray(keys)
                                                ? keys.includes("filters")
                                                : keys === "filters",
                                        )
                                    }
                                    expandIcon={({ isActive }) =>
                                        isActive ? (
                                            <MinusSquareOutlined style={{ fontSize: "20px" }} />
                                        ) : (
                                            <PlusSquareOutlined style={{ fontSize: "20px" }} />
                                        )
                                    }
                                    expandIconPosition="end"
                                    items={[
                                        {
                                            key: "filters",
                                            label: (
                                                <Text strong style={{ fontSize: "14px" }}>
                                                    Advanced report filters
                                                </Text>
                                            ),
                                            children: (
                                                <Space
                                                    direction="vertical"
                                                    size={16}
                                                    style={{ width: "100%" }}
                                                >
                                                    <div className="policy-actions-filter-row">
                                                        <Text
                                                            strong
                                                            className="policy-actions-filter-label"
                                                        >
                                                            MDA/LG
                                                        </Text>
                                                        <div className="policy-actions-filter-field">
                                                            <OrgUnitSelect
                                                                showFormItem={false}
                                                                value={selectedMDA}
                                                                onChange={(value) =>
                                                                    setSelectedMDA(
                                                                        typeof value === "string"
                                                                            ? value
                                                                            : undefined,
                                                                    )
                                                                }
                                                                label="MDA/LG"
                                                            />
                                                            {selectedMDA && (
                                                                <Button
                                                                    type="text"
                                                                    icon={<CloseCircleOutlined />}
                                                                    title="Clear MDA filter"
                                                                    onClick={() =>
                                                                        setSelectedMDA(undefined)
                                                                    }
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="policy-actions-filter-row">
                                                        <Text
                                                            strong
                                                            className="policy-actions-filter-label"
                                                        >
                                                            Financial Year
                                                        </Text>
                                                        <div className="policy-actions-filter-field">
                                                            <Select
                                                                placeholder="Select financial year"
                                                                value={selectedFinancialYear}
                                                                options={financialYearOptions}
                                                                style={{ width: "100%" }}
                                                                onChange={(value) =>
                                                                    setSelectedFinancialYear(value)
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                    }}
                >
                    <div style={{ minWidth: "220px", flex: 1 }}>
                        <Text
                            strong
                            style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}
                        >
                            Quarters
                        </Text>
                        <Select
                            mode="multiple"
                            placeholder="Select quarters"
                            value={selectedQuarters}
                            options={quarterOptions}
                            maxTagCount="responsive"
                            style={{ width: "100%" }}
                            onChange={(values) =>
                                setSelectedQuarters(orderSelectedQuarters(values as QuarterKey[]))
                            }
                        />
                    </div>
                    <div style={{ minWidth: "240px", flex: 1 }}>
                        <div style={{ minHeight: "56px" }} />
                    </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                    <Dropdown
                        menu={{
                            items: [
                                { key: "pdf", label: "PDF", onClick: handlePdfExport },
                                { key: "excel", label: "Excel", onClick: handleExcelExport },
                            ],
                        }}
                        trigger={["click"]}
                    >
                        <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            disabled={sortedRows.length === 0}
                        />
                    </Dropdown>
                </div>

                {!selectedFinancialYear || selectedQuarters.length === 0 ? (
                    <div className="reporting-rates-empty-state">
                        <Empty description="Choose a financial year and at least one quarter to view reporting rate completeness." />
                    </div>
                ) : (
                    <>
                        <div ref={summaryRef} style={{ marginBottom: "8px" }}>
                            <Row gutter={[12, 12]} style={{ marginBottom: "8px" }}>
                                {summaryCards.map((card) => (
                                    <Col key={card.title} xs={24} sm={12} md={8} lg={6}>
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
                                            <Text
                                                strong
                                                style={{ color: card.color, fontSize: "14px" }}
                                            >
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
                                Unable to load reporting rate completeness for the selected criteria.
                            </Typography.Text>
                        )}

                        <div
                            className="reporting-rates-table-region"
                            style={{ flex: 1, minHeight: 0, overflow: "auto" }}
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
                                onChange={handleTableChange}
                                pagination={false}
                                sticky
                                scroll={{ x: "max-content", y: tableScrollY }}
                                expandable={{
                                    showExpandColumn: false,
                                    expandedRowKeys,
                                    expandedRowRender: (record) => (
                                        <VoteExpandedTable
                                            record={record}
                                            selectedPeriod={
                                                selectedPeriodByRowKey[record.key] ??
                                                "financialYear"
                                            }
                                        />
                                    ),
                                    rowExpandable: (record) => record.assignedDataSets.length > 0,
                                }}
                                locale={{
                                    emptyText: (
                                        <Empty description="No eligible dataset assignments matched the selected filters." />
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

function orderSelectedQuarters(quarters: QuarterKey[]) {
    return QUARTER_KEYS.filter((quarter) => quarters.includes(quarter));
}

function getProgrammeCode(indicator: Record<string, unknown>) {
    return String(
        indicator.ndpProgramme ??
            indicator["NDP Programme List"] ??
            indicator["UBWSASWdyfi"] ??
            indicator["Programme"] ??
            "",
    ).trim();
}

function formatFinancialYearLabel(financialYear: string) {
    const startYear = Number(financialYear.slice(0, 4));
    if (!Number.isFinite(startYear)) {
        return financialYear;
    }
    return `${startYear}/${startYear + 1}`;
}

function getSharedCellStyle(width: number): React.CSSProperties {
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

function getBandCellStyle(band: Band): React.CSSProperties {
    const color =
        band === "green"
            ? PERFORMANCE_COLORS.green
            : band === "yellow"
              ? PERFORMANCE_COLORS.yellow
              : PERFORMANCE_COLORS.red;

    return {
        backgroundColor: color.bg,
        color: "#ffffff",
        textAlign: "center",
    };
}

function getSelectedPeriodCellStyle(): React.CSSProperties {
    return {
        backgroundColor: "#d8ecff",
        color: "#1f4b8f",
        boxShadow: "inset 0 0 0 2px #69b1ff",
        textAlign: "center",
    };
}

function makeTextColumn(
    title: string,
    dataIndex: keyof ReportingRateSummaryRow,
    width: number,
) {
    return {
        title,
        dataIndex,
        key: String(dataIndex),
        width,
        onHeaderCell: () => ({ style: getSharedCellStyle(width) }),
        onCell: () => ({ style: getSharedCellStyle(width) }),
    } satisfies NonNullable<TableProps<ReportingRateSummaryRow>["columns"]>[number];
}

function makePeriodColumn(
    title: string,
    periodKey: PeriodColumnKey,
    width: number,
    sortField: PeriodColumnKey | undefined,
    sortOrder: PeriodSortOrder | undefined,
    selectedPeriodByRowKey: Partial<Record<string, PeriodColumnKey>>,
    setExpandedRowKeys: React.Dispatch<React.SetStateAction<React.Key[]>>,
    setSelectedPeriodByRowKey: React.Dispatch<
        React.SetStateAction<Partial<Record<string, PeriodColumnKey>>>
    >,
) {
    return {
        title,
        key: periodKey,
        dataIndex: periodKey,
        sorter: true,
        sortOrder: sortField === periodKey ? sortOrder : null,
        width,
        align: "center" as const,
        onHeaderCell: () => ({ style: getSharedCellStyle(width) }),
        onCell: (record: ReportingRateSummaryRow) => ({
            style: {
                ...getSharedCellStyle(width),
                ...(selectedPeriodByRowKey[record.key] === periodKey
                    ? getSelectedPeriodCellStyle()
                    : getBandCellStyle(record.periodSummaries[periodKey].performanceBand)),
                cursor: record.assignedDataSets.length > 0 ? "pointer" : "default",
            },
            onClick: (event: React.MouseEvent) => {
                event.stopPropagation();
                if (record.assignedDataSets.length === 0) {
                    return;
                }

                setSelectedPeriodByRowKey((current) => {
                    const existingPeriod = current[record.key];
                    const isSameSelection = existingPeriod === periodKey;

                    setExpandedRowKeys((expandedKeys) => {
                        const isExpanded = expandedKeys.includes(record.key);
                        if (isExpanded && isSameSelection) {
                            return expandedKeys.filter((key) => key !== record.key);
                        }
                        if (isExpanded) {
                            return expandedKeys;
                        }
                        return [...expandedKeys, record.key];
                    });

                    if (isSameSelection) {
                        const next = { ...current };
                        delete next[record.key];
                        return next;
                    }

                    return {
                        ...current,
                        [record.key]: periodKey,
                    };
                });
            },
        }),
        render: (_: unknown, record: ReportingRateSummaryRow) =>
            record.periodSummaries[periodKey].display,
    } satisfies NonNullable<TableProps<ReportingRateSummaryRow>["columns"]>[number];
}

function VoteExpandedTable({
    record,
    selectedPeriod,
}: {
    record: ReportingRateSummaryRow;
    selectedPeriod: PeriodColumnKey;
}) {
    return (
        <div>
            <div
                style={{
                    marginBottom: "8px",
                    color: "#1f4b8f",
                    fontWeight: 600,
                }}
            >
                Selected period detail:{" "}
                {selectedPeriod === "financialYear" ? "Financial Year" : selectedPeriod}
            </div>
            <Table
                className="reporting-rates-expanded-table"
                rowKey="key"
                size="small"
                pagination={false}
                dataSource={record.assignedDataSets}
                scroll={{ x: "max-content" }}
                columns={[
                    {
                        title: "Dataset",
                        dataIndex: "dataSetName",
                        key: "dataSetName",
                        width: 260,
                    },
                    {
                        title: "Reporting Cycle",
                        dataIndex: "periodType",
                        key: "periodType",
                        width: 180,
                        render: (value: string) => value || "-",
                    },
                    {
                        title: "Levels",
                        dataIndex: "indicatorGroupTypeLabel",
                        key: "indicatorGroupTypeLabel",
                        width: 260,
                        render: (value: string) => value || "-",
                    },
                    {
                        title: "Reported",
                        key: "reported",
                        align: "center",
                        width: 120,
                        render: (_: unknown, row) => (
                            <Checkbox
                                checked={row.reportedByPeriod[selectedPeriod]}
                                disabled
                            />
                        ),
                    },
                ]}
            />
        </div>
    );
}

function sortReportingRateRows(
    rows: ReportingRateSummaryRow[],
    sortField: PeriodColumnKey | undefined,
    sortOrder: PeriodSortOrder | undefined,
) {
    if (!sortField || !sortOrder) {
        return rows;
    }

    const direction = sortOrder === "descend" ? -1 : 1;

    return [...rows].sort((left, right) => {
        const rateDifference =
            left.periodSummaries[sortField].rate - right.periodSummaries[sortField].rate;
        if (rateDifference !== 0) {
            return rateDifference * direction;
        }

        return left.entityName.localeCompare(right.entityName) * direction;
    });
}

function buildSubtitle(
    programmeName: string | undefined,
    financialYear: string | undefined,
    quarters: QuarterKey[],
    scopeLabel: string,
) {
    const parts = ["Reporting Rate Completeness", scopeLabel];
    if (programmeName) {
        parts.push(`Programme: ${programmeName}`);
    }
    if (financialYear) {
        parts.push(`Financial Year: ${formatFinancialYearLabel(financialYear)}`);
    }
    if (quarters.length > 0) {
        parts.push(`Quarters: ${orderSelectedQuarters(quarters).join(", ")}`);
    }
    return parts.join(" | ");
}
