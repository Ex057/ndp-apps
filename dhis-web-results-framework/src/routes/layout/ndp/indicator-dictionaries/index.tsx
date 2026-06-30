import {
    CloseCircleOutlined,
    DownloadOutlined,
    MinusSquareOutlined,
    PlusSquareOutlined,
    TableOutlined,
} from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { orderBy, uniqBy } from "lodash";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Card,
    Checkbox,
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
import type { TableProps } from "antd";
import { OrgUnitSelect } from "../../../../components/organisation";
import { db } from "../../../../db";
import { ExcelBuilder } from "../../../../excel-builder";
import { useWindowSize } from "../../../../hooks/use-window-size";
import { PDFBuilder } from "../../../../pdf-builder";
import {
    indicatorDictionaryHeaders,
    IndicatorDictionaryRow,
    IndicatorDictionarySortField,
} from "../../../../query-options";
import { RootRoute } from "../../../__root";
import { IndicatorDictionaryRoute } from "./route";

const { Text } = Typography;

const dictionaryPlaceholder = "-";

const summaryCardDefinitions = [
    {
        key: "total",
        title: "Total",
        color: "#d8e8ff",
        textColor: "#1f4b8f",
    },
    {
        key: "goal",
        title: "Goal",
        color: "#d8f0dd",
        textColor: "#1f6f43",
    },
    {
        key: "strategic-objective",
        title: "Strategic Objective",
        color: "#f6d4d0",
        textColor: "#9d2d22",
    },
    {
        key: "outcome",
        title: "Outcome",
        color: "#d7f1ef",
        textColor: "#16656b",
    },
    {
        key: "intermediate-outcome",
        title: "Intermediate Outcome",
        color: "#f8ebc2",
        textColor: "#8c6d1f",
    },
    {
        key: "output",
        title: "Output",
        color: "#ece1ff",
        textColor: "#5b3f93",
    },
] as const;

export const IndicatorDictionaryIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => IndicatorDictionaryRoute,
    component: Component,
});

function Component() {
    const { v } = IndicatorDictionaryIndexRoute.useSearch();
    const { programs, ou: defaultOrgUnit, allOptionsMap } =
        RootRoute.useLoaderData();
    const { width: viewportWidth, height: viewportHeight } = useWindowSize();
    const [selectedProgramme, setSelectedProgramme] = useState<string>();
    const [selectedMDA, setSelectedMDA] = useState<string>();
    const [searchText, setSearchText] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortField, setSortField] =
        useState<IndicatorDictionarySortField>("displayName");
    const [sortOrder, setSortOrder] = useState<"ascend" | "descend">("ascend");
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<
        IndicatorDictionaryRow | undefined
    >();
    const [reportPanelHeight, setReportPanelHeight] = useState<number>();
    const [tableScrollY, setTableScrollY] = useState(420);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(
        indicatorDictionaryHeaders
            .filter((header) => header.defaultVisible)
            .map((header) => header.id),
    );
    const reportPanelRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const headerMap = useMemo(
        () => new Map(indicatorDictionaryHeaders.map((header) => [header.id, header])),
        [],
    );

    const cachedIndicators =
        useLiveQuery(async () => {
            if (!v) {
                return [];
            }
            return db.dataElements.where("fsIKncW1Eps").equals(v).toArray();
        }, [v]) ?? [];

    useEffect(() => {
        if (defaultOrgUnit) {
            setSelectedMDA(defaultOrgUnit);
        }
    }, [defaultOrgUnit]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedRow(undefined);
        setIsColumnModalOpen(false);
    }, [pageSize, searchText, selectedMDA, selectedProgramme, sortField, sortOrder, v]);

    const programmeOptions = useMemo(() => {
        const availableProgrammeCodes = new Set<string>();
        cachedIndicators.forEach((indicator) => {
            const code = String(
                indicator["UBWSASWdyfi"] ?? indicator["Programme"] ?? "",
            ).trim();
            if (code) {
                availableProgrammeCodes.add(code);
            }
        });

        return programs
            .filter((programme) => availableProgrammeCodes.has(programme.code))
            .map((programme) => ({
                label: programme.name,
                value: programme.code,
            }));
    }, [cachedIndicators, programs]);

    const normalizedSearch = searchText.trim().toLowerCase();

    const filteredIndicators = useMemo(
        () =>
            uniqBy(
            cachedIndicators.filter((indicator) => {
                if (selectedProgramme) {
                    const indicatorProgramme = String(
                        indicator["UBWSASWdyfi"] ?? indicator["Programme"] ?? "",
                    ).trim();
                    if (indicatorProgramme !== selectedProgramme) {
                        return false;
                    }
                }

                if (selectedMDA) {
                    const organisationUnits = Array.isArray(indicator.organisationUnits)
                        ? indicator.organisationUnits
                        : [];
                    const matchesOrgUnit = organisationUnits.some((path) =>
                        String(path).includes(selectedMDA),
                    );
                    if (!matchesOrgUnit) {
                        return false;
                    }
                }

                const displayName = String(
                    indicator.displayName ?? indicator.name ?? "",
                ).toLowerCase();
                const code = String(indicator.code ?? "").toLowerCase();

                if (!normalizedSearch) {
                    return true;
                }

                return (
                    displayName.includes(normalizedSearch) ||
                    code.includes(normalizedSearch)
                );
            }),
            "id",
        ),
        [cachedIndicators, normalizedSearch, selectedMDA, selectedProgramme],
    );

    const filteredRows = useMemo(
        () =>
            orderBy(
            filteredIndicators.map((indicator) =>
                mapIndicatorDictionaryRow(indicator, allOptionsMap),
            ),
            [sortField, "code"],
            [sortOrder === "descend" ? "desc" : "asc", "asc"],
        ),
        [allOptionsMap, filteredIndicators, sortField, sortOrder],
    );

    const pagedRows = useMemo(
        () =>
            filteredRows.slice(
                (currentPage - 1) * pageSize,
                (currentPage - 1) * pageSize + pageSize,
            ),
        [currentPage, filteredRows, pageSize],
    );

    const totalRecords = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / Math.max(pageSize, 1)));

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
                viewportWidth < 768 ? 460 : 560,
                viewportHeight - panelTop - 20,
            );
            setReportPanelHeight(availableHeight);
            const summaryHeight =
                summaryRef.current?.getBoundingClientRect().height ?? 0;
            const footerHeight =
                footerRef.current?.getBoundingClientRect().height ?? 0;
            const reservedHeight = summaryHeight + footerHeight + 48;
            setTableScrollY(
                Math.max(
                    viewportWidth < 768 ? 220 : 320,
                    availableHeight - reservedHeight,
                ),
            );
        };

        updateTableLayout();
        const animationFrame = window.requestAnimationFrame(updateTableLayout);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [pagedRows.length, viewportHeight, viewportWidth]);

    const visibleHeaders = useMemo(
        () =>
            visibleColumnIds
                .map((id) => headerMap.get(id))
                .filter((header): header is NonNullable<typeof header> => Boolean(header)),
        [headerMap, visibleColumnIds],
    );

    const columns = useMemo<TableProps<IndicatorDictionaryRow>["columns"]>(
        () =>
            visibleHeaders.map((header) => ({
                title: header.title,
                dataIndex: header.id,
                key: header.id,
                width: header.width,
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: "#bbd1ee",
                        color: "#25364a",
                    },
                }),
                sorter: header.sortable ? true : false,
                sortOrder:
                    header.sortable && sortField === header.id ? sortOrder : null,
                render: (value: string) => value || dictionaryPlaceholder,
            })),
        [sortField, sortOrder, visibleHeaders],
    );

    const exportColumns = useMemo<TableProps<IndicatorDictionaryRow>["columns"]>(
        () =>
            visibleHeaders.map((header) => ({
                title: header.title,
                dataIndex: header.id,
                key: header.id,
                onHeaderCell: () => ({
                    style: {
                        backgroundColor: "#bbd1ee",
                        color: "#25364a",
                    },
                }),
                render: (value: string) => value || dictionaryPlaceholder,
            })),
        [visibleHeaders],
    );

    const columnModalRows = useMemo(() => {
        const visibleSet = new Set(visibleColumnIds);
        const visibleRows = visibleColumnIds
            .map((id) => headerMap.get(id))
            .filter((header): header is NonNullable<typeof header> => Boolean(header))
            .map((header) => ({
                ...header,
                visible: true,
            }));
        const hiddenRows = indicatorDictionaryHeaders
            .filter((header) => !visibleSet.has(header.id))
            .map((header) => ({
                ...header,
                visible: false,
            }));
        return [...visibleRows, ...hiddenRows];
    }, [headerMap, visibleColumnIds]);

    const detailRows = useMemo(() => {
        if (!selectedRow) {
            return [];
        }
        return indicatorDictionaryHeaders.map((header) => ({
            key: header.id,
            label: header.title,
            value: String(selectedRow[header.id] ?? dictionaryPlaceholder),
        }));
    }, [selectedRow]);

    const summaryCards = useMemo(() => {
        const counts = filteredIndicators.reduce<Record<string, number>>(
            (accumulator, indicator) => {
                const bucket = classifyIndicatorBucket(
                    indicator.BmUMiIbD5XY,
                );
                if (bucket) {
                    accumulator[bucket] = (accumulator[bucket] ?? 0) + 1;
                }
                return accumulator;
            },
            {},
        );

        return summaryCardDefinitions.map((definition) => ({
            ...definition,
            value:
                definition.key === "total"
                    ? filteredIndicators.length
                    : (counts[definition.key] ?? 0),
        }));
    }, [filteredIndicators]);

    const handleTableChange: TableProps<IndicatorDictionaryRow>["onChange"] = (
        _pagination,
        _filters,
        sorter,
    ) => {
        if (Array.isArray(sorter)) {
            return;
        }
        const field = String(sorter.field ?? sorter.columnKey ?? "");
        if (field !== "displayName" && field !== "code") {
            return;
        }
        setSortField(field as IndicatorDictionarySortField);
        setSortOrder(sorter.order === "descend" ? "descend" : "ascend");
    };

    const toggleVisibleColumn = useCallback(
        (columnId: string) => {
            setVisibleColumnIds((current) => {
                if (current.includes(columnId)) {
                    if (current.length === 1) {
                        return current;
                    }
                    return current.filter((id) => id !== columnId);
                }
                return [...current, columnId];
            });
        },
        [],
    );

    const handlePdfExport = useCallback(() => {
        if (filteredRows.length === 0) {
            return;
        }
        new PDFBuilder({
            orientation: "landscape",
            title: "Indicator Dictionary",
        })
            .addTable(exportColumns, filteredRows)
            .download("Indicator_Dictionary.pdf");
    }, [exportColumns, filteredRows]);

    const handleExcelExport = useCallback(() => {
        if (filteredRows.length === 0) {
            return;
        }
        new ExcelBuilder({
            title: "Indicator Dictionary",
            sheetName: "Indicator Dictionary",
        })
            .addTable(exportColumns, filteredRows)
            .download("Indicator_Dictionary.xlsx");
    }, [exportColumns, filteredRows]);

    const downloadMenuItems = [
        {
            key: "pdf",
            label: "PDF",
            onClick: handlePdfExport,
        },
        {
            key: "excel",
            label: "Excel",
            onClick: handleExcelExport,
        },
    ];

    const handleMdaClear = () => {
        setSelectedMDA(undefined);
    };

    return (
        <div className="indicator-dictionary-page">
            <div
                ref={reportPanelRef}
                className="indicator-dictionary-report-panel"
                style={{
                    background: "#fff",
                    padding: "8px",
                    borderRadius: "3px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                    height: reportPanelHeight,
                }}
            >
                <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: "12px" }}>
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
                                                        MDA:
                                                    </Text>
                                                    <div className="policy-actions-filter-field">
                                                        <OrgUnitSelect
                                                            value={selectedMDA}
                                                            onChange={(value) =>
                                                                setSelectedMDA(
                                                                    typeof value === "string"
                                                                        ? value
                                                                        : undefined,
                                                                )
                                                            }
                                                            showFormItem={false}
                                                            label="MDA"
                                                        />
                                                        {selectedMDA && (
                                                            <Button
                                                                type="text"
                                                                icon={<CloseCircleOutlined />}
                                                                title="Clear MDA filter"
                                                                onClick={handleMdaClear}
                                                            />
                                                        )}
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

                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                    }}
                >
                    <div
                        style={{
                            minWidth: viewportWidth < 768 ? "100%" : "260px",
                            flex: 1,
                        }}
                    >
                        <Text strong style={{ display: "block", marginBottom: "6px" }}>
                            Search
                        </Text>
                        <Input
                            allowClear
                            placeholder="Search by name or code"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
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
                        <Dropdown
                            menu={{ items: downloadMenuItems }}
                            trigger={["click"]}
                        >
                            <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                disabled={filteredRows.length === 0}
                            />
                        </Dropdown>
                        <Button
                            size="small"
                            icon={<TableOutlined />}
                            disabled={filteredRows.length === 0}
                            onClick={() => setIsColumnModalOpen(true)}
                        />
                    </div>
                </div>

                <div ref={summaryRef} style={{ marginBottom: "12px" }}>
                    <Row gutter={[12, 12]}>
                        {summaryCards.map((card) => (
                            <Col
                                key={card.key}
                                xs={24}
                                sm={12}
                                md={8}
                                lg={6}
                                xl={4}
                            >
                                <Card
                                    size="small"
                                    styles={{
                                        body: {
                                            backgroundColor: card.color,
                                            color: card.textColor,
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
                                        style={{
                                            color: card.textColor,
                                            fontSize: "14px",
                                        }}
                                    >
                                        {card.title}
                                    </Text>
                                    <Text
                                        style={{
                                            color: card.textColor,
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

                <div
                    className="indicator-dictionary-table-region"
                    style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                >
                    <Table
                        className="indicator-dictionary-table policy-actions-table"
                        bordered
                        rowKey="id"
                        style={{ margin: 0, padding: 0 }}
                        dataSource={pagedRows}
                        columns={columns}
                        pagination={false}
                        size="small"
                        tableLayout="auto"
                        sticky
                        onChange={handleTableChange}
                        onRow={(record) => ({
                            onClick: () => setSelectedRow(record),
                            style: { cursor: "pointer" },
                        })}
                        scroll={{ y: tableScrollY, x: "max-content" }}
                        locale={{
                            emptyText: (
                                <Empty description="No indicators matched the current filters." />
                            ),
                        }}
                    />
                </div>

                <div
                    ref={footerRef}
                    className="indicator-dictionary-footer"
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
            </div>

            <Modal
                open={isColumnModalOpen}
                title="Select columns to show/hide"
                onCancel={() => setIsColumnModalOpen(false)}
                onOk={() => setIsColumnModalOpen(false)}
                width={720}
                destroyOnClose
            >
                <Table
                    rowKey="id"
                    bordered
                    pagination={false}
                    size="small"
                    dataSource={columnModalRows}
                    columns={[
                        {
                            title: "Column",
                            dataIndex: "title",
                            key: "title",
                        },
                        {
                            title: "",
                            dataIndex: "visible",
                            key: "visible",
                            width: 80,
                            align: "center",
                            render: (_, record) => (
                                <Checkbox
                                    checked={visibleColumnIds.includes(record.id)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() => toggleVisibleColumn(record.id)}
                                />
                            ),
                        },
                    ]}
                    onRow={(record) => ({
                        onClick: () => toggleVisibleColumn(record.id),
                    })}
                />
            </Modal>

            <Modal
                open={Boolean(selectedRow)}
                title="Indicator dictionary"
                onCancel={() => setSelectedRow(undefined)}
                footer={[
                    <Button key="close" onClick={() => setSelectedRow(undefined)}>
                        Close
                    </Button>,
                ]}
                width={720}
                destroyOnClose
                maskClosable
            >
                <Table
                    rowKey="key"
                    bordered
                    pagination={false}
                    size="small"
                    dataSource={detailRows}
                    columns={[
                        {
                            title: "Field",
                            dataIndex: "label",
                            key: "label",
                            width: "38%",
                        },
                        {
                            title: "Value",
                            dataIndex: "value",
                            key: "value",
                            render: (value: string) => value || dictionaryPlaceholder,
                        },
                    ]}
                />
            </Modal>
        </div>
    );
}

function mapIndicatorDictionaryRow(
    indicator: Record<string, unknown>,
    allOptionsMap: Map<string, string>,
): IndicatorDictionaryRow {
    const values = Object.fromEntries(
        indicatorDictionaryHeaders.map((header) => [
            header.id,
            normalizeDictionaryScalar(
                getDictionaryHeaderValue(indicator, header.id, header.aliases),
                allOptionsMap,
            ),
        ]),
    ) as Record<string, string>;

    return {
        key: String(indicator.id ?? ""),
        id: String(indicator.id ?? ""),
        ...values,
        aggregationType: values.aggregationType,
        code: values.code,
        completenessConfigured: 0,
        completenessRate: "",
        completenessState: "red",
        completenessTotal: 0,
        disaggregation: values.disaggregation,
        displayName: values.displayName,
        periodType: values.periodType,
        valueType: values.valueType,
        vote: values.vote,
    };
}

function getDictionaryHeaderValue(
    indicator: Record<string, unknown>,
    headerId: string,
    aliases?: string[],
) {
    switch (headerId) {
        case "displayName":
            return indicator.displayName ?? indicator.name ?? "";
        case "code":
            return indicator.code ?? "";
        case "aggregationType":
            return indicator.aggregationType ?? "";
        case "disaggregation":
            return indicator.disaggregation ?? "";
        case "valueType":
            return indicator.valueType ?? "";
        case "periodType":
            return indicator.reportingCycles ?? [];
        case "vote":
            return Array.from(
                new Set(
                    (Array.isArray(indicator.datasetAssignments)
                        ? indicator.datasetAssignments
                        : []
                    )
                        .map((assignment) =>
                            String(
                                (assignment as { orgUnitName?: string }).orgUnitName ?? "",
                            ).trim(),
                        )
                        .filter((value) => value.length > 0),
                ),
            ).sort();
        case "indicatorGroupType":
            return formatIndicatorGroupType(
                indicator.BmUMiIbD5XY ?? indicator.indicatorGroupType,
            );
        default:
            for (const alias of aliases ?? []) {
                const value = indicator[alias];
                if (hasMeaningfulValue(value)) {
                    return value;
                }
            }
            return "";
    }
}

function normalizeDictionaryScalar(
    value: unknown,
    allOptionsMap: Map<string, string>,
): string {
    if (Array.isArray(value)) {
        const joined = value
            .map((item) => formatOptionToken(String(item ?? "").trim(), allOptionsMap))
            .filter((item) => item.length > 0)
            .join(", ");
        return joined.length > 0 ? joined : dictionaryPlaceholder;
    }

    if (value === undefined || value === null) {
        return dictionaryPlaceholder;
    }

    const normalized = String(value).trim();
    if (normalized.length === 0) {
        return dictionaryPlaceholder;
    }

    if (normalized.includes(",")) {
        const joined = normalized
            .split(",")
            .map((item) => formatOptionToken(item.trim(), allOptionsMap))
            .filter((item) => item.length > 0)
            .join(", ");
        return joined.length > 0 ? joined : dictionaryPlaceholder;
    }

    return formatNumericDisplay(formatOptionToken(normalized, allOptionsMap));
}

function formatOptionToken(value: string, allOptionsMap: Map<string, string>) {
    return allOptionsMap.get(value) ?? value;
}

function formatIndicatorGroupType(value: unknown) {
    switch (String(value ?? "").trim()) {
        case "ndpGoal":
            return "Goal";
        case "strategicObjective":
            return "Strategic Objective";
        case "outcome":
            return "Outcome";
        case "intermediateOutcome":
            return "Intermediate Outcome";
        case "output":
            return "Output";
        case "action":
            return "Action";
        default:
            return String(value ?? "");
    }
}

function formatNumericDisplay(value: string) {
    if (!/^-?\d+\.\d+$/.test(value)) {
        return value;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return value;
    }
    return numericValue.toFixed(2).replace(/\.00$/, "");
}

function hasMeaningfulValue(value: unknown) {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    const normalized = String(value).trim();
    return normalized.length > 0 && normalized !== dictionaryPlaceholder;
}

function classifyIndicatorBucket(value: unknown): string | undefined {
    const normalized = String(value ?? "").trim();

    switch (normalized) {
        case "ndpGoal":
            return "goal";
        case "strategicObjective":
            return "strategic-objective";
        case "outcome":
            return "outcome";
        case "intermediateOutcome":
            return "intermediate-outcome";
        case "output":
            return "output";
        default:
            return undefined;
    }
}
