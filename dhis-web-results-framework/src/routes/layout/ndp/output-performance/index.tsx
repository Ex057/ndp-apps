import { createRoute } from "@tanstack/react-router";
import React from "react";
import Performance from "../../../../components/performance";
import { RootRoute } from "../../../__root";
import { OutputPerformanceRoute } from "./route";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
export const OutputPerformanceIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => OutputPerformanceRoute,
    component: Component,
});

function Component() {
    const { votes, ou } = RootRoute.useLoaderData();
    const { engine } = OutputPerformanceRoute.useRouteContext();
    // const results = OutputPerformanceRoute.useLoaderData();
    // const { pe, quarters, category, categoryOptions } =
    //     OutputPerformanceIndexRoute.useSearch();

    // const { data } = useSuspenseQuery(
    //     dataElementsFromGroupQueryOptions({
    //         engine,
    //         dataElementGroupSets: results.dataElementGroupSets,
    //         pe,
    //         quarters,
    //         category,
    //         categoryOptions,
    // 				votes
    //     }),
    // );
    // return <Performance props={[votes, data]} />;
    // return <div>Output Performance Component</div>;

    const search = OutputPerformanceIndexRoute.useSearch();

    const { data } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: [search.pe ?? ""],
            ou: ou,
        },
        ndpVersion: search.v,
        attributeValue: "output",
        specificLevel: 3,
        ouIsFilter: false,
    });

    return (
        <Performance
            data={data}
            pe={search.pe ?? ""}
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
    );
}
