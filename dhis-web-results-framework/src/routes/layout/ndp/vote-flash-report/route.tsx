import { createFixedPeriodFromPeriodId } from "@dhis2/multi-calendar-dates";
import {
    MinusSquareOutlined,
    PlusSquareOutlined,
} from "@ant-design/icons";
import { createRoute, Outlet } from "@tanstack/react-router";
import { Card, Collapse, Flex, Form, Select, Typography } from "antd";
import React from "react";
import PerformanceLegend from "../../../../components/performance-legend";
import RequiredVoteSelect from "../../../../components/required-vote-select";
import Spinner from "../../../../components/Spinner";
import { FlashReportSchema } from "../../../../types";
import { performanceLegendItems } from "../../../../utils";
import { RootRoute } from "../../../__root";
import { NDPRoute } from "../route";

export const VoteFlashReportRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "vote-flash-report",
    component: Component,
    loaderDeps: ({ search }) => ({
        v: search.v,
    }),
    validateSearch: FlashReportSchema,
});

function Component() {
    const { configurations } = RootRoute.useLoaderData();
    const navigate = VoteFlashReportRoute.useNavigate();
    const { v, ou, pe } = VoteFlashReportRoute.useSearch();
    const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);
    const config = configurations[v ?? ""]["data"];

    const { votes } = RootRoute.useLoaderData();
    const selectedVote = votes.find((vote) => vote.id === ou);
    const validOu = selectedVote?.id ?? votes[0]?.id ?? "";

    React.useEffect(() => {
        if (validOu && ou !== validOu) {
            navigate({
                replace: true,
                search: (prev) => ({ ...prev, ou: validOu }),
            });
        }
    }, [navigate, ou, validOu]);

    const periods = config["financialYears"].map((year: string) =>
        createFixedPeriodFromPeriodId({
            calendar: "gregory",
            periodId: year,
        }),
    );

    if (!validOu || ou !== validOu) {
        return <Spinner message="Loading vote..." />;
    }
    return (
        <Flex
            vertical
            style={{ padding: 10, height: "100%", flex: 1 }}
            gap={10}
        >
            <Card
                size="small"
                style={{
                    width: "50%",
                    maxWidth: "50%",
                    backgroundColor: "#BBD1EE",
                    borderColor: "#729fcf",
                    borderRadius: "3px",
                }}
                styles={{ body: { padding: "12px" } }}
            >
                <Collapse
                    bordered={false}
                    activeKey={isFiltersOpen ? ["filters"] : []}
                    onChange={(keys) =>
                        setIsFiltersOpen(
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
                                <Typography.Text strong style={{ fontSize: "14px" }}>
                                    Advanced report filters
                                </Typography.Text>
                            ),
                            children: (
                                <>
                                    <Form.Item
                                        label="Vote"
                                        layout="horizontal"
                                        labelCol={{ span: 2 }}
                                        wrapperCol={{ span: 22 }}
                                        labelAlign="left"
                                        style={{ margin: 0, padding: 5 }}
                                    >
                                        <RequiredVoteSelect
                                            votes={votes}
                                            style={{ width: 400 }}
                                            value={ou}
                                            onChange={(value) =>
                                                navigate({
                                                    search: (prev) => ({
                                                        ...prev,
                                                        ou: value,
                                                    }),
                                                })
                                            }
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="Period"
                                        layout="horizontal"
                                        labelCol={{ span: 2 }}
                                        wrapperCol={{ span: 22 }}
                                        labelAlign="left"
                                        style={{ margin: 0, padding: 5 }}
                                    >
                                        <Select
                                            options={periods.map(({ name, id }) => ({
                                                label: name,
                                                value: id,
                                            }))}
                                            style={{ width: 400 }}
                                            value={pe}
                                            onChange={(value) =>
                                                navigate({
                                                    search: (prev) => ({
                                                        ...prev,
                                                        pe: value,
                                                    }),
                                                })
                                            }
                                        />
                                    </Form.Item>
                                </>
                            ),
                        },
                    ]}
                />
            </Card>
            <Typography.Title level={3} style={{ margin: 0 }}>
                Consolidated Performance Report
            </Typography.Title>
            <Typography.Title level={5} style={{ margin: 0 }}>
                {selectedVote?.name}
            </Typography.Title>
            <PerformanceLegend legendItems={performanceLegendItems} />
            <Outlet key={`${ou}-${pe}`} />
        </Flex>
    );
}
