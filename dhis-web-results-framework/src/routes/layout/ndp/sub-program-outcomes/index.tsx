import { createRoute } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { SubProgramOutcomeRoute } from "./route";
import { RootRoute } from "../../../__root";

export const SubProgramOutcomeIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => SubProgramOutcomeRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
	const { allOptionsMap } = RootRoute.useLoaderData();
    const { engine } = SubProgramOutcomeIndexRoute.useRouteContext();
    const search = SubProgramOutcomeIndexRoute.useSearch();
    const navigate = SubProgramOutcomeIndexRoute.useNavigate();
    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
        },
        ndpVersion: search.v,
        attributeValue: "intermediateOutcome",
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
                    title: "Intermediate Outcomes",
                    dataIndex: "k9c6BOHIohu",
                    render: (text) => allOptionsMap?.get(text) || text,
                },
            ],
        }),
        [data, onChange, search],
    );

    return <Results {...resultsProps} />;
}
