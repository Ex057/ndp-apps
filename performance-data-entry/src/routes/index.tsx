import { createRoute } from "@tanstack/react-router";
import type { TableProps, TreeDataNode } from "antd";
import {
    Button,
    ConfigProvider,
    Flex,
    Form,
    Input,
    Modal,
    Select,
    Splitter,
    Table,
    Tree,
    Typography,
} from "antd";
import { orderBy } from "lodash";
import React, { useEffect, useMemo, useState } from "react";
import DataEntryTable from "../components/DataEntryTable";
import PeriodPicker from "../components/period-picker";
import { IDataSet, Option, PeriodType, search } from "../types";
import { getPathToNode } from "../utils";
import { RootRoute } from "./__root";

export const IndexRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/",
    component: IndexRouteComponent,
    validateSearch: search,
});

const getPeriodType = (
    dataSet: { id: string; name: string; periodType: string } | undefined,
) => {
    if (dataSet && dataSet.periodType === "FinancialJuly") {
        return "FYJUL";
    } else if (dataSet && dataSet.periodType) {
        return dataSet.periodType.toUpperCase() as PeriodType;
    }
    return undefined;
};

function IndexRouteComponent() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const {
        organisationTree,
        orgUnitDataSets,
        configuration,
        ndp3,
        ndp4,
        dataSets,
    } = RootRoute.useLoaderData();

    const { orgUnit, dataSet, pe, expanded, minPeriod, maxPeriod, periodType } =
        IndexRoute.useSearch();
    const dataSetsForSelectedOrgUnit = (
        orgUnit ? orgUnitDataSets[orgUnit] || [] : []
    ).filter((ds) => dataSets.includes(ds.id));
    const navigate = RootRoute.useNavigate();

    const [currentOptions, setCurrentOptions] = useState<Option[]>(ndp4);

    const columns: TableProps<Option>["columns"] = [
        {
            title: "Code",
            dataIndex: "code",
            key: "code",
            width: 75,
            align: "center",
        },
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
        },
    ];

    const searchOptions = useMemo(() => {
        const allNodes: { value: string; label: string }[] = [];

        const collectAllNodes = (nodes: TreeDataNode[]) => {
            nodes.forEach((node) => {
                allNodes.push({
                    value: String(node.key),
                    label: String(node.title),
                });
                if (node.children) {
                    collectAllNodes(node.children);
                }
            });
        };

        collectAllNodes(organisationTree);
        return allNodes;
    }, [organisationTree]);

    const showModal = () => {
        if (dataSet) {
            const selectedDataSet = dataSetsForSelectedOrgUnit.find(
                (ds) => ds.id === dataSet,
            );
            if (selectedDataSet && selectedDataSet.name.includes("NDPIII")) {
                setCurrentOptions(() => ndp3);
            } else if (
                selectedDataSet &&
                selectedDataSet.name.includes("NDPIV")
            ) {
                setCurrentOptions(() => ndp4);
            }
        }
        setIsModalOpen(true);
    };

    const handleOk = () => {
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const onSelectOrgUnit = (value: string) => {
        const pathToNode = getPathToNode(organisationTree, value);
        if (pathToNode) {
            navigate({
                search: (prev) => ({
                    ...prev,
                    expanded: pathToNode.slice(0, -1).join("-"),
                }),
            });
        }
        navigate({
            search: (prev) => ({
                ...prev,
                orgUnit: value,
                dataSet: undefined,
                pe: undefined,
            }),
        });
    };

    const handleSelect = (selectedKeys: React.Key[]) => {
        const selectedKey = selectedKeys[0];
        if (selectedKey) {
            navigate({
                search: (prev) => ({
                    ...prev,
                    orgUnit: selectedKey.toString(),
                    dataSet: undefined,
                    pe: undefined,
                }),
            });
        }
    };

    useEffect(() => {
        if (organisationTree.length === 1 && organisationTree[0].isLeaf) {
            const orgUnit = organisationTree[0].key;
            navigate({
                search: (prev) => ({
                    ...prev,
                    orgUnit,
                    dataSet: undefined,
                    pe: undefined,
                }),
            });
        }
    }, [organisationTree]);

    const handleDataSetChange = (
        value: string,
        option: IDataSet | IDataSet[],
    ) => {
        const dataSet = Array.isArray(option) ? option[0] : option;
        const dataSetNames = dataSet.name.split(" - ");
        const conf = configuration.find(
            (b) => b.key === dataSetNames[1].replaceAll(" ", ""),
        );
        const baseline = conf?.baseline.split(" ").join("") ?? "2023July";

        navigate({
            search: (prev) => ({
                ...prev,
                dataSet: value,
                baseline,
                pe: undefined,
                periodType: getPeriodType(dataSet),
                ndp: conf?.key,
            }),
        });
    };

    const onPeriodChange = (val: string | undefined) => {
        let targetYear: string | undefined = val;

        if (val?.includes("Q")) {
            const [year, quarter] = val.split("Q");
            const prev =
                quarter === "1" || quarter === "2"
                    ? String(Number(year) - 1)
                    : year;
            targetYear = `${prev}July`;
        }
        navigate({
            search: (prev) => ({
                ...prev,
                pe: val,
                targetYear,
            }),
        });
    };

    return (
        <Splitter
            style={{
                height: "calc(100vh - 48px)",
            }}
        >
            <Splitter.Panel
                defaultSize="20%"
                min="20%"
                max="20%"
                style={{ backgroundColor: "#F3F3F3", padding: 10 }}
            >
                <Flex vertical gap={12}>
                    <Select
                        showSearch
                        allowClear
                        placeholder="Search for NDP votes..."
                        style={{ width: "100%", flex: 1 }}
                        options={searchOptions}
                        filterOption={(input, option) =>
                            String(option?.label ?? "")
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        onSelect={onSelectOrgUnit}
                        value={orgUnit}
                        size="large"
                    />

                    <Flex
                        style={{
                            overflow: "auto",
                            height: "calc(100vh - 48px - 48px - 24px)",
                            width: "100%",
                            backgroundColor: "white",
                            padding: 10,
                            border: "1px solid #d9d9d9",
                            borderRadius: "3px",
                        }}
                    >
                        <Tree
                            treeData={organisationTree}
                            showLine
                            onSelect={handleSelect}
                            selectedKeys={orgUnit ? [orgUnit] : []}
                            expandedKeys={expanded ? expanded.split("-") : []}
                            onExpand={(keys) => {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        expanded: keys.join("-"),
                                    }),
                                });
                            }}
                            style={{
                                whiteSpace: "nowrap",
                                fontSize: "14px",
                                padding: 0,
                                margin: 0,
                            }}
                        />
                    </Flex>
                </Flex>
            </Splitter.Panel>
            <Splitter.Panel
                style={{
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                <Typography.Title
                    level={4}
                    style={{ margin: 0, color: "#585D61" }}
                >
                    NDP Results and Budgets Entry
                </Typography.Title>
                <Flex gap={10}>
                    <Flex
                        vertical
                        style={{
                            width: "50%",
                            maxWidth: "50%",
                            backgroundColor: "#d0eBd0",
                            padding: 10,
                            border: "1px solid #a4d2a3",
                            borderRadius: "3px",
                        }}
                    >
                        <Form.Item
                            label="NDP Votes"
                            layout="horizontal"
                            labelCol={{ span: 6 }}
                            wrapperCol={{ span: 18 }}
                            labelAlign="left"
                            style={{ margin: 0, padding: 5 }}
                        >
                            <ConfigProvider
                                theme={{
                                    token: {
                                        colorTextDisabled: "rgba(0,0,0,0.75)",
                                    },
                                }}
                            >
                                <Input
                                    value={
                                        dataSetsForSelectedOrgUnit[0]?.orgUnit
                                    }
                                    disabled
                                    placeholder="[Select vote from the tree on the left Panel]"
                                />
                            </ConfigProvider>
                        </Form.Item>

                        <Form.Item
                            label="Programme Dataset"
                            layout="horizontal"
                            labelCol={{ span: 6 }}
                            wrapperCol={{ span: 18 }}
                            labelAlign="left"
                            style={{ margin: 0, padding: 5 }}
                        >
                            <Select
                                options={orderBy(
                                    dataSetsForSelectedOrgUnit,
                                    (option) => {
                                        const numbers =
                                            option.name
                                                .match(/\d+/g)
                                                ?.map(Number) ?? [];

                                        if (numbers.length > 0) {
                                            return numbers.join();
                                        }

                                        return option.name;
                                    },
                                    "asc",
                                )}
                                fieldNames={{ label: "name", value: "id" }}
                                value={dataSet}
                                allowClear
                                showSearch
                                placeholder="Select data set"
                                filterOption={(input, option) =>
                                    String(option?.name ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                onChange={handleDataSetChange}
                            />
                        </Form.Item>

                        <Form.Item
                            label="Period"
                            layout="horizontal"
                            labelCol={{ span: 6 }}
                            wrapperCol={{ span: 18 }}
                            labelAlign="left"
                            style={{ margin: 0, padding: 5 }}
                        >
                            <PeriodPicker
                                periodType={periodType}
                                onChange={onPeriodChange}
                                period={pe}
                            />
                        </Form.Item>
                    </Flex>

                    <Flex
                        style={{
                            width: "50%",
                            maxWidth: "50%",
                            backgroundColor: "#BBD1EE",
                            padding: 10,
                            border: "1px solid #729fcf",
                            borderRadius: "3px",
                        }}
                        vertical
                        gap={10}
                        align="flex-end"
                    >
                        <div>
                            <Button
                                style={{
                                    backgroundColor: "#7DC18F",
                                    color: "white",
                                    width: "160px",
                                }}
                                onClick={showModal}
                            >
                                NDP Programme List
                            </Button>

                            <Modal
                                title="NDP Programme List"
                                open={isModalOpen}
                                onOk={handleOk}
                                onCancel={handleCancel}
                                footer={[
                                    <Button key="ok" onClick={handleCancel}>
                                        OK
                                    </Button>,
                                ]}
                            >
                                <Table
                                    columns={columns}
                                    dataSource={currentOptions}
                                    pagination={false}
                                    rowKey="id"
                                    bordered
                                    size="small"
                                    scroll={{ y: 400 }}
                                />
                            </Modal>
                        </div>
                        <div>
                            <Button
                                style={{
                                    backgroundColor: "#4096FF",
                                    color: "white",
                                    width: "160px",
                                }}
                            >
                                Print Results Form
                            </Button>
                        </div>
                    </Flex>
                </Flex>

                <DataEntryTable />
            </Splitter.Panel>
        </Splitter>
    );
}
