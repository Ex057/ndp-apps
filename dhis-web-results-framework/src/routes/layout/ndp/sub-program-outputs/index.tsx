import { createRoute } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { derivePeriods } from "../../../../utils";
import { SubProgramOutputRoute } from "./route";
import { RootRoute } from "../../../__root";

export const SubProgramOutputIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => SubProgramOutputRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { allOptionsMap } = RootRoute.useLoaderData();
    const { engine } = SubProgramOutputIndexRoute.useRouteContext();
    const search = SubProgramOutputIndexRoute.useSearch();
    const navigate = SubProgramOutputIndexRoute.useNavigate();
    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: derivePeriods(search.pe),
        },
        ndpVersion: search.v,
        attributeValue: "output",
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
                    title: "Outputs",
                    dataIndex: "AKzxCNn1zkQ",
                    key: "AKzxCNn1zkQ",
                    render: (text) => allOptionsMap?.get(text) || text,
                },
            ],
        }),
        [data, onChange, search],
    );

    return <Results {...resultsProps} />;
}
