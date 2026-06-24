import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dayjs } from "dayjs";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    Col,
    DatePicker,
    Empty,
    InputNumber,
    Row,
    Select,
    Space,
    Table,
    Typography,
    Collapse,
} from "antd";
import type { TableProps } from "antd";
import {
    CloseCircleOutlined,
    DownloadOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
} from "@ant-design/icons";
import { OrgUnitSelect } from "../../../../components/organisation";
import { useWindowSize } from "../../../../hooks/use-window-size";
import {
    trackerLineListQueryOptions,
    trackerProgramMetadataQueryOptions,
    trackerProgramsQueryOptions,
} from "../../../../query-options";
import {
    exportTrackerTableToExcel,
    exportTrackerTableToPdf,
} from "../../../../utils/tracker-report-export";
import {
    TrackerLineListColumnMetadata,
    TrackerLineListRow,
} from "../../../../types";
import { RootRoute } from "../../../__root";
import { PolicyActionRoute } from "./route";

const { Text } = Typography;

export const PolicyActionIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => PolicyActionRoute,
    component: Component,
    errorComponent: () => (
        <div>Something went wrong loading Policy Actions.</div>
    ),
});

function Component() {
    const { engine } = PolicyActionIndexRoute.useRouteContext();
    const { ou: defaultOrgUnit } = RootRoute.useLoaderData();
    const { width: viewportWidth, height: viewportHeight } = useWindowSize();
    const mdaRootOrgUnit = defaultOrgUnit;
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedProgrammeTitle, setSelectedProgrammeTitle] = useState<string>();
    const [displayedProgramme, setDisplayedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [selectedPeriodRange, setSelectedPeriodRange] = useState<
        [Dayjs | null, Dayjs | null] | null
    >(null);
    const [hasInitializedDefaultMda, setHasInitializedDefaultMda] =
        useState(false);
    const [tableScrollY, setTableScrollY] = useState(320);
    const [reportPanelHeight, setReportPanelHeight] = useState<number>();
    const reportPanelRef = useRef<HTMLDivElement>(null);
    const reportHeaderRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const reportOrgUnitId = selectedMDA ?? mdaRootOrgUnit;
    const effectiveRootOrgUnitId = mdaRootOrgUnit ?? selectedMDA;
    const isCompactScreen = viewportWidth < 768;

    const trackerProgramsQuery = useQuery(trackerProgramsQueryOptions(engine));
    const metadataQuery = useQuery(
        trackerProgramMetadataQueryOptions(engine, displayedProgramme),
    );
    const lineListQuery = useQuery(
        trackerLineListQueryOptions(engine, {
            programId: displayedProgramme,
            rootOrgUnitId: effectiveRootOrgUnitId,
            orgUnitId: reportOrgUnitId,
            page: currentPage,
            pageSize,
            enabled: Boolean(displayedProgramme),
        }),
    );
    const summaryLineListQuery = useQuery(
        trackerLineListQueryOptions(engine, {
            programId: displayedProgramme,
            rootOrgUnitId: effectiveRootOrgUnitId,
            orgUnitId: reportOrgUnitId,
            fetchAll: true,
            enabled: Boolean(displayedProgramme),
        }),
    );

    const metadata = metadataQuery.data ?? [];
    const lineListRows = lineListQuery.data?.rows ?? [];
    const summaryLineListRows = summaryLineListQuery.data?.rows ?? [];
    const totalRecords = lineListQuery.data?.total ?? 0;
    const startDateColumn = useMemo(
        () => findStartDateColumn(metadata),
        [metadata],
    );
    const sortedRows = useMemo(
        () => sortRowsByStartDateDescending(lineListRows, startDateColumn),
        [lineListRows, startDateColumn],
    );
    const summaryRows = useMemo(
        () =>
            sortRowsByStartDateDescending(
                summaryLineListRows,
                startDateColumn,
            ),
        [startDateColumn, summaryLineListRows],
    );
    const summaryFilteredRows = useMemo(
        () =>
            filterRowsByPeriodRange(
                summaryRows,
                startDateColumn,
                selectedPeriodRange,
            ),
        [reportOrgUnitId, selectedPeriodRange, startDateColumn, summaryRows],
    );
    const rows = useMemo(
        () =>
            filterRowsByPeriodRange(
                sortedRows,
                startDateColumn,
                selectedPeriodRange,
            ),
        [selectedPeriodRange, sortedRows, startDateColumn],
    );
    const metadataById = useMemo(
        () => new Map(metadata.map((item) => [item.id, item])),
        [metadata],
    );
    const dynamicColumns = useMemo<TableProps<TrackerLineListRow>["columns"]>(
        () => [
            {
                title: "Vote",
                dataIndex: "orgUnitName",
                key: "orgUnitName",
                width: getColumnWidth("Vote"),
                align: getColumnAlignment("Vote"),
                ellipsis: true,
                onHeaderCell: () => ({
                    style: getSharedCellStyle("Vote"),
                }),
                onCell: () => ({
                    style: getSharedCellStyle("Vote"),
                }),
                render: (value?: string) =>
                    renderDynamicCellWithOptionSets(value, {
                        id: "orgUnitName",
                        label: "Vote",
                        source: "orgUnit",
                    }),
            },
            ...metadata.map((meta) => ({
                title: meta.label,
                dataIndex: meta.id,
                key: meta.id,
                width: getColumnWidth(meta.label),
                align: getColumnAlignment(meta.label),
                ellipsis: shouldEllipsizeColumn(meta.label),
                onHeaderCell: () => ({
                    style: getSharedCellStyle(meta.label),
                }),
                onCell: () => ({
                    style: getSharedCellStyle(meta.label),
                }),
                render: (value?: string) =>
                    renderDynamicCellWithOptionSets(value, meta),
            })),
        ],
        [metadata],
    );
    const hasRows = rows.length > 0;
    const reportScope = selectedMDA ? "Selected MDA" : "All MDAs";
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const emptyTableDescription =
        !reportOrgUnitId
            ? "No organisation unit is available for this user. Select a Vote in Advanced report filters to load entries."
            : "No entries found mapping criteria parameters.";
    const summaryCards = useMemo(
        () => [
            {
                key: "total-actions",
                title: "Policy Actions",
                value: summaryFilteredRows.filter(
                    (row) =>
                        getDisplayValue(
                            row["OkGVyVExDHQ"],
                            metadataById.get("OkGVyVExDHQ"),
                        ).trim() !== "",
                ).length,
                color: "#d8f0dd",
                textColor: "#1f6f43",
            },
            {
                key: "high-priority",
                title: "High Priority",
                value: summaryFilteredRows.filter(
                    (row) =>
                        getDisplayValue(
                            row["qxsx06YcyCI"],
                            metadataById.get("qxsx06YcyCI"),
                        ).toLowerCase() === "high",
                ).length,
                color: "#f6d4d0",
                textColor: "#9d2d22",
            },
            ...[
                "Not started",
                "In progress",
                "Completed",
                "Cancelled",
            ].map((status) => ({
                key: `progress-${status.toLowerCase().replace(/\s+/g, "-")}`,
                title: status,
                value: summaryFilteredRows.filter(
                    (row) =>
                        getDisplayValue(
                            row["bqmgZT9Hiwx"],
                            metadataById.get("bqmgZT9Hiwx"),
                        ).toLowerCase() === status.toLowerCase(),
                ).length,
                color:
                    status === "Completed"
                        ? "#d8f0dd"
                        : status === "In progress"
                          ? "#f8ebc2"
                          : "#f6d4d0",
                textColor:
                    status === "Completed"
                        ? "#1f6f43"
                        : status === "In progress"
                          ? "#8c6d1f"
                          : "#9d2d22",
            })),
        ],
        [metadataById, summaryFilteredRows],
    );

    React.useEffect(() => {
        const options = trackerProgramsQuery.data ?? [];
        if (!selectedProgramme && options.length > 0) {
            const preferred =
                options.find(({ name }) =>
                    name.toLowerCase().includes("policy action"),
                ) ?? options[0];
            setSelectedProgramme(preferred.id);
            setSelectedProgrammeTitle(preferred.name);
        }
    }, [selectedProgramme, trackerProgramsQuery.data]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [displayedProgramme, pageSize, reportOrgUnitId, selectedPeriodRange]);

    React.useEffect(() => {
        setDisplayedProgramme(selectedProgramme);
    }, [selectedProgramme]);

    React.useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const tableError = metadataQuery.error
        ? "Unable to load tracker programme metadata for the selected programme."
        : lineListQuery.error
          ? "Unable to load tracker line-list data for the selected criteria."
          : undefined;

    React.useEffect(() => {
        if (hasInitializedDefaultMda) return;
        if (defaultOrgUnit) {
            setSelectedMDA(defaultOrgUnit);
        }
        setHasInitializedDefaultMda(true);
    }, [defaultOrgUnit, hasInitializedDefaultMda]);

    React.useEffect(() => {
        if (!displayedProgramme) return;

        const updateTableLayout = () => {
            const panelTop =
                reportPanelRef.current?.getBoundingClientRect().top ?? 0;
            const availableHeight = Math.max(
                isCompactScreen ? 500 : 560,
                viewportHeight - panelTop - 20,
            );
            const headerHeight =
                reportHeaderRef.current?.getBoundingClientRect().height ?? 0;
            const summaryHeight =
                summaryRef.current?.getBoundingClientRect().height ?? 0;
            const footerHeight =
                footerRef.current?.getBoundingClientRect().height ?? 0;
            const errorHeight = tableError ? 32 : 0;
            const reservedHeight =
                headerHeight +
                summaryHeight +
                footerHeight +
                errorHeight +
                (isCompactScreen ? 84 : 96);
            setReportPanelHeight(availableHeight);
            setTableScrollY(
                Math.max(
                    isCompactScreen ? 220 : 280,
                    availableHeight - reservedHeight,
                ),
            );
        };

        const observer = new ResizeObserver(updateTableLayout);
        [
            reportPanelRef.current,
            reportHeaderRef.current,
            summaryRef.current,
            footerRef.current,
        ]
            .filter((element): element is Element => Boolean(element))
            .forEach((element) => observer.observe(element));

        updateTableLayout();
        const animationFrame = window.requestAnimationFrame(updateTableLayout);
        return () => {
            window.cancelAnimationFrame(animationFrame);
            observer.disconnect();
        };
    }, [
        isCompactScreen,
        displayedProgramme,
        selectedPeriodRange,
        tableError,
        viewportHeight,
        viewportWidth,
        rows.length,
    ]);

    const exportSubtitle = useMemo(() => {
        const parts = [`Programme: ${selectedProgrammeTitle ?? "Selected programme"}`];
        parts.push(`Scope: ${reportScope}`);
        if (selectedPeriodRange?.[0] || selectedPeriodRange?.[1]) {
            parts.push(
                `Period: ${formatPeriodRangeLabel(selectedPeriodRange)}`,
            );
        }
        return parts.join(" | ");
    }, [reportScope, selectedPeriodRange, selectedProgrammeTitle]);

    const handlePdfExport = useCallback(() => {
        if (!dynamicColumns || !hasRows) return;
        exportTrackerTableToPdf({
            columns: dynamicColumns,
            rows,
            title: "Policy Action Tracker",
            subtitle: exportSubtitle,
        });
    }, [dynamicColumns, exportSubtitle, hasRows, rows]);

    const handleExcelExport = useCallback(async () => {
        if (!dynamicColumns || !hasRows) return;
        await exportTrackerTableToExcel({
            columns: dynamicColumns,
            rows,
            title: "Policy Action Tracker",
            subtitle: exportSubtitle,
            sheetName: "Policy Actions",
        });
    }, [dynamicColumns, exportSubtitle, hasRows, rows]);

    const handleMdaClear = () => {
        setSelectedMDA(undefined);
    };

    return (
        <div className="policy-actions-page">
            <Row
                gutter={[16, 16]}
                align="stretch"
                className="policy-actions-controls-row"
            >
                <Col xs={24} md={14} className="policy-actions-control-col">
                    <Card
                        className="policy-actions-control-card policy-actions-program-card"
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
                        <Row
                            align="middle"
                            gutter={[12, 12]}
                            style={{ width: "100%" }}
                        >
                            <Col xs={24} sm={5}>
                                <Text strong style={{ fontSize: "14px" }}>
                                    Programme
                                </Text>
                            </Col>
                            <Col xs={24} sm={19}>
                                <Select
                                    placeholder="Please select a tracker programme"
                                    style={{ width: "100%" }}
                                    options={(trackerProgramsQuery.data ?? []).map(
                                        ({ id, name }) => ({
                                            value: id,
                                            label: name,
                                        }),
                                    )}
                                    value={selectedProgramme}
                                    loading={trackerProgramsQuery.isLoading}
                                    onChange={(value, option) => {
                                        const label = Array.isArray(option)
                                            ? undefined
                                            : option?.label;
                                        setSelectedProgramme(value);
                                        setSelectedProgrammeTitle(
                                            typeof label === "string"
                                                ? label
                                                : undefined,
                                        );
                                    }}
                                    filterOption={(input, option) =>
                                        String(option?.label ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    showSearch
                                    allowClear
                                />
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col xs={24} md={10} className="policy-actions-control-col">
                    <Card
                        className="policy-actions-control-card"
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
                                    <MinusSquareOutlined
                                        style={{ fontSize: "20px" }}
                                    />
                                ) : (
                                    <PlusSquareOutlined
                                        style={{ fontSize: "20px" }}
                                    />
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
                                                    Vote:
                                                </Text>
                                                <div className="policy-actions-filter-field">
                                                    <OrgUnitSelect
                                                        showFormItem={false}
                                                        value={selectedMDA}
                                                        onChange={(value) => {
                                                            setSelectedMDA(
                                                                typeof value ===
                                                                    "string"
                                                                    ? value
                                                                    : undefined,
                                                            );
                                                        }}
                                                    />
                                                    {selectedMDA && (
                                                        <Button
                                                            type="text"
                                                            icon={
                                                                <CloseCircleOutlined />
                                                            }
                                                            title="Clear MDA filter"
                                                            onClick={handleMdaClear}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="policy-actions-filter-row">
                                                <Text
                                                    strong
                                                    className="policy-actions-filter-label"
                                                >
                                                    Period:
                                                </Text>
                                                <div className="policy-actions-filter-field policy-actions-period-field">
                                                    <DatePicker.RangePicker
                                                        picker="month"
                                                        style={{
                                                            width:
                                                                isCompactScreen
                                                                    ? "100%"
                                                                    : "300px",
                                                            maxWidth: "100%",
                                                        }}
                                                        value={selectedPeriodRange}
                                                        onChange={(value) =>
                                                            setSelectedPeriodRange(
                                                                value
                                                                    ? [
                                                                          value[0],
                                                                          value[1],
                                                                      ]
                                                                    : null,
                                                            )
                                                        }
                                                        allowClear
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

            {displayedProgramme ? (
                <div
                    ref={reportPanelRef}
                    className="policy-actions-report-panel"
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
                        className="policy-actions-report-header"
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
                                alignItems: isCompactScreen
                                    ? "stretch"
                                    : "center",
                                justifyContent: "space-between",
                                width: "100%",
                                gap: "12px",
                                flexWrap: "wrap",
                            }}
                        >
                            <Text
                                strong
                                style={{
                                    fontSize: "18px",
                                    color: "#23364a",
                                    lineHeight: 1.1,
                                }}
                            >
                                {selectedProgrammeTitle ?? "Selected programme"}{" "}
                                - {reportScope}
                            </Text>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "10px",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Button
                                    icon={<DownloadOutlined />}
                                    disabled={!hasRows}
                                    className="policy-actions-download-button"
                                    onClick={handlePdfExport}
                                >
                                    Download PDF
                                </Button>
                                <Button
                                    icon={<DownloadOutlined />}
                                    disabled={!hasRows}
                                    className="policy-actions-download-button"
                                    onClick={() => {
                                        void handleExcelExport();
                                    }}
                                >
                                    Download Excel
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Row
                        ref={summaryRef}
                        gutter={[12, 12]}
                        style={{ marginBottom: "12px", flex: "0 0 auto" }}
                    >
                        {summaryCards.map((card) => (
                            <Col xs={24} sm={12} md={8} xl={4} key={card.key}>
                                <Card
                                    className="policy-actions-summary-card"
                                    size="small"
                                    variant="outlined"
                                    style={{ backgroundColor: card.color }}
                                    styles={{ body: { padding: "12px" } }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "4px",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            textAlign: "center",
                                            minHeight: "72px",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: "13px",
                                                color: card.textColor,
                                            }}
                                        >
                                            {card.title}
                                        </Text>
                                        <Text
                                            strong
                                            style={{
                                                fontSize: "24px",
                                                color: card.textColor,
                                                lineHeight: 1,
                                            }}
                                        >
                                            {card.value}
                                        </Text>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    {tableError && (
                        <Typography.Text
                            type="danger"
                            style={{ marginBottom: "8px", flex: "0 0 auto" }}
                        >
                            {tableError}
                        </Typography.Text>
                    )}

                    <div
                        className="policy-actions-table-region"
                        style={{
                            flex: 1,
                            minHeight: 0,
                            overflow: "hidden",
                        }}
                    >
                        <Table
                            className="policy-actions-table"
                            rowKey="key"
                            style={{ margin: 0, padding: 0 }}
                            dataSource={rows}
                            columns={dynamicColumns}
                            bordered
                            size="small"
                            tableLayout="auto"
                            loading={
                                metadataQuery.isFetching ||
                                lineListQuery.isFetching
                            }
                            pagination={false}
                            sticky
                            scroll={{
                                x: "max-content",
                                y: tableScrollY,
                            }}
                            locale={{
                                emptyText: (
                                    <Empty description={emptyTableDescription} />
                                ),
                            }}
                        />
                    </div>
                    <div
                        ref={footerRef}
                        className="policy-actions-footer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            borderTop: "1px solid #dcdcdc",
                            background: "#f4f6f8",
                            padding: "10px 12px",
                            flexWrap: "wrap",
                            position: "relative",
                            zIndex: 1,
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
                                options={[5, 10, 25, 50, 100, 200, 500].map((value) => ({
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
                </div>
            ) : (
                <div
                    className="policy-actions-empty-state"
                    style={{ margin: "0", textAlign: "center" }}
                >
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Choose a tracking programme to load policy action records. Filters apply automatically."
                    />
                </div>
            )}
        </div>
    );
}

function getColumnWidth(label: string): number | undefined {
    const normalized = label.toLowerCase();
    if (
        normalized.includes("policy action") ||
        normalized.includes("directive") ||
        normalized.includes("description") ||
        normalized.includes("remarks")
    ) {
        return 210;
    }
    if (normalized === "vote" || normalized.includes("organisation unit")) {
        return 120;
    }
    if (
        normalized.includes("contributing") ||
        normalized.includes("responsible officer") ||
        normalized.includes("institution") ||
        normalized.includes("ministry")
    ) {
        return 140;
    }
    if (normalized.includes("start date") || normalized.includes("end date")) {
        return 112;
    }
    if (normalized.includes("duration")) return 88;
    if (
        normalized.includes("progress") ||
        normalized.includes("priority") ||
        normalized.includes("delayed") ||
        normalized.includes("status") ||
        normalized.includes("performance rating")
    ) {
        return 84;
    }
    if (normalized.includes("action id")) return 76;
    if (normalized.includes("source")) return 130;
    return undefined;
}

function getColumnAlignment(label: string): "left" | "center" {
    const normalized = label.toLowerCase();
    if (
        normalized.includes("progress") ||
        normalized.includes("priority") ||
        normalized.includes("delayed") ||
        normalized.includes("status") ||
        normalized.includes("performance rating") ||
        normalized.includes("date") ||
        normalized.includes("duration") ||
        normalized.includes("action id")
    ) {
        return "center";
    }
    return "left";
}

function shouldEllipsizeColumn(label: string) {
    const normalized = label.toLowerCase();
    return (
        normalized.includes("policy action") ||
        normalized.includes("directive") ||
        normalized.includes("description") ||
        normalized.includes("remarks") ||
        normalized.includes("source") ||
        normalized.includes("contributing") ||
        normalized.includes("responsible officer") ||
        normalized.includes("organisation unit") ||
        normalized === "vote"
    );
}

function formatPeriodRangeLabel(
    value: [Dayjs | null, Dayjs | null] | null,
): string {
    if (!value) return "All periods";
    const [start, end] = value;
    const startLabel = start?.format("MMM YYYY");
    const endLabel = end?.format("MMM YYYY");
    if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
    return startLabel ?? endLabel ?? "All periods";
}

function findStartDateColumn(
    metadata: TrackerLineListColumnMetadata[],
): TrackerLineListColumnMetadata | undefined {
    return (
        metadata.find(({ label }) => {
            const normalized = label.toLowerCase();
            return normalized.includes("start date (planned)");
        }) ??
        metadata.find(({ label }) => label.toLowerCase().includes("start date"))
    );
}

function sortRowsByStartDateDescending(
    rows: TrackerLineListRow[],
    startDateColumn?: TrackerLineListColumnMetadata,
) {
    if (!startDateColumn) return rows;

    return [...rows].sort((left, right) => {
        const leftTime = parseDateSortValue(left[startDateColumn.id]);
        const rightTime = parseDateSortValue(right[startDateColumn.id]);
        return rightTime - leftTime;
    });
}

function filterRowsByPeriodRange(
    rows: TrackerLineListRow[],
    startDateColumn: TrackerLineListColumnMetadata | undefined,
    periodRange?: [Dayjs | null, Dayjs | null] | null,
) {
    if (!periodRange || !startDateColumn) return rows;

    const periodBounds = getMonthRangeBounds(periodRange);
    if (!periodBounds) return rows;

    return rows.filter((row) => {
        const rowTime = parseDateSortValue(row[startDateColumn.id]);
        if (!Number.isFinite(rowTime)) return false;
        return rowTime >= periodBounds.start && rowTime <= periodBounds.end;
    });
}

function getMonthRangeBounds(periodRange: [Dayjs | null, Dayjs | null]) {
    const [start, end] = periodRange;
    if (!start || !end) return undefined;

    return {
        start: start.startOf("month").valueOf(),
        end: end.endOf("month").valueOf(),
    };
}

function parseDateSortValue(value?: string) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function getDisplayValue(
    value: string | undefined,
    meta?: TrackerLineListColumnMetadata,
) {
    const rawValue = value ?? "";
    const optionsMap = new Map(
        meta?.optionSet?.options.map(({ code, name }) => [code, name]) ?? [],
    );
    const optionValue = optionsMap.get(rawValue);
    if (optionValue) return optionValue;

    const normalizedLabel = meta?.label.toLowerCase() ?? "";
    if (normalizedLabel.includes("delayed")) {
        if (rawValue.toLowerCase() === "true") return "Yes";
        if (rawValue.toLowerCase() === "false") return "No";
    }

    return formatNumericDisplayValue(rawValue);
}

function getCellHighlightStyle(
    label: string,
    value: string,
): React.CSSProperties {
    const normalizedLabel = label.toLowerCase();
    const normalizedValue = value.trim().toLowerCase();

    if (!normalizedValue) return {};

    if (normalizedLabel.includes("priority")) {
        if (normalizedValue === "high") return highlightedCell("#C46A61");
        if (normalizedValue === "normal") return highlightedCell("#F1D265");
    }

    if (normalizedLabel.includes("progress")) {
        if (normalizedValue.includes("complete")) {
            return highlightedCell("#58A071");
        }
        if (normalizedValue.includes("progress")) {
            return highlightedCell("#F1D265");
        }
        if (normalizedValue.includes("not") || normalizedValue.includes("delay")) {
            return highlightedCell("#C46A61");
        }
    }

    if (normalizedLabel.includes("performance rating")) {
        const numericValue = Number(normalizedValue.replace("%", ""));
        if (Number.isFinite(numericValue)) {
            if (numericValue >= 80) return highlightedCell("#58A071");
            if (numericValue >= 50) return highlightedCell("#F1D265");
            return highlightedCell("#C46A61");
        }
    }

    if (normalizedLabel.includes("delayed")) {
        if (normalizedValue === "no") return highlightedCell("#58A071");
        if (normalizedValue === "yes") return highlightedCell("#C46A61");
    }

    return {};
}

function highlightedCell(backgroundColor: string): React.CSSProperties {
    return {
        backgroundColor,
        color: "#111111",
        display: "block",
        width: "calc(100% + 16px)",
        margin: "-6px -8px",
        minHeight: "44px",
        padding: "6px 8px",
    };
}

function getSharedCellStyle(label: string): React.CSSProperties {
    const width = getColumnWidth(label);
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

function renderDynamicCellWithOptionSets(
    value: string | undefined,
    meta: TrackerLineListColumnMetadata,
) {
    const displayValue = getDisplayValue(value, meta);

    return (
        <div
            style={{
                ...getCellHighlightStyle(meta.label, displayValue),
                fontFamily: "Cambria, Georgia, serif",
                lineHeight: 1.4,
                whiteSpace: "normal",
                minHeight: "100%",
            }}
        >
            {displayValue}
        </div>
    );
}

function formatNumericDisplayValue(value: string) {
    if (!/^-?\d+\.\d+$/.test(value)) {
        return value;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return value;
    }
    return numericValue.toFixed(2).replace(/\.00$/, "");
}

function downloadCsv(
    columns: TableProps<TrackerLineListRow>["columns"],
    rows: TrackerLineListRow[],
    filename: string,
) {
    const leafColumns = (columns ?? []).filter(
        (column): column is CsvColumn =>
            "dataIndex" in column &&
            typeof (column as CsvColumn).dataIndex === "string",
    );
    const headers = leafColumns.map((column) => textFromReactNode(column.title));
    const csvRows = rows.map((row, rowIndex) =>
        leafColumns.map((column) => {
            const value = row[column.dataIndex] ?? "";
            const rendered = column.render?.(value, row, rowIndex);
            return escapeCsvCell(textFromReactNode(rendered ?? value));
        }),
    );
    const csv = [
        headers.map(escapeCsvCell).join(","),
        ...csvRows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

type CsvColumn = {
    dataIndex: string;
    title?: React.ReactNode;
    render?: (
        value: string,
        record: TrackerLineListRow,
        index: number,
    ) => React.ReactNode;
};

function textFromReactNode(value: React.ReactNode): string {
    if (value === null || value === undefined || typeof value === "boolean") {
        return "";
    }
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map(textFromReactNode).join("");
    }
    if (React.isValidElement(value)) {
        const props = value.props as { children?: React.ReactNode };
        return textFromReactNode(props.children);
    }
    return "";
}

function escapeCsvCell(value: string) {
    const text = String(value);
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
