import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    Col,
    Collapse,
    Empty,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Table,
    Typography,
} from "antd";
import type { TableProps } from "antd";
import {
    CloseCircleOutlined,
    DownloadOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import { useWindowSize } from "../../../../hooks/use-window-size";
import {
    trackerLineListQueryOptions,
    trackerProgramMetadataQueryOptions,
    trackerProgramsQueryOptions,
} from "../../../../query-options";
import { OrgUnitSelect } from "../../../../components/organisation";
import {
    exportTrackerTableToExcel,
    exportTrackerTableToPdf,
} from "../../../../utils/tracker-report-export";
import { TrackerLineListColumnMetadata, TrackerLineListRow } from "../../../../types";
import { RootRoute } from "../../../__root";
import { ProjectPerformanceRoute } from "./route";

const { Text } = Typography;

export const ProjectPerformanceIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ProjectPerformanceRoute,
    component: Component,
    errorComponent: () => <div>Something went wrong loading Project Performance.</div>,
});

function Component() {
    const { engine } = ProjectPerformanceIndexRoute.useRouteContext();
    const { ou: defaultOrgUnit } = RootRoute.useLoaderData();
    const { width: viewportWidth, height: viewportHeight } = useWindowSize();
    const mdaRootOrgUnit = defaultOrgUnit;
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedProgrammeTitle, setSelectedProgrammeTitle] = useState<string>();
    const [displayedProgramme, setDisplayedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchDraft, setSearchDraft] = useState<Record<string, string>>({});
    const [appliedSearch, setAppliedSearch] = useState<Record<string, string>>({});
    const [expandedRowKey, setExpandedRowKey] = useState<string>();
    const [activeStageLabel, setActiveStageLabel] = useState<string>();
    const [hasInitializedDefaultMda, setHasInitializedDefaultMda] =
        useState(false);
    const [tableScrollY, setTableScrollY] = useState(320);
    const [reportPanelHeight, setReportPanelHeight] = useState<number>();
    const reportPanelRef = useRef<HTMLDivElement>(null);
    const reportHeaderRef = useRef<HTMLDivElement>(null);
    const searchPanelRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const reportOrgUnitId = selectedMDA ?? mdaRootOrgUnit;
    const effectiveRootOrgUnitId = mdaRootOrgUnit ?? selectedMDA;
    const isCompactScreen = viewportWidth < 768;

    const trackerProgramsQuery = useQuery(
        trackerProgramsQueryOptions(engine, "project-performances"),
    );
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

    const metadata = metadataQuery.data ?? [];
    const lineListRows = lineListQuery.data?.rows ?? [];
    const totalRecords = lineListQuery.data?.total ?? 0;
    const attributeMetadata = useMemo(
        () => metadata.filter((item) => item.source === "attribute"),
        [metadata],
    );
    const searchableAttributes = useMemo(
        () => attributeMetadata.filter((item) => item.searchable),
        [attributeMetadata],
    );
    const detailMetadata = useMemo(
        () => metadata.filter((item) => item.source === "dataElement"),
        [metadata],
    );
    const detailStages = useMemo(() => {
        const seen = new Set<string>();
        return detailMetadata.flatMap((item) => {
            const label = item.stageLabel?.trim();
            if (!label || seen.has(label)) return [];
            seen.add(label);
            return [label];
        });
    }, [detailMetadata]);
    const startDateColumn = useMemo(
        () => findStartDateColumn(attributeMetadata),
        [attributeMetadata],
    );
    const rows = useMemo(
        () => sortRowsByStartDateDescending(lineListRows, startDateColumn),
        [lineListRows, startDateColumn],
    );

    const filteredRows = useMemo(() => {
        return rows.filter((row) =>
            searchableAttributes.every((meta) => {
                const searchValue = appliedSearch[meta.id]?.trim().toLowerCase();
                if (!searchValue) return true;
                return getDisplayValue(row[meta.id], meta)
                    .toLowerCase()
                    .includes(searchValue);
            }),
        );
    }, [appliedSearch, rows, searchableAttributes]);

    const mainColumns = useMemo<TableProps<TrackerLineListRow>["columns"]>(
        () => [
            {
                title: "Vote",
                dataIndex: "orgUnitName",
                key: "orgUnitName",
                width: getColumnWidth("Vote"),
                ellipsis: shouldEllipsizeColumn("Vote"),
                onHeaderCell: () => ({ style: getSharedCellStyle("Vote") }),
                onCell: () => ({ style: getSharedCellStyle("Vote") }),
                render: (value?: string) =>
                    renderDynamicCellWithOptionSets(value, {
                        id: "orgUnitName",
                        label: "Vote",
                        source: "orgUnit",
                    }),
            },
            ...attributeMetadata.map((meta) => ({
                title: meta.label,
                dataIndex: meta.id,
                key: meta.id,
                width: getColumnWidth(meta.label),
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
        [attributeMetadata],
    );

    const hasRows = filteredRows.length > 0;
    const reportScope = selectedMDA ? "Selected MDA" : "All MDAs";
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const emptyTableDescription =
        !reportOrgUnitId
            ? "No organisation unit is available for this user. Select a Vote in Advanced report filters to load entries."
            : "No entries found mapping criteria parameters.";
    const selectedRow = useMemo(
        () => filteredRows.find((row) => row.key === expandedRowKey),
        [expandedRowKey, filteredRows],
    );
    React.useEffect(() => {
        setCurrentPage(1);
    }, [displayedProgramme, pageSize, reportOrgUnitId, appliedSearch]);

    React.useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    React.useEffect(() => {
        const options = trackerProgramsQuery.data ?? [];
        if (!selectedProgramme && options.length === 1) {
            setSelectedProgramme(options[0].id);
            setSelectedProgrammeTitle(options[0].name);
        }
    }, [selectedProgramme, trackerProgramsQuery.data]);

    React.useEffect(() => {
        if (!selectedRow || !filteredRows.some((row) => row.key === selectedRow.key)) {
            setExpandedRowKey(undefined);
            setActiveStageLabel(undefined);
        }
    }, [filteredRows, selectedRow]);

    React.useEffect(() => {
        setDisplayedProgramme(selectedProgramme);
    }, [selectedProgramme]);

    React.useEffect(() => {
        if (hasInitializedDefaultMda) return;
        if (defaultOrgUnit) {
            setSelectedMDA(defaultOrgUnit);
        }
        setHasInitializedDefaultMda(true);
    }, [defaultOrgUnit, hasInitializedDefaultMda]);

    const tableError = metadataQuery.error
        ? "Unable to load tracker programme metadata for the selected programme."
        : lineListQuery.error
          ? "Unable to load tracker line-list data for the selected criteria."
          : undefined;

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
            const searchHeight =
                searchPanelRef.current?.getBoundingClientRect().height ?? 0;
            const footerHeight =
                footerRef.current?.getBoundingClientRect().height ?? 0;
            const errorHeight = tableError ? 32 : 0;
            const reservedHeight =
                headerHeight +
                searchHeight +
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
            searchPanelRef.current,
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
        appliedSearch,
        isCompactScreen,
        isSearchOpen,
        displayedProgramme,
        tableError,
        viewportHeight,
        viewportWidth,
        filteredRows.length,
    ]);

    const renderExpandedRow = useCallback(
        (record: TrackerLineListRow) => {
            const rowsForStage = detailMetadata
                .filter((item) => item.stageLabel === activeStageLabel)
                .map((item) => ({
                    key: item.id,
                    description: item.label,
                    value: getDisplayValue(record[item.id], item),
                }));

            return (
                <div
                    style={{
                        border: "1px solid #d7e3f1",
                        borderRadius: "8px",
                        padding: "12px",
                        background: "#ffffff",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${detailStages.length}, minmax(0, 1fr))`,
                            gap: "8px",
                            marginBottom: "10px",
                        }}
                    >
                        {detailStages.map((stageLabel) => {
                            const isActive = stageLabel === activeStageLabel;
                            return (
                                <Button
                                    key={stageLabel}
                                    type={isActive ? "primary" : "default"}
                                    onClick={() => setActiveStageLabel(stageLabel)}
                                    style={{
                                        height: "46px",
                                        fontWeight: 600,
                                        backgroundColor: isActive
                                            ? "#bfd2d6"
                                            : undefined,
                                        borderColor: "#3e7ae0",
                                        color: isActive
                                            ? "#2f66d0"
                                            : "#444444",
                                    }}
                                >
                                    {stageLabel}
                                </Button>
                            );
                        })}
                    </div>
                    <Table
                        className="policy-actions-table"
                        rowKey="key"
                        bordered
                        pagination={false}
                        size="small"
                        dataSource={rowsForStage}
                        columns={[
                            {
                                title: "Description",
                                dataIndex: "description",
                                key: "description",
                                width: 420,
                            },
                            {
                                title: "Value",
                                dataIndex: "value",
                                key: "value",
                            },
                        ]}
                        locale={{
                            emptyText: (
                                <Empty description="No values available for this section." />
                            ),
                        }}
                    />
                </div>
            );
        },
        [activeStageLabel, detailMetadata, detailStages],
    );

    const exportSubtitle = useMemo(() => {
        const parts = [`Programme: ${selectedProgrammeTitle ?? "Selected programme"}`];
        parts.push(`Scope: ${reportScope}`);
        return parts.join(" | ");
    }, [reportScope, selectedProgrammeTitle]);

    const handlePdfExport = useCallback(() => {
        if (!mainColumns || !hasRows) return;
        exportTrackerTableToPdf({
            columns: mainColumns,
            rows: filteredRows,
            title: "Project Performance Tracker",
            subtitle: exportSubtitle,
        });
    }, [exportSubtitle, filteredRows, hasRows, mainColumns]);

    const handleExcelExport = useCallback(async () => {
        if (!mainColumns || !hasRows) return;
        await exportTrackerTableToExcel({
            columns: mainColumns,
            rows: filteredRows,
            title: "Project Performance Tracker",
            subtitle: exportSubtitle,
            sheetName: "Project Performance",
        });
    }, [exportSubtitle, filteredRows, hasRows, mainColumns]);

    const handleMdaClear = () => {
        setSelectedMDA(undefined);
    };

    const handleSearchApply = () => {
        setAppliedSearch(
            Object.fromEntries(
                Object.entries(searchDraft).filter(([, value]) => value.trim() !== ""),
            ),
        );
    };

    const handleSearchClear = () => {
        setSearchDraft({});
        setAppliedSearch({});
    };

    return (
        <div className="project-performance-page">
            <Row
                gutter={[16, 16]}
                align="stretch"
                className="project-performance-controls-row"
            >
                <Col xs={24} md={14} className="project-performance-control-col">
                    <Card
                        className="project-performance-control-card"
                        size="small"
                        style={{
                            backgroundColor: "#d0ebd0",
                            borderColor: "#a4d2a3",
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

                <Col xs={24} md={10} className="project-performance-control-col">
                    <Card
                        className="project-performance-control-card"
                        size="small"
                        style={{
                            backgroundColor: "#bbd1ee",
                            borderColor: "#729fcf",
                            height: "100%",
                            borderRadius: "3px",
                        }}
                        styles={{ body: { padding: "12px" } }}
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
                    className="project-performance-report-panel"
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
                        className="project-performance-report-header"
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
                                width: "100%",
                                justifyContent: "space-between",
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
                                {searchableAttributes.length > 0 && (
                                    <Button
                                        size="small"
                                        icon={<SearchOutlined />}
                                        title="Search"
                                        onClick={() =>
                                            setIsSearchOpen((current) => !current)
                                        }
                                    />
                                )}
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

                    {isSearchOpen && searchableAttributes.length > 0 && (
                        <div
                            ref={searchPanelRef}
                            style={{
                                border: "1px solid #d7e3f1",
                                borderRadius: "4px",
                                padding: "10px 12px",
                                marginBottom: "8px",
                            }}
                        >
                            <Row gutter={[12, 12]} align="bottom">
                                {searchableAttributes.map((meta) => (
                                    <Col xs={24} md={12} key={meta.id}>
                                        <Text
                                            strong
                                            style={{
                                                display: "block",
                                                marginBottom: "4px",
                                                fontSize: "14px",
                                            }}
                                        >
                                            {meta.label}
                                        </Text>
                                        <Input
                                            value={searchDraft[meta.id] ?? ""}
                                            onChange={(event) =>
                                                setSearchDraft((current) => ({
                                                    ...current,
                                                    [meta.id]:
                                                        event.target.value,
                                                }))
                                            }
                                        />
                                    </Col>
                                ))}
                                <Col xs={24}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "flex-end",
                                            gap: "8px",
                                        }}
                                    >
                                        <Button onClick={handleSearchClear}>
                                            Clear
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<SearchOutlined />}
                                            onClick={handleSearchApply}
                                        >
                                            Search
                                        </Button>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {tableError && (
                        <Typography.Text type="danger">
                            {tableError}
                        </Typography.Text>
                    )}

                    <div
                        className="project-performance-table-region"
                        style={{
                            flex: 1,
                            minHeight: 0,
                            overflow: "hidden",
                        }}
                    >
                        <Table
                            className="project-performance-table"
                            rowKey="key"
                            style={{ margin: 0, padding: 0 }}
                            dataSource={filteredRows}
                            columns={mainColumns}
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
                            expandable={{
                                expandedRowRender: renderExpandedRow,
                                expandedRowKeys: expandedRowKey
                                    ? [expandedRowKey]
                                    : [],
                                expandIcon: () => null,
                            }}
                            onRow={(record) => ({
                                onClick: () => {
                                    if (expandedRowKey === record.key) {
                                        setExpandedRowKey(undefined);
                                        setActiveStageLabel(undefined);
                                        return;
                                    }
                                    setExpandedRowKey(record.key);
                                    setActiveStageLabel(
                                        detailStages[0] ?? undefined,
                                    );
                                },
                            })}
                            rowClassName={(record) =>
                                record.key === expandedRowKey
                                    ? "policy-actions-selected-row"
                                    : ""
                            }
                            locale={{
                                emptyText: (
                                    <Empty description={emptyTableDescription} />
                                ),
                            }}
                        />
                    </div>
                    <div
                        ref={footerRef}
                        className="project-performance-footer"
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
                <div className="project-performance-empty-state">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Choose a tracking programme to load project performance records. Filters apply automatically."
                    />
                </div>
            )}
        </div>
    );
}

function getColumnWidth(label: string) {
    const normalized = label.toLowerCase();
    if (normalized.includes("project title")) return 180;
    if (normalized.includes("programme")) return 170;
    if (normalized.includes("project category")) return 132;
    if (normalized.includes("vote")) return 170;
    if (normalized.includes("pip code")) return 112;
    if (normalized.includes("department")) return 124;
    if (normalized.includes("funding")) return 108;
    if (normalized.includes("start date") || normalized.includes("end date")) {
        return 104;
    }
    if (normalized.includes("status") || normalized.includes("progress")) {
        return 108;
    }
    return 118;
}

function shouldEllipsizeColumn(label: string) {
    const normalized = label.toLowerCase();
    return (
        normalized.includes("project title") ||
        normalized.includes("programme") ||
        normalized.includes("vote") ||
        normalized.includes("department") ||
        normalized.includes("funding")
    );
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

function parseDateSortValue(value?: string) {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function getDisplayValue(
    value: string | undefined,
    meta: TrackerLineListColumnMetadata,
) {
    const optionsMap = new Map(
        meta.optionSet?.options.map(({ code, name }) => [code, name]) ?? [],
    );
    const resolvedValue = optionsMap.get(value ?? "") ?? value ?? "";
    return formatNumericDisplayValue(resolvedValue);
}

function getSharedCellStyle(label: string): React.CSSProperties {
    return {
        width: getColumnWidth(label),
        minWidth: getColumnWidth(label),
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
    return (
        <div
            style={{
                fontFamily: "Cambria, Georgia, serif",
                lineHeight: 1.4,
                whiteSpace: "normal",
                minHeight: "100%",
            }}
        >
            {getDisplayValue(value, meta)}
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
