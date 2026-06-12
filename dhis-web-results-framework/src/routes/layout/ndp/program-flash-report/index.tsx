import { createRoute } from "@tanstack/react-router";
import { Flex, Typography } from "antd";
import React from "react";

import { ProgramFlashReportRoute } from "./route";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { RootRoute } from "../../../__root";
import { processByPerformance } from "../../../../utils";
import Performance from "../../../../components/performance";

export const ProgramFlashReportIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ProgramFlashReportRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { engine } = ProgramFlashReportIndexRoute.useRouteContext();
    const { pe = "", program, v } = ProgramFlashReportIndexRoute.useSearch();
    const { categories, programs, votes } = RootRoute.useLoaderData();
    const {
        data: outcomes,
        items,
        dimensions,
    } = useAnalyticsQuery({
        engine,
        search: {
            pe: [pe],
            category: "Duw5yep8Vae",
            categoryOptions: categories.get("Duw5yep8Vae") || [],
            ou: "qjk1ujdzlss",
            program,
            requiresProgram: true,
        },
        ndpVersion: v,
        attributeValue: "outcome",
        specificLevel: 3,
        ouIsFilter: false,
    });
    return (
        <Flex vertical gap="16px">
            <Performance
                data={outcomes}
                pe={pe}
                groupingBy="orgUnit"
                initialColumns={[
                    {
                        title: "Vote",
                        dataIndex: "code",
                        key: "code",
                        width: 80,
                        align: "center",
                        render: (_, record) => record.code?.replace("V", ""),
                        sorter: true,
                    },
                    {
                        title: "Institution",
                        dataIndex: "name",
                        key: "name",
                        filterSearch: true,
                        filters: votes.map((v) => ({
                            text: v.name,
                            value: v.name,
                        })),
                        onFilter: (value, record) =>
                            record.name.indexOf(value as string) === 0,
                        sorter: true,
                    },
                ]}
            />
        </Flex>
    );
}
