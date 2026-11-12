import { useDataEngine } from "@dhis2/app-runtime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Flex, Modal, Table, TableProps, Typography } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { dataValuesQueryOptions } from "../query-options";
import { DataEntryLocks, IDataElement, IDataSet, Search } from "../types";
import { generateGroupedColumns } from "./data-entry";
import Spinner from "./Spinner";
import { FaInfoCircle } from "react-icons/fa";
import IndicatorDetails from "./indicator-details";
import { getNextLockDeadline } from "../data-entry-locks";

export default function CategoryCombo({
    dataSet,
    fields,
    ou,
    pe,
    targetYear,
    baselineYear,
    search,
    engine,
    printMode = false,
    dataEntryLocks,
}: {
    dataSet: IDataSet;
    fields: IDataElement[];
    ou: string;
    pe: string;
    targetYear: string;
    baselineYear: string;
    search: Search;
    engine: ReturnType<typeof useDataEngine>;
    printMode?: boolean;
    dataEntryLocks?: DataEntryLocks;
}) {
    const [modal, contextHolder] = Modal.useModal();
    const queryClient = useQueryClient();
    const [isDataSetModalOpen, setIsDataSetModalOpen] = useState(false);

    const [modalValues, setModalValues] = useState<{
        title: string;
        body: string;
    }>({
        title: "Submit data and lock",
        body: "Are you finished with data entry and ready to submit?",
    });

    const openDataSetCompleteModal = () => {
        if (data?.completeDataSetRegistrations ?? [].length > 0) {
            setModalValues({
                title: "Recall data and edit",
                body: "Are you sure to recall submitted data and do editing?",
            });
        } else {
            setModalValues({
                title: "Submit data and lock",
                body: "Are you finished with data entry and ready to submit?",
            });
        }
        setIsDataSetModalOpen(true);
    };

    const success = () => {
        Modal.success({
            title: "Success",
            content: "Data is now submitted",
        });
    };

    const errorModal = () => {
        Modal.error({
            title: "This is an error message",
            content: "Data submission failed",
        });
    };

    const handleDataSetOk = async () => {
        setIsDataSetModalOpen(false);
        try {
            if (data?.completeDataSetRegistrations ?? [].length > 0) {
                await engine.mutate({
                    resource: "completeDataSetRegistrations.json",
                    type: "delete",
                    id: "",
                    params: {
                        ds: dataSet.id,
                        pe,
                        ou,
                        cc: "NWhCUsy6l47",
                        cp: "HKtncMjp06U",
                        multiOu: false,
                    },
                });
            } else {
                await engine.mutate({
                    resource: "completeDataSetRegistrations.json",
                    type: "create",
                    data: {
                        completeDataSetRegistrations: [
                            {
                                dataSet: dataSet.id,
                                organisationUnit: ou,
                                period: pe,
                                attributeOptionCombo: "VHmIifPr01a",
                            },
                        ],
                    },
                });
            }
            success();
        } catch (error) {
            errorModal();
        } finally {
            await queryClient.invalidateQueries({
                queryKey: [
                    "data-values",
                    search.orgUnit,
                    search.dataSet,
                    search.pe,
                    search.baseline,
                    search.targetYear,
                ],
            });
        }
    };

    const handleDataSetCancel = () => {
        setIsDataSetModalOpen(false);
    };

    const { data, isSuccess, isLoading } = useQuery(
        dataValuesQueryOptions(engine, search),
    );
    const [lockRevision, setLockRevision] = useState(0);

    useEffect(() => {
        const deadline = getNextLockDeadline({
            locks: dataEntryLocks,
            dataSet,
            organisationUnitId: ou,
        });
        if (!deadline) return;

        const timeout = window.setTimeout(
            () => setLockRevision((revision) => revision + 1),
            Math.min(deadline - Date.now() + 50, 2_147_483_647),
        );
        return () => window.clearTimeout(timeout);
    }, [dataEntryLocks, dataSet.id, dataSet.name, ou, lockRevision]);

    const columns = useMemo(
        () =>
            generateGroupedColumns({
                dataSet,
                dataElements: fields,
                pe,
                ou,
                targetYear,
                baselineYear,
                disabled:
                    printMode ||
                    !!(data?.completeDataSetRegistrations ?? []).length,
                dataEntryLocks,
                now: Date.now(),
            }),
        [
            dataSet,
            fields,
            pe,
            ou,
            targetYear,
            baselineYear,
            printMode,
            data?.completeDataSetRegistrations,
            dataEntryLocks,
            lockRevision,
        ],
    );

    const nameColumn: TableProps<IDataElement>["columns"] = [
        {
            title: (
                <Typography.Text style={{ color: "#05416eff" }}>
                    {dataSet.name.includes("- Actions")
                        ? "PIAP Actions"
                        : "Indicators"}
                </Typography.Text>
            ),

            render: (_, record) => {
                return (
                    <div>
                        {record.name}
                        &nbsp;
                        {!printMode && (
                            <>
                                <FaInfoCircle
                                    style={{
                                        color: "#428BCA",
                                        fontSize: "22.4px",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => {
                                        modal.info({
                                            title: "Indicator Dictionary",
                                            width: 700,
                                            centered: true,
                                            content: (
                                                <IndicatorDetails
                                                    indicator={record}
                                                />
                                            ),
                                        });
                                    }}
                                />
                                {contextHolder}
                            </>
                        )}
                    </div>
                );
            },
            key: "dataElement",
            fixed: printMode ? undefined : "left",
        },
    ];

    if (isLoading) return <Spinner />;
    if (isSuccess)
        return (
            <Flex vertical gap={8} className="results-form-section">
                <Table
                    columns={[...nameColumn, ...(columns ?? [])]}
                    dataSource={fields}
                    pagination={false}
                    scroll={
                        printMode ? undefined : { y: "calc(100vh - 385px)" }
                    }
                    tableLayout={printMode ? "fixed" : undefined}
                    bordered
                    size="small"
                    rowKey="id"
                />
                {!printMode && (
                    <>
                        <Flex>
                            <Button
                                onClick={openDataSetCompleteModal}
                                style={{
                                    backgroundColor:
                                        (
                                            data?.completeDataSetRegistrations ??
                                            []
                                        ).length > 0
                                            ? "#D9534F"
                                            : "#5CB85C",
                                    color: "white",
                                }}
                            >
                                {(data?.completeDataSetRegistrations ?? [])
                                    .length > 0
                                    ? "Recall data and edit"
                                    : "Submit data and lock"}
                            </Button>
                        </Flex>

                        <Modal
                            title={modalValues.title}
                            closable={{ "aria-label": "Custom Close Button" }}
                            open={isDataSetModalOpen}
                            onOk={handleDataSetOk}
                            onCancel={handleDataSetCancel}
                        >
                            <Typography.Text>
                                {modalValues.body}
                            </Typography.Text>
                        </Modal>
                    </>
                )}
            </Flex>
        );
}
