import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dayjs } from "dayjs";
import React, { useCallback, useMemo, useState } from "react";
import {
    Button,
    Card,
    Col,
    DatePicker,
    Dropdown,
    Empty,
    InputNumber,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Typography,
    Collapse,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import {
    CloseCircleOutlined,
    DownloadOutlined,
    FileExcelOutlined,
    FileTextOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
} from "@ant-design/icons";
import downloadExcelFromColumns from "../../../../download-antd-table";
import { OrgUnitSelect } from "../../../../components/organisation";
import {
    trackerLineListQueryOptions,
    trackerProgramMetadataQueryOptions,
    trackerProgramsQueryOptions,
} from "../../../../query-options";
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
    const mdaRootOrgUnit = defaultOrgUnit;
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedProgrammeTitle, setSelectedProgrammeTitle] = useState<string>();
    const [displayedProgramme, setDisplayedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [reportDisplayed, setReportDisplayed] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [selectedPeriodRange, setSelectedPeriodRange] = useState<
        [Dayjs | null, Dayjs | null] | null
    >(null);
    const reportOrgUnitId = selectedMDA ?? mdaRootOrgUnit;
    const effectiveRootOrgUnitId = mdaRootOrgUnit ?? selectedMDA;

    const trackerProgramsQuery = useQuery(trackerProgramsQueryOptions(engine));
    const metadataQuery = useQuery(
        trackerProgramMetadataQueryOptions(engine, displayedProgramme),
    );
    const lineListQuery = useQuery(
        trackerLineListQueryOptions(engine, {
            programId: displayedProgramme,
            rootOrgUnitId: effectiveRootOrgUnitId,
            orgUnitId: reportOrgUnitId,
            enabled: reportDisplayed,
        }),
    );
    const summaryLineListQuery = useQuery(
        trackerLineListQueryOptions(engine, {
            programId: displayedProgramme,
            rootOrgUnitId: effectiveRootOrgUnitId,
            orgUnitId: reportOrgUnitId,
            enabled: reportDisplayed,
        }),
    );

    const metadata = metadataQuery.data ?? [];
    const startDateColumn = useMemo(
        () => findStartDateColumn(metadata),
        [metadata],
    );
    const sortedRows = useMemo(
        () => sortRowsByStartDateDescending(lineListQuery.data ?? [], startDateColumn),
        [lineListQuery.data, startDateColumn],
    );
    const summaryRows = useMemo(
        () =>
            sortRowsByStartDateDescending(
                summaryLineListQuery.data ?? [],
                startDateColumn,
            ),
        [startDateColumn, summaryLineListQuery.data],
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
                fixed: "left" as const,
                width: getColumnWidth("Vote"),
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
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const emptyTableDescription =
        !reportOrgUnitId
            ? "No organisation unit is available for this user. Select a Vote in Advanced report filters to load entries."
            : "No entries found mapping criteria parameters.";
    const pagedRows = useMemo(
        () =>
            rows.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize,
            ),
        [currentPage, pageSize, rows],
    );
    const summaryCards = useMemo(
        () => [
            {
                key: "total-actions",
                title: "Policy Actions",
                value: filterRowsByPeriodRange(
                    summaryRows,
                    startDateColumn,
                    selectedPeriodRange,
                ).filter(
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
                value: filterRowsByPeriodRange(
                    summaryRows,
                    startDateColumn,
                    selectedPeriodRange,
                ).filter(
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
                value: filterRowsByPeriodRange(
                    summaryRows,
                    startDateColumn,
                    selectedPeriodRange,
                ).filter(
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
        [metadataById, selectedPeriodRange, startDateColumn, summaryRows],
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
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleExport = useCallback(
        async (type: "excel" | "csv") => {
            if (!dynamicColumns || !hasRows) return;
            if (type === "excel") {
                await downloadExcelFromColumns(
                    dynamicColumns,
                    rows,
                    "policy-actions-line-list.xlsx",
                );
                return;
            }
            downloadCsv(
                dynamicColumns,
                rows,
                "policy-actions-line-list.csv",
            );
        },
        [dynamicColumns, hasRows, rows],
    );

    const exportMenuItems = useMemo<MenuProps>(
        () => ({
            items: [
                {
                    key: "excel",
                    label: "Export to Excel (.xlsx)",
                    icon: <FileExcelOutlined style={{ color: "#1f7347" }} />,
                    disabled: !hasRows,
                    onClick: () => handleExport("excel"),
                },
                {
                    key: "csv",
                    label: "Export to CSV (.csv)",
                    icon: <FileTextOutlined />,
                    disabled: !hasRows,
                    onClick: () => handleExport("csv"),
                },
            ],
        }),
        [handleExport, hasRows],
    );

    const handleDisplayReport = () => {
        if (!selectedProgramme) {
            Modal.warning({
                title: "Programme Required",
                content:
                    "Please choose a target programme before rendering the line list.",
            });
            return;
        }
        setDisplayedProgramme(selectedProgramme);
        setReportDisplayed(true);
    };

    const handleMdaClear = () => {
        setSelectedMDA(undefined);
        setDisplayedProgramme(reportDisplayed ? selectedProgramme : undefined);
    };

    const tableError = metadataQuery.error
        ? "Unable to load tracker programme metadata for the selected programme."
        : lineListQuery.error
          ? "Unable to load tracker line-list data for the selected criteria."
          : undefined;

    return (
        <Space
            direction="vertical"
            size="small"
            style={{ width: "100%", padding: "8px" }}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} md={14}>
                    <Card
                        size="small"
                        style={{
                            backgroundColor: "#e2eedd",
                            borderColor: "#c2dcba",
                        }}
                        styles={{ body: { padding: "12px" } }}
                    >
                        <Row align="middle" gutter={[12, 12]}>
                            <Col xs={24} sm={4}>
                                <Text strong style={{ fontSize: "14px" }}>
                                    Programme
                                </Text>
                            </Col>
                            <Col xs={24} sm={14}>
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
                                        setDisplayedProgramme(
                                            reportDisplayed ? value : undefined,
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
                            <Col xs={24} sm={6}>
                                <Button
                                    type="primary"
                                    style={{
                                        backgroundColor: "#6ba2c9",
                                        borderColor: "#6ba2c9",
                                        width: "100%",
                                    }}
                                    onClick={handleDisplayReport}
                                >
                                    Display report
                                </Button>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col xs={24} md={10}>
                    <Card
                        size="small"
                        style={{
                            backgroundColor: "#cfdff2",
                            borderColor: "#b0ccf0",
                            height: "100%",
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
                                        <Space
                                            direction="vertical"
                                            size={12}
                                            style={{ width: "100%" }}
                                        >
                                            <div>
                                                <Text
                                                    strong
                                                    style={{
                                                        fontSize: "14px",
                                                        display: "block",
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    Filter by MDA
                                                </Text>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "8px",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <div style={{ flex: 1 }}>
                                                        <OrgUnitSelect
                                                            value={selectedMDA}
                                                            onChange={(
                                                                value,
                                                            ) => {
                                                                setSelectedMDA(
                                                                    typeof value ===
                                                                        "string"
                                                                        ? value
                                                                        : undefined,
                                                                );
                                                                setDisplayedProgramme(
                                                                    reportDisplayed
                                                                        ? selectedProgramme
                                                                        : undefined,
                                                                );
                                                            }}
                                                        />
                                                    </div>
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
                                            <div>
                                                <Text
                                                    strong
                                                    style={{
                                                        fontSize: "14px",
                                                        display: "block",
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    Period range
                                                </Text>
                                                <DatePicker.RangePicker
                                                    picker="month"
                                                    style={{ width: "100%" }}
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
                                        </Space>
                                    ),
                                },
                            ]}
                        />
                    </Card>
                </Col>
            </Row>

            {reportDisplayed ? (
                <div
                    style={{
                        background: "#fff",
                        padding: "6px",
                        borderRadius: "4px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                >
                    <div
                        style={{
                            marginBottom: "8px",
                            background: "#eef4fb",
                            border: "1px solid #d7e3f1",
                            borderRadius: "4px",
                            padding: "8px 10px",
                        }}
                    >
                        <Space
                            align="center"
                            style={{
                                width: "100%",
                                justifyContent: "space-between",
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
                            <Dropdown
                                menu={exportMenuItems}
                                trigger={["click"]}
                                placement="bottomLeft"
                            >
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    title="Download / Export Options"
                                    disabled={!hasRows}
                                />
                            </Dropdown>
                        </Space>
                    </div>

                    <Row gutter={[12, 12]} style={{ marginBottom: "12px" }}>
                        {summaryCards.map((card) => (
                            <Col xs={24} sm={12} md={8} xl={4} key={card.key}>
                                <Card
                                    size="small"
                                    bordered
                                    style={{ backgroundColor: card.color }}
                                    styles={{ body: { padding: "12px" } }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "4px",
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
                        <Typography.Text type="danger">
                            {tableError}
                        </Typography.Text>
                    )}

                    <Table
                        className="policy-actions-table"
                        rowKey="key"
                        dataSource={pagedRows}
                        columns={dynamicColumns}
                        bordered
                        size="small"
                        tableLayout="fixed"
                        loading={
                            metadataQuery.isFetching || lineListQuery.isFetching
                        }
                        pagination={false}
                        scroll={{ x: 1480 }}
                        locale={{
                            emptyText: (
                                <Empty description={emptyTableDescription} />
                            ),
                        }}
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            borderTop: "1px solid #dcdcdc",
                            background: "#f4f6f8",
                            padding: "10px 12px",
                            marginTop: "-1px",
                            flexWrap: "wrap",
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
                </div>
            ) : (
                <div style={{ margin: "60px 0", textAlign: "center" }}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Select a targeted Tracking Programme and click 'Display report' to populate data values."
                    />
                </div>
            )}

        </Space>
    );
}

function getColumnWidth(label: string) {
    const normalized = label.toLowerCase();
    if (normalized.includes("policy action")) return 320;
    if (normalized.includes("directive")) return 320;
    if (normalized.includes("remarks")) return 110;
    if (normalized === "vote" || normalized.includes("organisation unit")) {
        return 120;
    }
    if (normalized.includes("contributing")) return 150;
    if (normalized.includes("responsible officer")) return 150;
    if (normalized.includes("performance rating")) return 110;
    if (normalized.includes("source")) return 100;
    if (normalized.includes("progress")) return 90;
    if (normalized.includes("start date") || normalized.includes("end date")) {
        return 110;
    }
    if (normalized.includes("duration")) return 90;
    if (normalized.includes("action id")) return 80;
    if (normalized.includes("priority")) return 88;
    if (normalized.includes("delayed")) return 80;
    return 100;
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

    return rawValue;
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
