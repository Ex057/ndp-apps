import { createRoute, Outlet } from "@tanstack/react-router";
import React, { useEffect } from "react";

import { Flex } from "antd";
import Filter from "../../../../components/Filter";
import Spinner from "../../../../components/Spinner";
import { GoalValidator } from "../../../../types";
import { RootRoute } from "../../../__root";
import { NDPRoute } from "../route";

export const SubProgramActionRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "sub-program-actions",
    component: Component,
    validateSearch: GoalValidator,
    pendingComponent: Spinner,
});

function Component() {
    const { objective, ou, pe, program, category, categoryOptions } =
        SubProgramActionRoute.useSearch();
    const { categories, programs } = RootRoute.useLoaderData();

    const navigate = SubProgramActionRoute.useNavigate();
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
                ]}
            />
            <Outlet />
        </Flex>
    );
}
