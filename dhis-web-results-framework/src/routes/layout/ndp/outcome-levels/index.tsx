import { createRoute } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { derivePeriods } from "../../../../utils";
import { OutcomeLevelRoute } from "./route";
import { RootRoute } from "../../../__root";

export const OutcomeLevelIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => OutcomeLevelRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});
function Component() {
    const { engine } = OutcomeLevelIndexRoute.useRouteContext();
    const { allOptionsMap } = RootRoute.useLoaderData();
    const search = OutcomeLevelIndexRoute.useSearch();
    const navigate = OutcomeLevelIndexRoute.useNavigate();
    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: derivePeriods(search.pe),
        },
        ndpVersion: search.v,
        attributeValue: "outcome",
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
                    title: "Outcomes",
                    dataIndex: "YlPvYLC4VfO",
                    render: (text) => allOptionsMap?.get(text) || text,
                },
            ],
        }),
        [data, onChange, search],
    );

    return <Results {...resultsProps} />;
}
