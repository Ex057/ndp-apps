import { DownloadOutlined } from "@ant-design/icons";
import { useSearch } from "@tanstack/react-router";

import {
    Button,
    Descriptions,
    DescriptionsProps,
    Flex,
    Form,
    Modal,
    Select,
    Table,
    TableProps,
    Tabs,
    TabsProps,
} from "antd";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import React, { useMemo } from "react";
import { FaInfoCircle } from "react-icons/fa";
import downloadExcelFromColumns from "../download-antd-table";
import downloadPdfFromColumns from "../download-pdf-from-columns";
import { RootRoute } from "../routes/__root";
import {
    AnalyticsData,
    budgetColumns,
    PERFORMANCE_LABELS,
    ResultsProps,
} from "../types";
import { legendItems } from "../utils";
import AttachmentDownload from "./attachment-download";
import PerformanceLegend from "./performance-legend";
import { PDFBuilder } from "../pdf-builder";
import { ExcelBuilder } from "../excel-builder";

dayjs.extend(advancedFormat);
dayjs.extend(quarterOfYear);

const makeIndicatorData = (
    data: AnalyticsData,
    categoryOptions: Map<string, string>,
): Partial<AnalyticsData>[] => {
    return [
        { code: "Name", dx: data.name },
        { code: "Description", dx: data["description"] ?? "" },
        {
            code: "Measurement",
            dx:
                categoryOptions.get(data["Lxe84DpBHhm"]) ??
                data["Lxe84DpBHhm"] ??
                "",
        },
        {
            code: "Unit of Measure",
            dx:
                categoryOptions.get(data["FuRWtF51PyL"]) ??
                data["FuRWtF51PyL"] ??
                "",
        },
        {
            code: "Data Source",
            dx:
                categoryOptions.get(data["Prss6OhQvYg"]) ??
                data["Prss6OhQvYg"] ??
                "",
        },
        {
            code: "Responsibility for reporting",
            dx:
                categoryOptions.get(data["lIRw10zARY7"]) ??
                data["lIRw10zARY7"] ??
                "",
        },
        { code: "Indicator code", dx: data["code"] ?? "" },
        { code: "Indicator type", dx: data["Indicator type"] ?? "" },
        { code: "Aggregation type", dx: data["aggregationType"] ?? "" },
        {
            code: "Frequency of data collection",
            dx: data["M5nS9I96cCx"],
        },
        {
            code: "Reporting Frequency",
            dx:
                data["dataSetPeriodType"] === "FinancialJuly"
                    ? "Financial Year"
                    : data["dataSetPeriodType"],
        },

        {
            code: "Descending Indicator",
            dx: data["descending indicator type"] ? "Yes" : "No",
        },
        {
            code: "Goal",
            dx:
                categoryOptions.get(data["m3Be0z4xNnA"]) ??
                data["m3Be0z4xNnA"] ??
                "",
        },
        {
            code: "Programme",
            dx:
                categoryOptions.get(data["UBWSASWdyfi"]) ??
                data["UBWSASWdyfi"] ??
                "",
        },
        {
            code: "Strategic Objective",
            dx:
                categoryOptions.get(data["fwSdMAZ9egv"]) ??
                data["fwSdMAZ9egv"] ??
                "",
        },
        {
            code: "Program Objective",
            dx:
                categoryOptions.get(data["GuoVDNEBAXA"]) ??
                data["GuoVDNEBAXA"] ??
                "",
        },
        {
            code: "Program Intervention",
            dx:
                categoryOptions.get(data["LKWITZXQD9l"]) ??
                data["LKWITZXQD9l"] ??
                "",
        },
        {
            code: "Intermediate Outcome",
            dx:
                categoryOptions.get(data["k9c6BOHIohu"]) ??
                data["k9c6BOHIohu"] ??
                "",
        },
        {
            code: "Key Result Area",
            dx:
                categoryOptions.get(data["JmZO4hoIlfT"]) ??
                data["JmZO4hoIlfT"] ??
                "",
        },
        {
            code: "Program Output",
            dx:
                categoryOptions.get(data["AKzxCNn1zkQ"]) ??
                data["AKzxCNn1zkQ"] ??
                "",
        },
    ];
};

const quarterOrder = { Q1: "Q3", Q2: "Q4", Q3: "Q1", Q4: "Q2" };

const fullQuarters = {
    3: "Q1",
    4: "Q2",
    1: "Q3",
    2: "Q4",
};

export function Results(props: ResultsProps) {
    const [modal, contextHolder] = Modal.useModal();
    const {
        tab,
        data,
        onChange,
        postfixColumns = [],
        prefixColumns = [],
        quarters = false,
        pe = [],
        category,
        categoryOptions,
        nonBaseline,
        dimensions,
        items,
    } = props;
    const { v } = useSearch({ from: "/layout/ndp" });
    const {
        configurations,
        categoryOptions: optionNames,
        allOptionsMap,
    } = RootRoute.useLoaderData();
    const cats = dimensions[category] ?? [];
    const target = cats.at(-2) ?? "";
    const baseline = cats.at(0) ?? "";
    const value = cats.at(-1) ?? "";

    const [currentQuarters, setCurrentQuarters] = React.useState<string[]>([
        fullQuarters[dayjs().quarter()],
    ]);
    const indicatorColumns: TableProps<Partial<AnalyticsData>>["columns"] =
        useMemo(
            () => [
                {
                    title: "Indicator Code",
                    dataIndex: "code",
                    key: "code",
                },
                {
                    title: "Indicator Name",
                    dataIndex: "dx",
                    key: "dx",
                },
            ],
            [],
        );

    const nameColumn: TableProps<AnalyticsData>["columns"] = useMemo(
        () => [
            ...prefixColumns,
            {
                title: nonBaseline ? "Budget Actions" : "Indicators",
                dataIndex: "name",
                render: (text: string, record) => {
                    return (
                        <div>
                            {text}
                            &nbsp;
                            <FaInfoCircle
                                style={{
                                    color: "#428BCA",
                                    fontSize: "22.4px",
                                    cursor: "pointer",
                                }}
                                onClick={() => {
                                    modal.info({
                                        title: "Indicator Dictionary",
                                        width: "70%",
                                        centered: true,
                                        content: (
                                            <Table
                                                columns={indicatorColumns}
                                                dataSource={makeIndicatorData(
                                                    record,
                                                    allOptionsMap,
                                                )}
                                                style={{
                                                    margin: 0,
                                                    padding: 0,
                                                }}
                                                pagination={false}
                                                rowKey="code"
                                                scroll={{
                                                    y: 700,
                                                    x: "max-content",
                                                }}
                                                showHeader={false}
                                                bordered
                                            />
                                        ),
                                    });
                                }}
                            />
                            {contextHolder}
                        </div>
                    );
                },
            },
        ],
        [prefixColumns],
    );

    const columns = useMemo(() => {
        const columnsMap = new Map<
            string,
            TableProps<AnalyticsData>["columns"]
        >();

        columnsMap.set("target", [
            ...nameColumn,
            ...pe.flatMap((pe) => {
                const title =
                    configurations[v]?.data?.baseline === pe
                        ? items[baseline]?.name
                        : items[target]?.name;
                const dataIndex =
                    configurations[v]?.data?.baseline === pe
                        ? `${pe}${baseline}`
                        : `${pe}${target}`;

                if (nonBaseline && configurations[v]?.data?.baseline === pe) {
                    return [];
                }
                return {
                    title,
                    align: "center" as const,
                    children: nonBaseline
                        ? categoryOptions?.slice(0, 2).map((option) => ({
                              title:
                                  budgetColumns[option] ||
                                  items[option]?.name?.replace("Budget ", ""),
                              dataIndex: `${pe}${option}`,
                              align: "center" as const,
                              minWidth: 90,
                          }))
                        : [
                              {
                                  title,
                                  dataIndex,
                                  align: "center" as const,
                                  minWidth:
                                      configurations[v]?.data?.baseline === pe
                                          ? 100
                                          : 76,
                              },
                          ],
                };
            }),
            ...postfixColumns,
        ]);
        columnsMap.set("performance", [
            ...nameColumn,
            ...pe.flatMap((pe) => {
                if (nonBaseline && configurations[v]?.data?.baseline === pe) {
                    return [];
                }
                return {
                    title: items[pe]?.name,
                    align: "center" as const,
                    children: nonBaseline
                        ? categoryOptions
                              ?.flatMap((option, index) => {
                                  if (index > 1) return [];
                                  return {
                                      title:
                                          budgetColumns[option] ||
                                          items[option]?.name?.replace(
                                              "Budget ",
                                              "",
                                          ),
                                      dataIndex: `${pe}${option}`,
                                      align: "center" as const,
                                      width: 150,
                                  };
                              })
                              .concat(
                                  currentQuarters.map((quarter) => {
                                      const year = Number(pe.slice(0, 4));
                                      const currentYear =
                                          quarter === "Q1" || quarter === "Q2"
                                              ? year
                                              : year + 1;
                                      return {
                                          title: quarter,
                                          key: `${pe}${currentYear}${quarterOrder[quarter]}`,
                                          align: "center",
                                          dataIndex: `${pe}${currentYear}${quarterOrder[quarter]}`,
                                          width: 110,
                                          children: [
                                              ...categoryOptions
                                                  .slice(2)
                                                  .map((option) => ({
                                                      title:
                                                          budgetColumns[
                                                              option
                                                          ] ||
                                                          items[option]?.name,
                                                      dataIndex: `${currentYear}${quarterOrder[quarter]}${option}`,
                                                      key: `${currentYear}${quarterOrder[quarter]}${option}`,
                                                      align: "center" as const,
                                                      width: 110,
                                                  })),
                                              {
                                                  title: `%`,
                                                  dataIndex: `${currentYear}${quarterOrder[quarter]}performance`,
                                                  key: `${currentYear}${quarterOrder[quarter]}performance`,
                                                  align: "center",
                                                  width: 110,
                                                  onCell: (
                                                      row: Record<string, any>,
                                                  ) => {
                                                      return {
                                                          style: row[
                                                              `${currentYear}${quarterOrder[quarter]}style`
                                                          ],
                                                      };
                                                  },
                                              },
                                          ],
                                      };
                                  }),
                              )
                        : (configurations[v]?.data?.baseline === pe
                              ? [baseline]
                              : ["target", "actual", "performance"]
                          ).flatMap((currentValue, index) => {
                              const year = Number(pe.slice(0, 4));
                              if (index === 1 && quarters) {
                                  return currentQuarters.map((quarter) => {
                                      const currentYear =
                                          quarter === "Q1" || quarter === "Q2"
                                              ? year
                                              : year + 1;
                                      return {
                                          title: quarter,
                                          key: `${pe}${currentYear}${quarterOrder[quarter]}`,
                                          align: "center",
                                          width: 150,
                                          children: [
                                              {
                                                  title: `A`,
                                                  key: `${currentYear}${quarterOrder[quarter]}actual`,
                                                  dataIndex: `${currentYear}${quarterOrder[quarter]}actual`,
                                                  align: "center",
                                                  width: 110,
                                              },
                                              {
                                                  title: `%`,
                                                  dataIndex: `${currentYear}${quarterOrder[quarter]}performance`,
                                                  key: `${currentYear}${quarterOrder[quarter]}performance`,
                                                  align: "center",
                                                  onCell: (
                                                      row: Record<string, any>,
                                                  ) => {
                                                      return {
                                                          style: row[
                                                              `${currentYear}${quarterOrder[quarter]}style`
                                                          ],
                                                      };
                                                  },
                                                  width: 110,
                                              },
                                          ],
                                      };
                                  });
                              } else {
                                  const title =
                                      items[currentValue]?.name ??
                                      PERFORMANCE_LABELS[index];
                                  return {
                                      title:
                                          budgetColumns[currentValue] || title,
                                      key: `${pe}${currentValue}`,
                                      width: 110,
                                      align: "center",
                                      onCell: (row: Record<string, any>) => {
                                          if (index === 2) {
                                              return {
                                                  style: row[`${pe}style`],
                                              };
                                          }
                                          return {};
                                      },
                                      dataIndex: `${pe}${currentValue}`,
                                      children: [],
                                  };
                              }
                          }),
                };
            }),
            ...postfixColumns,
        ]);
        return columnsMap;
    }, [
        nameColumn,
        target,
        value,
        items,
        postfixColumns,
        prefixColumns,
        configurations,
        v,
        baseline,
        quarters,
        pe,
    ]);
    const tableProps = useMemo<TableProps<AnalyticsData>>(
        () => ({
            scroll: { y: "calc(100vh - 520px)" },
            rowKey: "id",
            bordered: true,
            sticky: true,
            tableLayout: "auto",
            pagination: false,
            size: "small",
            dataSource: data,
            expandable: {
                expandedRowRender: (record) => {
                    const itemValues: DescriptionsProps["items"] = pe.flatMap(
                        (pe) => {
                            const year = Number(pe.slice(0, 4));
                            return currentQuarters.flatMap((quarter) => {
                                const currentYear =
                                    quarter === "Q1" || quarter === "Q2"
                                        ? year
                                        : year + 1;
                                const period = `${currentYear}${quarterOrder[quarter]}`;
                                const comment = record[`${period}comment`];

                                if (comment) {
                                    return {
                                        label: `${items?.[pe]?.name} ${quarter}`,
                                        children: comment,
                                        key: `${pe}${quarter}`,
                                    };
                                }
                                return [];
                            });
                        },
                    );
                    return (
                        <Flex vertical>
                            <Descriptions
                                size="small"
                                column={1}
                                items={itemValues}
                            />

                            <Flex>
                                {pe
                                    .flatMap((pe) => {
                                        const year = Number(pe.slice(0, 4));
                                        return currentQuarters.flatMap(
                                            (quarter) => {
                                                const currentYear =
                                                    quarter === "Q1" ||
                                                    quarter === "Q2"
                                                        ? year
                                                        : year + 1;
                                                const period = `${currentYear}${quarterOrder[quarter]}`;
                                                const attachment =
                                                    record[
                                                        `${period}attachment`
                                                    ];

                                                if (attachment) {
                                                    return attachment;
                                                }
                                                return [];
                                            },
                                        );
                                    })
                                    .map((a) => (
                                        <AttachmentDownload attachment={a} />
                                    ))}
                            </Flex>
                        </Flex>
                    );
                },
                rowExpandable: (record) => {
                    const allData = pe.flatMap((pe) => {
                        const year = Number(pe.slice(0, 4));
                        return currentQuarters.flatMap((quarter) => {
                            const currentYear =
                                quarter === "Q1" || quarter === "Q2"
                                    ? year
                                    : year + 1;
                            const period = `${currentYear}${quarterOrder[quarter]}`;
                            const comment = record[`${period}comment`];

                            if (comment) {
                                return true;
                            }
                            return [];
                        });
                    });
                    return allData.length > 0;
                },
                defaultExpandAllRows: true,
            },
        }),
        [data, currentQuarters],
    );

    const extractOutcomeComments = (record: any) => {
        const comments = pe.flatMap((pe) => {
            const year = Number(pe.slice(0, 4));
            return currentQuarters.flatMap((quarter) => {
                const currentYear =
                    quarter === "Q1" || quarter === "Q2" ? year : year + 1;
                const period = `${currentYear}${quarterOrder[quarter]}`;
                const comment = record[`${period}comment`];
                if (comment) {
                    return `${year}/${year + 1} ${quarter}:\n ${comment}\n`;
                }
                return [];
            });
        });
        return comments.length > 0 ? comments.join("\r") : null;
    };
    const tabItems: TabsProps["items"] = useMemo(
        () => [
            {
                key: "target",
                label: (
                    <div style={{ width: 200, textAlign: "center" }}>
                        Targets
                    </div>
                ),
                children: (
                    <Flex
                        vertical
                        gap={10}
                        style={{ height: "calc(100vh - 278px)" }}
                    >
                        <Flex justify="flex-end" gap={10}>
                            <Button
                                onClick={() => {
                                    const builder = new PDFBuilder({
                                        orientation: "landscape",
                                    });

                                    builder

                                        .addTableWithComments(
                                            columns.get("target"),
                                            data,
                                            extractOutcomeComments,
                                        )
                                        .download(
                                            `${new Date().toISOString()}-report.pdf`,
                                        );
                                }}
                                icon={<DownloadOutlined />}
                            >
                                Download PDF
                            </Button>
                            <Button
                                onClick={() => {
                                    const builder = new ExcelBuilder();

                                    builder

                                        .addTableWithComments(
                                            columns.get("target"),
                                            data,
                                            extractOutcomeComments,
                                        )

                                        .download(
                                            `${new Date().toISOString()}-report.xlsx`,
                                        );
                                }}
                                icon={<DownloadOutlined />}
                            >
                                Download Excel
                            </Button>
                        </Flex>
                        <Table
                            {...tableProps}
                            columns={columns.get("target")}
                        />
                    </Flex>
                ),
            },
            {
                key: "performance",
                label: (
                    <div style={{ width: 200, textAlign: "center" }}>
                        Performance
                    </div>
                ),
                children: (
                    <Flex
                        vertical
                        gap={10}
                        style={{
                            height: "calc(100vh - 278px)",
                        }}
                    >
                        <PerformanceLegend legendItems={legendItems} />
                        <Flex gap={10} justify="space-between">
                            <Flex style={{ width: "50%" }} gap={10}>
                                {categoryOptions?.map((option) => (
                                    <div
                                        key={option}
                                        style={{
                                            width: "100%",
                                            height: "40px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            border: "1px solid #121212ff",
                                        }}
                                    >
                                        {`${budgetColumns[option]} : ${
                                            optionNames.get(option) || option
                                        }`}
                                    </div>
                                ))}
                            </Flex>
                            {quarters && (
                                <Form.Item label="Quarter">
                                    <Select
                                        style={{ width: 275 }}
                                        options={[
                                            { label: "Q1", value: "Q1" },
                                            { label: "Q2", value: "Q2" },
                                            { label: "Q3", value: "Q3" },
                                            { label: "Q4", value: "Q4" },
                                        ]}
                                        value={currentQuarters}
                                        onChange={(val) =>
                                            setCurrentQuarters(val)
                                        }
                                        mode="multiple"
                                    />
                                </Form.Item>
                            )}

                            <Flex justify="flex-end" gap={10}>
                                <Button
                                    onClick={() => {
                                        const builder = new PDFBuilder({
                                            orientation: "landscape",
                                        });

                                        builder

                                            .addTableWithComments(
                                                columns.get("performance"),
                                                data,
                                                extractOutcomeComments,
                                            )
                                            .download(
                                                `${new Date().toISOString()}-report.pdf`,
                                            );
                                    }}
                                    icon={<DownloadOutlined />}
                                >
                                    Download PDF
                                </Button>
                                <Button
                                    onClick={() => {
                                        const builder = new ExcelBuilder();

                                        builder

                                            .addTableWithComments(
                                                columns.get("performance"),
                                                data,
                                                extractOutcomeComments,
                                            )

                                            .download(
                                                `${new Date().toISOString()}-report.xlsx`,
                                            );
                                    }}
                                    icon={<DownloadOutlined />}
                                >
                                    Download Excel
                                </Button>
                            </Flex>
                        </Flex>
                        <Table
                            {...tableProps}
                            columns={columns.get("performance")}
                        />
                    </Flex>
                ),
            },
        ],
        [columns, tableProps],
    );

    return (
        <>
            <Tabs
                activeKey={tab || "performance"}
                type="card"
                items={tabItems}
                onChange={onChange}
                size="large"
                renderTabBar={(props, DefaultTabBar) => (
                    <DefaultTabBar
                        {...props}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyItems: "center",
                            flexDirection: "column",
                        }}
                    />
                )}
                tabBarStyle={{ backgroundColor: "yellow", color: "black" }}
            />
        </>
    );
}
