import { createRoute } from "@tanstack/react-router";
import { Modal, Table, type TableProps } from "antd";
import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import Performance from "../../../../components/performance";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { AnalyticsData } from "../../../../types";
import { processByPerformance } from "../../../../utils";
import { isDataElementAssignedToMatchingProgrammeDataSet } from "../../../../utils/data-element-assignments";
import { RootRoute } from "../../../__root";
import { VoteOutputPerformanceRoute } from "./route";
export const VoteOutputPerformanceIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => VoteOutputPerformanceRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { allOptionsMap } = RootRoute.useLoaderData();
    const search = VoteOutputPerformanceIndexRoute.useSearch();
    const { engine } = VoteOutputPerformanceIndexRoute.useRouteContext();
    const { data } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: [search.pe ?? ""],
        },
        ndpVersion: search.v ?? "",
        attributeValue: "output",
        queryByOu: true,
        restrictToReportingRateProgrammes: true,
        enforceDataSetOrgUnitAssignments: true,
        organisationUnitIds: [search.ou],
    });
    const [modal, contextHolder] = Modal.useModal();
    const selectedVoteData = React.useMemo(
        () =>
            data.filter((row) =>
                isDataElementAssignedToMatchingProgrammeDataSet(
                    row as unknown as Record<string, unknown>,
                    search.ou,
                    search.v ?? "",
                ),
            ),
        [data, search.ou, search.v],
    );
    const handleChange: TableProps<
        ReturnType<typeof processByPerformance>[number]
    >["onChange"] = (_pagination, _filters, sorter) => {
        if (!Array.isArray(sorter)) {
            const { field, order } = sorter;
            // if (field && order) {
            //     setProcessedData((prev) => {
            //         return orderBy(
            //             prev,
            //             [String(field)],
            //             [order === "ascend" ? "asc" : "desc"],
            //         );
            //     });
            // } else {
            //     setProcessedData(() => data);
            // }
        }
    };
    const columns: TableProps<AnalyticsData>["columns"] = React.useMemo(() => {
        return [
            {
                title: `Code`,
                dataIndex: "UBWSASWdyfi",
                key: "UBWSASWdyfi",
                width: 80,
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
                render: (text: string, record) => {
                    return (
                        <div>
                            {allOptionsMap?.get(text) || text}
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
                                                columns={[
                                                    {
                                                        title: "Name",
                                                        dataIndex: "name",
                                                        key: "name",
                                                    },
                                                ]}
                                                dataSource={record.groups}
                                                style={{
                                                    margin: 0,
                                                    padding: 0,
                                                }}
                                                pagination={false}
                                                rowKey="code"
                                                scroll={{ y: 700 }}
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
                sorter: true,
            },
        ];
    }, []);

    return (
        <Performance
            key={`${search.ou}-${search.pe}`}
            data={selectedVoteData}
            groupingBy="AKzxCNn1zkQ"
            initialColumns={columns}
            pe={search.pe ?? ""}
            exportValueTransforms={{
                AKzxCNn1zkQ: (value) =>
                    allOptionsMap?.get(String(value)) || value,
            }}
        />
    );
}
