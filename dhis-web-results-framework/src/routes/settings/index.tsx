import { createRoute, Link, useLoaderData } from "@tanstack/react-router";
import { Flex } from "antd";
import { maxBy } from "lodash";
import { SettingsRoute } from "./route";

import type { TableProps } from "antd";
import { Table } from "antd";
import dayjs from "dayjs";
import React from "react";
import PeriodPicker from "../../components/period-picker";
import { Option } from "../../types";

type DataType = Option & {
    baseline: string;
    financialYears: string[];
    activeFinancialYears: string[];
    activeQuarters: string[];
};

export const SettingsIndexRoute = createRoute({
    getParentRoute: () => SettingsRoute,
    path: "/",
    component: Component,
    loaderDeps: ({ search }) => search,
});

function Component() {
    const { engine } = SettingsIndexRoute.useRouteContext();
    const { ndpVersions, configurations } = useLoaderData({ from: "__root__" });

    const dataSource: DataType[] = ndpVersions.map((version) => ({
        ...version,
        activeFinancialYears: [],
        activeQuarters: [],
        financialYears: [],
        baseline: "",
        ...(configurations[version.code]?.data ?? {}),
    }));
    const latestNDP = maxBy(ndpVersions, (version) => {
        return new Date(version.created).getTime();
    });

    const columns: TableProps<DataType>["columns"] = [
        {
            title: "NDP Version",
            dataIndex: "code",
            width: "8%",
        },
        {
            title: "Baseline Financial Year",
            dataIndex: "baseline",
            width: "10%",
            render: (_, record) => {
                return (
                    <PeriodPicker
                        period={record.baseline}
                        onChange={(baseline) => {
                            if (!Array.isArray(baseline) && baseline) {
                                handleSave({
                                    ...record,
                                    baseline,
                                });
                            }
                        }}
                        startingYear={getSafePeriodYear(record.baseline)}
                    />
                );
            },
        },
        {
            title: "Financial Years",
            dataIndex: "financialYears",
            render: (_, record) => {
                return (
                    <PeriodPicker
                        period={record.financialYears}
                        onChange={(financialYears) => {
                            if (Array.isArray(financialYears)) {
                                handleSave({
                                    ...record,
                                    financialYears,
                                });
                            }
                        }}
                        startingYear={getSafePeriodYear(record.financialYears?.at(-1))}
                        multiple
                    />
                );
            },
        },
        {
            title: "Active financial years",
            dataIndex: "activeFinancialYears",
            width: "20%",
            render: (_, record) => {
                return (
                    <PeriodPicker
                        period={record.activeFinancialYears}
                        onChange={(activeFinancialYears) => {
                            if (Array.isArray(activeFinancialYears)) {
                                handleSave({
                                    ...record,
                                    activeFinancialYears,
                                });
                            }
                        }}
                        startingYear={getSafePeriodYear(
                            record.activeFinancialYears?.at(-1),
                        )}
                        multiple
                    />
                );
            },
        },
        {
            title: "Active Quarter",
            dataIndex: "activeQuarters",
            width: "20%",
            render: (_, record) => {
                return (
                    <PeriodPicker
                        periodType="QUARTERLY"
                        period={record.activeQuarters}
                        onChange={(activeQuarters) => {
                            if (Array.isArray(activeQuarters)) {
                                handleSave({
                                    ...record,
                                    activeQuarters,
                                });
                            }
                        }}
                        startingYear={dayjs().year()}
                        multiple
                    />
                );
            },
        },
    ];

    const handleSave = async (row: DataType) => {
        await engine.mutate({
            resource: `dataStore/ndp-configurations`,
            data: row,
            type: "update",
            id: row.code,
        });
    };

    return (
        <Flex style={{ padding: 20 }} vertical gap={20}>
            <Link to="/ndp" search={{ v: latestNDP?.code ?? "" }}>
                Back
            </Link>
            <Table
                bordered
                dataSource={dataSource}
                columns={columns}
                rowKey="code"
            />
        </Flex>
    );
}

function getSafePeriodYear(period: string | undefined) {
    if (!period) {
        return dayjs().year();
    }

    const parsed = dayjs(period.replace("July", "-07"), "YYYY-MM", true);
    return parsed.isValid() ? parsed.year() : dayjs().year();
}
