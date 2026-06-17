import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
    Button,
    Card,
    Col,
    Collapse,
    Dropdown,
    Empty,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Typography,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import {
    CloseCircleOutlined,
    DownloadOutlined,
    FileExcelOutlined,
    FileTextOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import downloadExcelFromColumns from "../../../../download-antd-table";
import {
    trackerLineListQueryOptions,
    trackerProgramMetadataQueryOptions,
    trackerProgramsQueryOptions,
} from "../../../../query-options";
import { OrgUnitSelect } from "../../../../components/organisation";
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
    const mdaRootOrgUnit = defaultOrgUnit;
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedProgrammeTitle, setSelectedProgrammeTitle] = useState<string>();
    const [displayedProgramme, setDisplayedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [reportDisplayed, setReportDisplayed] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchDraft, setSearchDraft] = useState<Record<string, string>>({});
    const [appliedSearch, setAppliedSearch] = useState<Record<string, string>>({});
    const [expandedRowKey, setExpandedRowKey] = useState<string>();
    const [activeStageLabel, setActiveStageLabel] = useState<string>();
    const reportOrgUnitId = selectedMDA ?? mdaRootOrgUnit;
    const effectiveRootOrgUnitId = mdaRootOrgUnit ?? selectedMDA;

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
            enabled: reportDisplayed,
        }),
    );

    const metadata = metadataQuery.data ?? [];
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
        () => sortRowsByStartDateDescending(lineListQuery.data ?? [], startDateColumn),
        [lineListQuery.data, startDateColumn],
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
                fixed: "left" as const,
                width: getColumnWidth("Vote"),
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
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const emptyTableDescription =
        !reportOrgUnitId
            ? "No organisation unit is available for this user. Select a Vote in Advanced report filters to load entries."
            : "No entries found mapping criteria parameters.";
    const pagedRows = useMemo(
        () =>
            filteredRows.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize,
            ),
        [currentPage, filteredRows, pageSize],
    );
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

    const handleExport = useCallback(
        async (type: "excel" | "csv") => {
            if (!mainColumns || !hasRows) return;
            if (type === "excel") {
                await downloadExcelFromColumns(
                    mainColumns,
                    filteredRows,
                    "project-performance-line-list.xlsx",
                );
                return;
            }
            downloadCsv(
                mainColumns,
                filteredRows,
                "project-performance-line-list.csv",
            );
        },
        [filteredRows, hasRows, mainColumns],
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
                                        <div>
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
                                                        onChange={(value) => {
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
                            <Space>
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
                        </Space>
                    </div>

                    {isSearchOpen && searchableAttributes.length > 0 && (
                        <div
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

                    <Table
                        className="policy-actions-table"
                        rowKey="key"
                        dataSource={pagedRows}
                        columns={mainColumns}
                        bordered
                        size="small"
                        tableLayout="fixed"
                        loading={
                            metadataQuery.isFetching || lineListQuery.isFetching
                        }
                        pagination={false}
                        scroll={{ x: 1280 }}
                        expandable={{
                            expandedRowRender: renderExpandedRow,
                            expandedRowKeys: expandedRowKey ? [expandedRowKey] : [],
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
                                setActiveStageLabel(detailStages[0] ?? undefined);
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
    if (normalized.includes("project title")) return 190;
    if (normalized.includes("programme")) return 190;
    if (normalized.includes("project category")) return 150;
    if (normalized.includes("vote")) return 320;
    if (normalized.includes("pip code")) return 130;
    if (normalized.includes("department")) return 140;
    if (normalized.includes("funding")) return 120;
    if (normalized.includes("start date") || normalized.includes("end date")) {
        return 120;
    }
    return 130;
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
    return optionsMap.get(value ?? "") ?? value ?? "";
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
