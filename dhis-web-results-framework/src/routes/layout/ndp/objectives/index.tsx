import { createRoute } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { derivePeriods } from "../../../../utils";
import { ObjectiveRoute } from "./route";
import { RootRoute } from "../../../__root";

export const ObjectIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => ObjectiveRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { keyResultAreas } = RootRoute.useLoaderData();

    const { engine } = ObjectIndexRoute.useRouteContext();
    const search = ObjectIndexRoute.useSearch();
    const navigate = ObjectIndexRoute.useNavigate();

    const allKeyResultAreasMap = useMemo(() => {
        const map = new Map<string, string>();
        keyResultAreas?.forEach((kra) => {
            map.set(kra.code, kra.name);
        });
        return map;
    }, [keyResultAreas]);

    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: derivePeriods(search.pe),
        },
        ndpVersion: search.v,
        attributeValue: "strategicObjective",
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
