import { createRoute, Outlet } from "@tanstack/react-router";
import React, { useEffect } from "react";

import { Alert, Flex } from "antd";
import Filter from "../../../../components/Filter";
import { GoalValidator } from "../../../../types";
import { RootRoute } from "../../../__root";
import { NDPRoute } from "../route";
import { programmeFilterDataElementsQueryOptions } from "../../../../query-options";
import { uniqBy } from "lodash";
import { useQuery } from "@tanstack/react-query";

export const OutcomeLevelRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "outcome-levels",
    component: Component,
    validateSearch: GoalValidator,
});

function Component() {
    const search = OutcomeLevelRoute.useSearch();
    const { categories, programs } = RootRoute.useLoaderData();
    const navigate = OutcomeLevelRoute.useNavigate();
    const { programGoals, allOptionsMap } = RootRoute.useLoaderData();
    const programGoal = programGoals.find(
        (pg) =>
            search.program !== undefined && pg.code.includes(search.program),
    );
    const objectivesQuery = useQuery(
        programmeFilterDataElementsQueryOptions({
            ndpVersion: search.v,
            attributeValue: "outcome",
            program: search.program,
            ou: search.ou,
        }),
    );
    const objectives = objectivesQuery.data ?? [];

    useEffect(() => {
        if (search.categoryOptions === undefined) {
            navigate({
                search: (prev) => ({
                    ...prev,
                    categoryOptions: categories.get(search.category),
                }),
            });
        }
    }, [categories, navigate, search.category, search.categoryOptions]);

    return (
        <Flex vertical gap={10} style={{ padding: 10, height: "100%" }}>
            <Filter
                data={{
                    objective: search.objective,
                    program: search.program,
                }}
                onChange={(val, previous) => {
                    if (previous) {
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                ...val,
                                [previous]: undefined,
                            }),
                        });
                    } else {
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                ...val,
                            }),
                        });
                    }
                }}
                options={[
                    {
                        key: "program",
                        options: programs.map(({ name, code }) => ({
                            value: code,
                            label: name,
                        })),
                        label: "NDP Programme",
                    },
                    {
                        key: "objective",
                        options: uniqBy(
                            objectives.flatMap((dataElement) => {
                                const objective = dataElement[
                                    "GuoVDNEBAXA"
                                ] as string | undefined;
                                if (!objective) return [];
                                return {
                                    value: objective,
                                    label:
                                        allOptionsMap.get(objective) ||
                                        objective,
                                };
                            }),
                            "value",
                        ),
                        label: "Program Objective",
                        loading: objectivesQuery.isFetching,
                        disabled: !search.program || objectivesQuery.isFetching,
                        error: objectivesQuery.isError,
                        emptyText: search.program
                            ? "No programme objectives found"
                            : "Select an NDP Programme first",
                    },
                ]}
            />

            {objectivesQuery.isError && (
                <Alert
                    type="error"
                    showIcon
                    message="Programme objectives could not be loaded"
                    action={
                        <a onClick={() => objectivesQuery.refetch()}>Retry</a>
                    }
                />
            )}

            {search.program && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 10,
                    }}
                >
                    {programGoal && (
                        <h3 style={{ margin: 0, color: "#1677FF" }}>
                            Program Goal:
                        </h3>
                    )}
                    <h3 style={{ margin: 0, flex: 1 }}>
                        {programGoal?.name ?? "Program goal not found"}
                    </h3>
                </div>
            )}
            <Outlet />
        </Flex>
    );
}
