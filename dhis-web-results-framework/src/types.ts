import { generateFixedPeriods, periodTypes } from "@dhis2/multi-calendar-dates";
import type { TableColumnType, TableProps, TreeDataNode } from "antd";

import { ToOptions } from "@tanstack/react-router";
import { z } from "zod";
import { router } from "./router";
import { processDataElements } from "./utils";

const firstStringFromQuery = z.preprocess((value) => {
    if (Array.isArray(value)) {
        return value.find((item) => typeof item === "string");
    }
    return value;
}, z.string().optional());

export const NDPValidator = z
    .object({
        v: firstStringFromQuery,
    })
    .passthrough();

export const SettingsSearch = z.object({
    edit: z.string().optional(),
});

export const GoalValidator = z.object({
    objective: z.string().optional(),
    tab: z.string().optional(),
    pe: z.string().array().optional(),
    program: z.string().optional(),
    quarters: z.boolean().optional(),
    requiresProgram: z.boolean().optional(),
    category: z.string(),
    categoryOptions: z.string().array().optional(),
    ou: z.string(),
    nonBaseline: z.boolean().optional(),
    q: z.string().optional(),
    keyResultArea: z.string().optional(),
    goal: z.string().optional(),
});

export const PerformanceSchema = z.object({
    pe: firstStringFromQuery,
    quarters: z.boolean().optional(),
    category: z.string(),
    categoryOptions: z.string().array().optional(),
});
export const VoteSchema = z.object({
    pe: firstStringFromQuery,
    quarters: z.boolean().optional(),
    ou: z.string(),
    category: z.string(),
    categoryOptions: z.string().array().optional(),
    isSum: z.boolean().optional(),
});

export const FlashReportSchema = z.object({
    pe: firstStringFromQuery,
    ou: z.string(),
});

export const ProgramReportSchema = z.object({
    pe: firstStringFromQuery,
    program: z.string(),
});

export const PolicyActionSearchSchema = z
    .object({
        v: firstStringFromQuery,
        ou: firstStringFromQuery,
        pe: firstStringFromQuery,
        category: firstStringFromQuery,
        categoryOptions: z
            .union([z.string(), z.array(z.string())])
            .optional(),
        deg: firstStringFromQuery,
        isSum: z.union([z.boolean(), z.string()]).optional(),
    })
    .passthrough();

export const ReportingRateSearchSchema = z
    .object({
        v: firstStringFromQuery,
        view: z.enum(["vote", "programme"]).optional(),
    })
    .passthrough();

export const DataElementGroupSetResponseSchema = z.object({
    pager: z.object({
        page: z.number(),
        total: z.number(),
        pageSize: z.number(),
        nextPage: z.string(),
        pageCount: z.number(),
    }),
    dataElementGroupSets: z.array(
        z.object({
            name: z.string(),
            id: z.string(),
            code: z.string(),
            attributeValues: z.array(
                z.object({
                    attribute: z.object({ name: z.string(), id: z.string() }),
                    value: z.string(),
                }),
            ),
            dataElementGroups: z.array(
                z.object({
                    name: z.string(),
                    id: z.string(),
                    code: z.string(),
                    attributeValues: z.array(
                        z.object({
                            attribute: z.object({
                                name: z.string(),
                                id: z.string(),
                            }),
                            value: z.string(),
                        }),
                    ),
                    dataElements: z.array(
                        z.object({
                            name: z.string(),
                            dataSetElements: z.array(
                                z.object({
                                    dataSet: z.object({
                                        id: z.string(),
                                        organisationUnits: z.array(
                                            z.object({ id: z.string() }),
                                        ),
                                    }),
                                }),
                            ),
                            id: z.string(),
                            code: z.string(),
                            attributeValues: z.array(
                                z.object({
                                    attribute: z.object({
                                        name: z.string(),
                                        id: z.string(),
                                    }),
                                    value: z.string(),
                                }),
                            ),
                        }),
                    ),
                }),
            ),
        }),
    ),
});

export type GoalSearch = z.infer<typeof GoalValidator>;
export type DataElementGroupSetResponse = z.infer<
    typeof DataElementGroupSetResponseSchema
>;

export type FlattenedDataElement = {
    organisationUnitId: string;
    dataElementGroupName: string;
    dataElementGroupId: string;
    dataElementGroupSetName: string;
    dataElementGroupSetId: string;
    id: string;
    name: string;
    dataSets: string[];
    [key: string]: string | string[] | undefined;
};

export type AdditionalColumn = {
    value: string;
    label: string;
    selected: boolean;
    render?: TableColumnType<
        Record<string, string | number | undefined>
    >["render"];
};

export interface OrgUnit extends TreeDataNode {
    pId?: string;
    value: string;
    id: string;
    title: string;
    children?: OrgUnit[];
}
export interface OrgUnitsResponse {
    organisationUnits: OrgUnit[];
}

export type AttributeValue = {
    attribute: { id: string; name: string; code: string };
    value: string;
};

export type NameWithAttribute = {
    id: string;
    name: string;
    attributeValues: AttributeValue[];
};

export type DataElementGroupSet = NameWithAttribute & {
    dataElementGroups: Array<
        NameWithAttribute & {
            dataElements: NameWithAttribute[];
        }
    >;
};

export type DataElement = NameWithAttribute & {
    displayName?: string;
    code: string;
    valueType: string;
    categoryCombo?: {
        id: string;
        name: string;
        displayName?: string;
    };
    dataElementGroups: Array<
        NameWithAttribute & {
            groupSets: NameWithAttribute[];
        }
    >;
    aggregationType: string;
    dataSetElements: Array<{
        dataSet: {
            name: string;
            periodType: string;
            id: string;
            organisationUnits: Array<{
                code: string;
                displayName: string;
                id: string;
                path: string;
            }>;
        };
    }>;
};

type MetaData = {
    items: Record<string, Dx>;
    dimensions: Record<string, string[]>;
};

export type Dx = {
    uid: string;
    name: string;
    dimensionType: string;
    description?: string;
    valueType?: string;
    aggregationType?: string;
    totalAggregationType?: string;
    startDate?: string;
    endDate?: string;
    code?: string;
};

type Header = {
    name: string;
    column: string;
    valueType: string;
    type: string;
    hidden: boolean;
    meta: boolean;
};

export type Analytics = {
    headers: Header[];
    metaData: MetaData;
    width: number;
    rows: string[][];
    height: number;
    headerWidth: number;
};

export type AppRouter = typeof router;

export type To = ToOptions<AppRouter>["to"];

export type PickerProps = {
    selectedPeriods: string[];
    onChange: (periods: string[]) => void;
};

export type AnalyticsData = Record<string, any> &
    ReturnType<typeof processDataElements>[number];

export interface ResultsProps extends GoalSearch {
    data: AnalyticsData[];
    items: Analytics["metaData"]["items"];
    dimensions: Analytics["metaData"]["dimensions"];
    onChange?: (key: string) => void;
    prefixColumns?: TableProps<AnalyticsData>["columns"];
    postfixColumns?: TableProps<AnalyticsData>["columns"];
    quarters?: boolean;
}

export type MapPredicate<K, V> = (key: K, value: V) => boolean;

export type Option = {
    id: string;
    name: string;
    code: string;
    created: string;
    optionSet?: { id: string };
};
export type OptionSet = {
    id: string;
    name: string;
    options: Option[];
};

export type TrackerProgrammeOption = {
    id: string;
    name: string;
};

export type TrackerLineListColumnMetadata = {
    id: string;
    label: string;
    source: "orgUnit" | "attribute" | "dataElement";
    searchable?: boolean;
    stageId?: string;
    stageLabel?: string;
    optionSet?: {
        id: string;
        options: Array<{
            code: string;
            name: string;
        }>;
    };
};

export type TrackerLineListRow = Record<string, string | undefined> & {
    key: string;
    trackedEntity: string;
};

export type PeriodType = (typeof periodTypes)[number];

export type FixedPeriod = ReturnType<typeof generateFixedPeriods>[number];

export type DHIS2OrgUnit = {
    id: string;
    name: string;
    leaf: boolean;
    parent: { id: string };
    code?: string;
    path: string;
};

export type ScorecardData = Map<
    string,
    ReturnType<typeof processDataElements>[number]
>;

export const OrganisationUnitDataSetsSchema = z.object({
    dataSets: z.array(
        z.object({
            dataSetElements: z.array(
                z.object({
                    dataElement: z.object({
                        name: z.string(),
                        id: z.string(),
                        code: z.string(),
                        dataElementGroups: z.object({
                            name: z.string(),
                            code: z.string(),
                            groupSets: z.array(
                                z.object({
                                    name: z.string(),
                                    id: z.string(),
                                    code: z.string(),
                                    attributeValues: z.array(
                                        z.object({
                                            attribute: z.object({
                                                code: z.string(),
                                                name: z.string(),
                                                id: z.string(),
                                            }),
                                            value: z.string(),
                                        }),
                                    ),
                                }),
                            ),
                            id: z.string(),
                            attributeValues: z.array(
                                z.object({
                                    attribute: z.object({
                                        code: z.string(),
                                        name: z.string(),
                                        id: z.string(),
                                    }),
                                    value: z.string(),
                                }),
                            ),
                        }),
                    }),
                }),
            ),
            organisationUnits: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    code: z.string(),
                }),
            ),
            name: z.string(),
        }),
    ),
});

export type OrganisationUnitDataSets = z.infer<
    typeof OrganisationUnitDataSetsSchema
>;

export const PERFORMANCE_LABELS: Record<number, string> = {
    0: "T",
    1: "A",
    2: "%",
} as const;

export const budgetColumns = {
    lAyLQi6IqVF: "BR",
    NfADZSy1VzB: "BS",
    YE32G6hzVDl: "BP",
    UHhWlfyy5bm: "BA",
    bqIaasqpTas: "B",
    Px8Lqkxy2si: "T",
    HKtncMjp06U: "A",
};
