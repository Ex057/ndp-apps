import { useDataEngine } from "@dhis2/app-runtime";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { analyticsQueryOptions } from "../query-options";
import { GoalSearch } from "../types";
export const useAnalyticsQuery = ({
    engine,
    search,
    attributeValue,
    ndpVersion,
    queryByOu,
    restrictToReportingRateProgrammes,
    specificLevel,
    ouIsFilter = true,
    isVision,
    goal,
    keyResultArea,
    enforceDataSetOrgUnitAssignments,
    organisationUnitIds,
}: {
    engine: ReturnType<typeof useDataEngine>;
    search: GoalSearch;
    attributeValue?: string;
    ndpVersion: string;
    queryByOu?: boolean;
    restrictToReportingRateProgrammes?: boolean;
    specificLevel?: number;
    ouIsFilter?: boolean;
    isVision?: boolean;
    goal?: string;
    keyResultArea?: string;
    enforceDataSetOrgUnitAssignments?: boolean;
    organisationUnitIds?: string[];
}) => {
    const queryOptions = useMemo(
        () =>
            analyticsQueryOptions({
                engine,
                search,
                attributeValue,
                ndpVersion,
                queryByOu,
                restrictToReportingRateProgrammes,
                specificLevel,
                ouIsFilter,
                isVision,
                enforceDataSetOrgUnitAssignments,
                organisationUnitIds,
            }),
        [
            engine,
            Object.values(search).sort().join(","),
            ndpVersion,
            attributeValue,
            queryByOu,
            restrictToReportingRateProgrammes,
            specificLevel,
            ouIsFilter,
            isVision,
            enforceDataSetOrgUnitAssignments,
            organisationUnitIds?.join(","),
        ],
    );
    const { data } = useSuspenseQuery(queryOptions);
    return data;
};
