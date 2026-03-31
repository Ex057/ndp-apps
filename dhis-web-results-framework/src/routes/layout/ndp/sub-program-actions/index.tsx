import { createRoute } from "@tanstack/react-router";
import React, { useMemo } from "react";
import { Results } from "../../../../components/results";
import { useAnalyticsQuery } from "../../../../hooks/data-hooks";
import { ResultsProps } from "../../../../types";
import { derivePeriods } from "../../../../utils";
import { RootRoute } from "../../../__root";
import { SubProgramActionRoute } from "./route";

export const SubProgramActionIndexRoute = createRoute({
    path: "/",
    getParentRoute: () => SubProgramActionRoute,
    component: Component,
    errorComponent: () => <div>{null}</div>,
});

function Component() {
    const { allOptionsMap } = RootRoute.useLoaderData();
    const { engine } = SubProgramActionIndexRoute.useRouteContext();
    const search = SubProgramActionIndexRoute.useSearch();
    const navigate = SubProgramActionIndexRoute.useNavigate();
    const { data, items, dimensions } = useAnalyticsQuery({
        engine,
        search: {
            ...search,
            pe: derivePeriods(search.pe),
        },
        ndpVersion: search.v,
        attributeValue: "action",
    });
    const onChange = (key: string) => {
        navigate({
            search: (prev) => ({
                ...prev,
                tab: key,
            }),
        });
    };
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
