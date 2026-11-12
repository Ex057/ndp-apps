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

export const SubProgramOutputRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "sub-program-outputs",
    component: Component,

    validateSearch: GoalValidator,
});

function Component() {
    const search = SubProgramOutputRoute.useSearch();
    const { categories, programs, allOptionsMap } = RootRoute.useLoaderData();
    const { objective, ou, pe, program, category, categoryOptions } = search;

    const navigate = SubProgramOutputRoute.useNavigate();
    const interventionsQuery = useQuery(
        programmeFilterDataElementsQueryOptions({
            ndpVersion: search.v,
            attributeValue: "output",
            program,
            ou,
        }),
    );
    const objectives = interventionsQuery.data ?? [];
    useEffect(() => {
        if (categoryOptions === undefined) {
            navigate({
                search: (prev) => ({
                    ...prev,
                    categoryOptions: categories.get(category),
                }),
            });
        }
    }, [categories, category, categoryOptions, navigate]);
    return (
        <Flex vertical gap={10} style={{ padding: 10, height: "100%" }}>
            <Filter
                data={{ objective, ou, pe, program }}
                onChange={(val, next) => {
                    if (next) {
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                ...val,
                                [next]: undefined,
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
                                const intervention = dataElement[
                                    "LKWITZXQD9l"
                                ] as string | undefined;
                                if (!intervention) return [];
                                return {
                                    value: intervention,
                                    label:
                                        allOptionsMap.get(intervention) ||
                                        intervention,
                                };
                            }),
                            "value",
                        ),
                        label: "Program Intervention",
                        loading: interventionsQuery.isFetching,
                        disabled: !program || interventionsQuery.isFetching,
                        error: interventionsQuery.isError,
                        emptyText: program
                            ? "No programme interventions found"
                            : "Select an NDP Programme first",
                    },
                ]}
            />
            {interventionsQuery.isError && (
                <Alert
                    type="error"
                    showIcon
                    message="Programme interventions could not be loaded"
                    action={
                        <a onClick={() => interventionsQuery.refetch()}>
                            Retry
                        </a>
                    }
                />
            )}
            <Outlet />
        </Flex>
    );
}
