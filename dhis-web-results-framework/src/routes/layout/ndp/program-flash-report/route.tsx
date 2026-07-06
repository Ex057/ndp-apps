import { createRoute, Outlet } from "@tanstack/react-router";
import { Col, Flex, Form, Row, Select, Typography } from "antd";
import React from "react";
import PerformanceLegend from "../../../../components/performance-legend";
import { ProgramReportSchema } from "../../../../types";
import {
    getDefaultPeriods,
    performanceLegendItems,
} from "../../../../utils";
import { NDPRoute } from "../route";
import { RootRoute } from "../../../__root";
import { createFixedPeriodFromPeriodId } from "@dhis2/multi-calendar-dates";

export const ProgramFlashReportRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "program-flash-report",
    component: Component,
    validateSearch: ProgramReportSchema,
});

function Component() {
    const { programs, configurations } = RootRoute.useLoaderData();
    const navigate = ProgramFlashReportRoute.useNavigate();
    const { v, pe, program } = ProgramFlashReportRoute.useSearch();
    const config = configurations[v ?? ""]["data"];
    const periods = config["financialYears"].map((year: string) =>
        createFixedPeriodFromPeriodId({
            calendar: "gregory",
            periodId: year,
        }),
    );

    React.useEffect(() => {
        const defaultProgram = programs.at(0)?.code;
        const { currentFinancialYear } = getDefaultPeriods(
            config["financialYears"] ?? [],
        );
        if (!defaultProgram && !currentFinancialYear) {
            return;
        }
        if (!program || !pe) {
            navigate({
                replace: true,
                search: (prev) => ({
                    ...prev,
                    program: program || defaultProgram || "",
                    pe: pe || currentFinancialYear,
                }),
            });
        }
    }, [config, navigate, pe, program, programs]);

    const selectedProgram = programs.find(
        ({ code }) => code === program,
    );

    if (!program || !pe) {
        return null;
    }

    return (
        <Flex
            vertical
            style={{ padding: 10, height: "100%", flex: 1 }}
            gap={10}
        >
            <Row
                style={{
                    width: "50%",
                    maxWidth: "50%",
                    backgroundColor: "#BBD1EE",
                    padding: 10,
                    border: "1px solid #729fcf",
                    borderRadius: "3px",
                }}
            >
                <Col span={24}>
                    <Form.Item
                        label="Programme"
                        layout="vertical"
                        style={{ margin: 0, padding: 5 }}
                    >
                        <Select
                            options={programs.map(({ name, id, code }) => ({
                                label: name,
                                value: code,
                            }))}
                            style={{ width: "100%" }}
                            value={program}
                            onChange={(value) => {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        program: value,
                                    }),
                                });
                            }}
                        />
                    </Form.Item>
                </Col>
                <Col span={24}>
                    <Form.Item
                        label="Period"
                        layout="vertical"
                        style={{ margin: 0, padding: 5 }}
                    >
                        <Select
                            options={periods.map(({ name, id }) => ({
                                label: name,
                                value: id,
                            }))}
                            style={{ width: "100%" }}
                            value={pe}
                            onChange={(value) => {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        pe: value,
                                    }),
                                });
                            }}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Typography.Title level={3} style={{ margin: 0 }}>
                Consolidated Program Performance Report
            </Typography.Title>
            <Typography.Title level={5} style={{ margin: 0 }}>
                {selectedProgram?.name}
            </Typography.Title>
            <PerformanceLegend legendItems={performanceLegendItems} />
            <Outlet />
        </Flex>
    );
}
