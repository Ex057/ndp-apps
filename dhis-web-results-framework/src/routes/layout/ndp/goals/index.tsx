import { createRoute } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { RootRoute } from "../../../__root";
import { GoalRoute } from "./route";

export const GoalIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => GoalRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { keyResultAreas } = RootRoute.useLoaderData();
    const { engine } = GoalIndexRoute.useRouteContext();
    const search = GoalIndexRoute.useSearch();
    const navigate = GoalIndexRoute.useNavigate();

    const allKeyResultAreasMap = useMemo(() => {
        const map = new Map<string, string>();
        keyResultAreas?.forEach((kra) => {
            map.set(kra.code, kra.name);
        });
        return map;
    }, [keyResultAreas]);

    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search,
        ndpVersion: search.v,
        attributeValue: "ndpGoal",
    });
    const onChange = useCallback(
        (key: string) => {
            navigate({
                search: (prev) => ({
                    ...prev,
                    tab: key,
                }),
            });
        },
        [navigate],
    );
    const resultsProps = useMemo<ResultsProps>(
        () => ({
            data,
            items,
            dimensions,
            onChange,
            ...search,
            prefixColumns: [
                {
                    title: "Key Result Areas",
                    dataIndex: "JmZO4hoIlfT",
                    key: "JmZO4hoIlfT",
                    render: (text: string) =>
                        allKeyResultAreasMap?.get(text) || text,
                },
            ],
        }),
        [data, onChange, search],
    );

    return <Results {...resultsProps} />;
}
