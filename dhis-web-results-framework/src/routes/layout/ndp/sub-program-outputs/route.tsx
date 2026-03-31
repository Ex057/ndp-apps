import { createRoute, Outlet } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { Flex } from "antd";
import Filter from "../../../../components/Filter";
import { GoalValidator } from "../../../../types";
import { RootRoute } from "../../../__root";
import { NDPRoute } from "../route";
import { queryDataElements } from "../../../../query-options";
import { uniqBy } from "lodash";

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
    const [objectives, setObjectives] = React.useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;
        async function loadObjectives() {
            const result = await queryDataElements({
                ...search,
                attributeValue: "output",
                ndpVersion: search.v,
            });
            if (isMounted) setObjectives(result);
        }
        loadObjectives();
        return () => {
            isMounted = false;
        };
    }, [search.program]);
    useEffect(() => {
        if (categoryOptions === undefined) {
            navigate({
                search: (prev) => ({
                    ...prev,
                    categoryOptions: categories.get(category),
                }),
            });
        }
    }, []);
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
                            objectives.map(({ LKWITZXQD9l }) => ({
                                value: LKWITZXQD9l,
                                label:
                                    allOptionsMap.get(LKWITZXQD9l) ||
                                    LKWITZXQD9l,
                            })),
                            "value",
                        ),
                        label: "Program Intervention",
                    },
                ]}
            />
            <Outlet />
        </Flex>
    );
}
