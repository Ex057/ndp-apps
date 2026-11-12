import { useQuery } from "@tanstack/react-query";
import { Flex } from "antd";
import { orderBy } from "lodash";
import React from "react";
import {
    dataEntryLocksQueryOptions,
    dataSetQueryOptions,
} from "../query-options";
import { IndexRoute } from "../routes";
import { IDataSet } from "../types";
import CategoryCombo from "./CategoryCombo";
import Spinner from "./Spinner";

export default function DataEntryTable({
    printMode = false,
}: {
    printMode?: boolean;
}) {
    const search = IndexRoute.useSearch();
    const { engine } = IndexRoute.useRouteContext();
    const { data, isLoading, isError, error } = useQuery(
        dataSetQueryOptions(engine, search.dataSet),
    );
    const { data: dataEntryLocks } = useQuery(
        dataEntryLocksQueryOptions(engine, search.ndp),
    );
    if (isLoading) return <Spinner />;
    if (isError) return <div>Error: {(error as Error).message}</div>;

    if (
        data &&
        data.groupedDataSetElements &&
        Object.keys(data.groupedDataSetElements).length > 0
    ) {
        return (
            <Flex
                style={{
                    paddingTop: 16,
                    overflow: printMode ? "visible" : "auto",
                    height: printMode ? "auto" : "100%",
                }}
                gap="16px"
                vertical
            >
                {Object.entries(data?.groupedDataSetElements || {}).map(
                    ([groupId, fields]) => {
                        return (
                            <CategoryCombo
                                fields={orderBy(fields, "name", "asc")}
                                dataSet={data?.dataSet ?? ({} as IDataSet)}
                                key={groupId}
                                pe={search.pe!}
                                ou={search.orgUnit!}
                                targetYear={search.targetYear!}
                                baselineYear={search.baseline!}
                                search={search}
                                engine={engine}
                                printMode={printMode}
                                dataEntryLocks={dataEntryLocks}
                            />
                        );
                    },
                )}
            </Flex>
        );
    }
    return null;
}
