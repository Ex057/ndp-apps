import { useDataEngine } from "@dhis2/app-runtime";
import { SelectProps, TableProps } from "antd";
import dayjs from "dayjs";
import { fromPairs, groupBy, isArray } from "lodash";
import { CSSProperties } from "react";
import { db } from "./db";
import {
    Analytics,
    AnalyticsData,
    budgetColumns,
    DataElement,
    DataElementGroupSet,
    DataElementGroupSetResponse,
    DHIS2OrgUnit,
    Dx,
    GoalSearch,
    MapPredicate,
    Option,
    OrganisationUnitDataSets,
    OrgUnit,
    PERFORMANCE_LABELS,
} from "./types";

export const percentFormatter = new Intl.NumberFormat("en-US", {
    style: "percent",
});

export const prepareVisionData = ({
    data,
    dataElements,
}: {
    data: Analytics;
    dataElements: Map<string, Record<string, string>>;
}): Array<Record<string, string | undefined>> | undefined => {
    return data.metaData.dimensions["dx"]?.map((x) => {
        const current: Map<string, string> = new Map();
        data.metaData.dimensions["pe"]?.forEach((pe) => {
            data.metaData.dimensions["Duw5yep8Vae"].forEach((dim) => {
                const search = data.rows.find(
                    (row) => row[0] === x && row[3] === pe && row[2] === dim,
                );
                current.set(`${pe}${dim}`, search?.[4] ?? "");
            });
        });

        return {
            id: x,
            ...dataElements.get(x),
            name: data.metaData.items[x].name,
            code: data.metaData.items[x].code,
            ...Object.fromEntries(current),
        };
    });
};

export const programOnly = new Set([
    "project-performance",
    "policy-actions",
    "output",
]);
export const programAndDegs = new Set([
    "objective",
    "sub-programme",
    "sub-intervention4action",
]);
export const onlyDegs = new Set(["goal", "resultsFrameworkObjective"]);

export const flattenDataElements = (dataElements: DataElement[]) => {
    return new Map(
        dataElements.map(
            ({
                id,
                name,
                aggregationType,
                dataElementGroups,
                attributeValues,
                dataSetElements,
            }) => {
                const [
                    {
                        dataSet: {
                            periodType,
                            organisationUnits: [{ code, displayName }],
                        },
                    },
                ] = dataSetElements;
                const obj: Map<string, string> = new Map();
                obj.set(id, name);
                obj.set("id", id);
                obj.set("dataSetPeriodType", periodType);
                obj.set("dataSetOrganisationUnitCode", code);
                obj.set("dataSetOrganisationUnitName", displayName);
                obj.set("aggregationType", aggregationType);
                attributeValues.forEach(
                    ({ value, attribute: { id, name } }) => {
                        obj.set(id, value);
                        obj.set(name, value);
                    },
                );
                dataElementGroups.forEach(
                    ({ id, name, groupSets, attributeValues }) => {
                        obj.set(id, name);
                        attributeValues.forEach(
                            ({ value, attribute: { id, name } }) => {
                                obj.set(id, value);
                                obj.set(name, value);
                            },
                        );
                        groupSets.forEach(({ id, name, attributeValues }) => {
                            obj.set(id, name);
                            attributeValues.forEach(
                                ({ value, attribute: { id, name } }) => {
                                    obj.set(id, value);
                                    obj.set(name, value);
                                },
                            );
                        });
                    },
                );
                return [id, Object.fromEntries(obj)];
            },
        ),
    );
};

export const flattenDataElementGroupSets = (
    dataElementGroupSets: DataElementGroupSet[],
) => {
    const allDataElements = dataElementGroupSets.flatMap(
        ({ attributeValues, id, name, dataElementGroups }) => {
            const degs = {
                ...fromPairs(
                    attributeValues.map(({ value, attribute: { id } }) => [
                        id,
                        value,
                    ]),
                ),
                ...fromPairs(
                    attributeValues.map(({ value, attribute: { name } }) => [
                        name,
                        value,
                    ]),
                ),
                degsName: name,
                degsId: id,
            };
            return dataElementGroups.flatMap(
                ({ id, attributeValues, name, dataElements }) => {
                    const deg = {
                        ...fromPairs(
                            attributeValues.map(
                                ({ value, attribute: { id } }) => [id, value],
                            ),
                        ),
                        ...fromPairs(
                            attributeValues.map(
                                ({ value, attribute: { name } }) => [
                                    name,
                                    value,
                                ],
                            ),
                        ),
                        degName: name,
                        degId: id,
                    };
                    return dataElements.map(
                        ({ attributeValues, id, name }) => ({
                            id,
                            name,
                            ...fromPairs(
                                attributeValues.map(
                                    ({ value, attribute: { id } }) => [
                                        id,
                                        value,
                                    ],
                                ),
                            ),
                            ...fromPairs(
                                attributeValues.map(
                                    ({ value, attribute: { name } }) => [
                                        name,
                                        value,
                                    ],
                                ),
                            ),
                            ...degs,
                            ...deg,
                        }),
                    );
                },
            );
        },
    );

    return new Map<string, Record<string, string>>(
        Object.entries(groupBy(allDataElements, "id")).map(([id, val]) => [
            id,
            Object.assign({}, ...val),
        ]),
    );
};

export const convertToDataElementGroupSetsOptions = (
    dataElementGroupSets: DataElementGroupSet[],
): SelectProps["options"] => {
    return dataElementGroupSets.map(({ id, name }) => ({
        value: id,
        label: name,
    }));
};
export const convertToDataElementGroupsOptions = (
    dataElementGroupSet: string | undefined,
    dataElementGroupSets: DataElementGroupSet[],
): SelectProps["options"] => {
    return dataElementGroupSets.flatMap(({ dataElementGroups, id }) => {
        if (
            // dataElementGroupSet !== undefined &&
            // dataElementGroupSet !== "All" &&
            dataElementGroupSet !== id
        ) {
            return [];
        }
        return dataElementGroups.map(({ id, name }) => ({
            value: id,
            label: name,
        }));
    });
};

export const convertToDataElementsOptions = (
    dataElementGroupSets: DataElementGroupSet[],
): SelectProps["options"] => {
    return dataElementGroupSets.flatMap(({ dataElementGroups }) =>
        dataElementGroups.flatMap(({ dataElements }) =>
            dataElements.map(({ id, name }) => ({
                value: id,
                label: name,
            })),
        ),
    );
};

export const createOptions2 = (labels: string[], values: string[]) => {
    if (labels.length === values.length) {
        return labels.map((label, index) => {
            return {
                label,
                value: values[index],
            };
        });
    }
    return [];
};

export const fixedPeriods = [
    "DAILY",
    "WEEKLY",
    "WEEKLYWED",
    "WEEKLYTHU",
    "WEEKLYSAT",
    "WEEKLYSUN",
    "BIWEEKLY",
    "MONTHLY",
    "BIMONTHLY",
    "QUARTERLY",
    "QUARTERLYNOV",
    "SIXMONTHLY",
    "SIXMONTHLYAPR",
    "SIXMONTHLYNOV",
    "YEARLY",
    "FYNOV",
    "FYOCT",
    "FYJUL",
    "FYAPR",
];

export const extractDataElementGroups = (
    dataElementGroupSets: DataElementGroupSet[],
    degs?: string,
): string[] => {
    if (dataElementGroupSets.length === 0) return [];

    if (degs !== undefined && degs !== "All") {
        const targetGroupSet = dataElementGroupSets.find((d) => d.id === degs);
        return targetGroupSet?.dataElementGroups.map((g) => g.id) ?? [];
    }
    return dataElementGroupSets.flatMap((d) =>
        d.dataElementGroups.map((g) => g.id),
    );
};

export const extractDataElementGroupsByProgram = (
    dataElementGroupSets: DataElementGroupSet[],
    program?: string,
    groupSet?: string,
): { groupSets: string[]; dataElementGroups: string[] } => {
    if (program === undefined || dataElementGroupSets.length === 0) {
        return {
            groupSets: [],
            dataElementGroups: [],
        };
    }

    let groupSets: string[] = [];

    if (groupSet) {
        groupSets = [groupSet];
    } else {
        groupSets = dataElementGroupSets.flatMap((d) => {
            const hasProgram =
                d.attributeValues?.some((a) => a.value === program) ?? false;

            if (hasProgram) {
                return d.id;
            }
            return [];
        });
    }

    const dataElementGroups = dataElementGroupSets.flatMap((d) => {
        if (groupSet && groupSet === d.id) {
            return d.dataElementGroups.map((g) => g.id);
        }
        const hasProgram =
            d.attributeValues?.some((a) => a.value === program) ?? false;

        if (groupSet === undefined && hasProgram) {
            return d.dataElementGroups.map((g) => g.id);
        }

        return [];
    });

    return {
        groupSets,
        dataElementGroups,
    };
};

export const validateDataElementGroupSets = (
    dataElementGroupSets: any,
): dataElementGroupSets is DataElementGroupSet[] => {
    return (
        Array.isArray(dataElementGroupSets) &&
        dataElementGroupSets.every(
            (set) =>
                set &&
                typeof set.id === "string" &&
                Array.isArray(set.dataElementGroups),
        )
    );
};

export const debounceNavigation = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300,
): T => {
    let timeoutId: NodeJS.Timeout;

    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
};
export const selectSearchParams = <K extends keyof GoalSearch>(
    searchParams: GoalSearch,
    keys: K[],
): Pick<GoalSearch, K> => {
    return keys.reduce(
        (acc, key) => {
            acc[key] = searchParams[key];
            return acc;
        },
        {} as Pick<GoalSearch, K>,
    );
};

export function filterMapFunctional<K, V>(
    map: Map<K, V>,
    predicate: MapPredicate<K, V>,
) {
    return Array.from(map)
        .filter(([key, value]) => predicate(key, value))
        .map(([, value]) => value);
}

export const calculatePerformanceRatio = (
    actual: number,
    target: number,
    aggregationType: string,
    isReducing: string,
): number => {
    if (aggregationType === "LAST") {
        return actual;
    }
    if (isNaN(actual) || isNaN(target) || target === 0) return NaN;
    if (isReducing) return (target * 100) / actual;
    return (actual * 100) / target;
};

export const formatPercentage = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
    }).format(value);
};

export const PERFORMANCE_COLORS = {
    red: { bg: "#EF4444", fg: "black", end: 75 },
    yellow: { bg: "#FBBF24", fg: "black", start: 75, end: 99 },
    gray: { bg: "#AAAAAA", fg: "black", start: 75, end: 99 },
    green: { bg: "#10B981", fg: "black", start: 100 },
} as const;

export const headerColors = {
    n: { backgroundColor: "#EF4444", color: "black" },
    m: { backgroundColor: "#FBBF24", color: "black" },
    x: { backgroundColor: "#AAAAAA", color: "black" },
    a: { backgroundColor: "#10B981", color: "black" },
} as const;
export const findBackground = (value: number) => {
    if (isNaN(value)) {
        return {
            style: {
                backgroundColor: PERFORMANCE_COLORS.gray.bg,
                color: PERFORMANCE_COLORS.gray.fg,
            },
            performance: "x",
        };
    }
    const { red, yellow, green } = PERFORMANCE_COLORS;
    // if (isDescending && isDescending === "true") {
    //     if (value < red.end) {
    //         return {
    //             style: { backgroundColor: green.bg, color: green.fg },
    //             performance: "a",
    //         };
    //     }
    //     if (value >= yellow.start && value < yellow.end) {
    //         return {
    //             style: { backgroundColor: yellow.bg, color: yellow.fg },
    //             performance: "m",
    //         };
    //     }
    //     if (value >= green.start) {
    //         return {
    //             style: { backgroundColor: red.bg, color: red.fg },
    //             performance: "n",
    //         };
    //     }
    // } else {

    // }

    if (value < red.end) {
        return {
            style: { backgroundColor: red.bg, color: red.fg },
            performance: "n",
        };
    }
    if (value >= yellow.start && value < yellow.end) {
        return {
            style: { backgroundColor: yellow.bg, color: yellow.fg },
            performance: "m",
        };
    }
    if (value >= green.start) {
        return {
            style: { backgroundColor: green.bg, color: green.fg },
            performance: "a",
        };
    }
    return {
        style: {
            backgroundColor: PERFORMANCE_COLORS.gray.bg,
            color: PERFORMANCE_COLORS.gray.fg,
        },
        performance: "x",
    };
};

export const derivePeriods = (periods?: string[]) => {
    if (!periods) return [];
    return periods.flatMap((p) => {
        return [p].concat(
            [3, 4, 1, 2].map((q) => {
                if (q === 1 || q === 2) {
                    return `${Number(p.slice(0, 4)) + 1}Q${q}`;
                }
                return `${p.slice(0, 4)}Q${q}`;
            }),
        );
    });
};

export const baselinePeriods = {
    NDPIII: "2017July",
    NDPIV: "2023July",
};

export function textPxWidth(
    text: string,
    font = "14px Cambria, Georgia, serif",
): number {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return Math.ceil(text.length * 8); // fallback
    ctx.font = font;
    const m = ctx.measureText(text);
    return Math.ceil(m.width);
}

export const getDefaultPeriods = (financialYears: string[]) => {
    const financialPeriods = financialYears.sort();

    const firstFinancialYear = financialPeriods.at(0);
    const lastFinancialYear = financialPeriods.at(-1);

    if (firstFinancialYear && lastFinancialYear) {
        const currentMonth = dayjs().month();
        let currentFinancialYear = dayjs().format("YYYY[July]");
        let previousFinancialYear = dayjs()
            .subtract(1, "year")
            .format("YYYY[July]");

        if (currentMonth < 6) {
            currentFinancialYear = dayjs()
                .subtract(1, "year")
                .format("YYYY[July]");
            previousFinancialYear = dayjs()
                .subtract(2, "year")
                .format("YYYY[July]");
        }
        if (firstFinancialYear === currentFinancialYear) {
            return {
                firstFinancialYear,
                lastFinancialYear,
                validPeriods: [currentFinancialYear],
                currentFinancialYear:
                    currentFinancialYear > lastFinancialYear
                        ? lastFinancialYear
                        : currentFinancialYear,
            };
        } else if (firstFinancialYear < currentFinancialYear) {
            return {
                firstFinancialYear,
                lastFinancialYear,
                validPeriods: financialPeriods.slice(-2),
                currentFinancialYear:
                    currentFinancialYear > lastFinancialYear
                        ? lastFinancialYear
                        : currentFinancialYear,
            };
        }

        return {
            firstFinancialYear,
            lastFinancialYear,
            validPeriods: [previousFinancialYear, currentFinancialYear],
            currentFinancialYear:
                currentFinancialYear > lastFinancialYear
                    ? lastFinancialYear
                    : currentFinancialYear,
        };
    } else {
        return {
            firstFinancialYear: "",
            lastFinancialYear: "",
            validPeriods: [],
            currentFinancialYear: "",
        };
    }
};

export const flattenDataElementGroupSetsResponse = ({
    dataElementGroupSets,
}: DataElementGroupSetResponse) => {
    return dataElementGroupSets.flatMap(
        ({ attributeValues, id, name, code, dataElementGroups }) => {
            const degs = {
                ...fromPairs(
                    attributeValues.map(({ value, attribute: { id } }) => [
                        id,
                        value,
                    ]),
                ),
                ...fromPairs(
                    attributeValues.map(({ value, attribute: { name } }) => [
                        name,
                        value,
                    ]),
                ),
                dataElementGroupSetName: name,
                dataElementGroupSetId: id,
                dataElementGroupSetCode: code,
            };
            return dataElementGroups.flatMap(
                ({ id, attributeValues, name, code, dataElements }) => {
                    const deg = {
                        ...fromPairs(
                            attributeValues.map(
                                ({ value, attribute: { id } }) => [id, value],
                            ),
                        ),
                        ...fromPairs(
                            attributeValues.map(
                                ({ value, attribute: { name } }) => [
                                    name,
                                    value,
                                ],
                            ),
                        ),
                        dataElementGroupName: name,
                        dataElementGroupId: id,
                        dataElementGroupCode: code,
                    };
                    return dataElements.flatMap(
                        ({
                            attributeValues,
                            id,
                            name,
                            code,
                            dataSetElements,
                        }) => {
                            const organisationUnits = dataSetElements.flatMap(
                                ({ dataSet: { organisationUnits } }) =>
                                    organisationUnits.map((ou) => ou.id),
                            );
                            const dataSets = dataSetElements.flatMap(
                                ({ dataSet }) => dataSet.id,
                            );
                            return {
                                id,
                                name,
                                code,
                                ...fromPairs(
                                    attributeValues.map(
                                        ({ value, attribute: { id } }) => [
                                            id,
                                            value,
                                        ],
                                    ),
                                ),
                                ...fromPairs(
                                    attributeValues.map(
                                        ({ value, attribute: { name } }) => [
                                            name,
                                            value,
                                        ],
                                    ),
                                ),
                                ...degs,
                                ...deg,
                                organisationUnits,
                                dataSets,
                            };

                            // return uniq(dataSetOrganizationUnits).map(
                            //     (organisationUnitId) => ({
                            //         ...de,
                            //         organisationUnitId,
                            //         dataSets,
                            //     }),
                            // );
                        },
                    );
                },
            );
        },
    );
};

export const legendItems = [
    {
        bg: PERFORMANCE_COLORS.green.bg,
        color: "black",
        label: "Achieved (>= 100%)",
    },
    {
        bg: PERFORMANCE_COLORS.yellow.bg,
        color: "black",
        label: "Moderately achieved (75-99%)",
    },
    {
        bg: PERFORMANCE_COLORS.red.bg,
        color: "black",
        label: "Not achieved (< 75%)",
    },
    { bg: PERFORMANCE_COLORS.gray.bg, color: "black", label: "No Data" },
];
export const performanceLegendItems = [
    {
        bg: PERFORMANCE_COLORS.green.bg,
        color: "black",
        label: "A - Achieved (>= 100%)",
    },
    {
        bg: PERFORMANCE_COLORS.yellow.bg,
        color: "black",
        label: "M - Moderately achieved (75-99%)",
    },
    {
        bg: PERFORMANCE_COLORS.red.bg,
        color: "black",
        label: "N - Not achieved (< 75%)",
    },
    { bg: PERFORMANCE_COLORS.gray.bg, color: "black", label: " ND - No Data" },
];

export const queryAnalytics = ({
    engine,
}: {
    engine: ReturnType<typeof useDataEngine>;
    pe?: string;
    quarters: string;
    dx: string;
    ou: string;
}) => {};

export const convertAnalyticsToObjects = (analytics: Analytics) => {
    const headers = analytics.headers.map((header) => header.name);
    return analytics.rows.map((row) => {
        return fromPairs(row.map((value, index) => [headers[index], value]));
    });
};

export const formatter = new Intl.NumberFormat("en-US", {
    style: "percent",
});

export const getCellStyle = (value: number): CSSProperties => {
    return {
        backgroundColor:
            value >= 1
                ? PERFORMANCE_COLORS.green.bg
                : value >= 0.75
                  ? PERFORMANCE_COLORS.yellow.bg
                  : value < 0.75
                    ? PERFORMANCE_COLORS.red.bg
                    : PERFORMANCE_COLORS.gray.bg,
        color:
            value >= 1
                ? PERFORMANCE_COLORS.green.fg
                : value >= 0.75
                  ? PERFORMANCE_COLORS.yellow.fg
                  : value < 0.75
                    ? PERFORMANCE_COLORS.red.fg
                    : PERFORMANCE_COLORS.gray.fg,
    };
};

export const LIST_CONTAINER_STYLE: CSSProperties = {
    backgroundColor: "white",
    padding: 5,
    minHeight: 200,
    height: 200,
    maxHeight: 200,
    border: "1px solid #d9d9d9",
    overflowY: "auto",
};

export const LIST_ITEM_STYLE: CSSProperties = {
    width: "50%",
    maxWidth: "50%",
    backgroundColor: "#d0eBd0",
    padding: 10,
    border: "1px solid #a4d2a3",
    borderRadius: "3px",
};

export const flattenOrganisationUnitDataSets = (
    dataSets: OrganisationUnitDataSets,
) => {
    return dataSets.dataSets.flatMap(({ dataSetElements }) => {
        return dataSetElements.map(
            ({ dataElement: { id, name, dataElementGroups } }) => {
                return {
                    id,
                    name,
                    ...fromPairs(
                        dataElementGroups.groupSets?.map(
                            ({ id, name, attributeValues }) => {
                                const entries: [string, string][] = [
                                    ["dataElementGroupSetName", name],
                                    ["dataElementGroupSetId", id],
                                ];
                                attributeValues.forEach(
                                    ({ value, attribute: { id, name } }) => {
                                        entries.push([id, value]);
                                        entries.push([name, value]);
                                    },
                                );
                                return entries;
                            },
                        ),
                    ),
                };
            },
        );
    });
};

export const processDataElements = (dataElements: DataElement[]) => {
    return dataElements.flatMap(
        ({ attributeValues, id, name, code, dataSetElements, ...rest }) => {
            const organisationUnits = new Set(
                dataSetElements.flatMap(({ dataSet: { organisationUnits } }) =>
                    organisationUnits.map((ou) => ou.path),
                ),
            );
            const dataSets = new Set(
                dataSetElements.flatMap(({ dataSet }) => dataSet.id),
            );

            const data = Array.from(organisationUnits).map((ou) => {
                const currentOu = ou.split("/").at(-1);
                return {
                    id,
                    name,
                    code,
                    ...fromPairs(
                        attributeValues.map(({ value, attribute: { id } }) => [
                            id,
                            value,
                        ]),
                    ),
                    ...fromPairs(
                        attributeValues.map(
                            ({ value, attribute: { name } }) => [name, value],
                        ),
                    ),
                    ...fromPairs(
                        attributeValues.map(
                            ({ value, attribute: { code } }) => [code, value],
                        ),
                    ),
                    attributes: attributeValues.map(({ value }) => value),
                    organisationUnits: Array.from(organisationUnits),
                    dataSets: Array.from(dataSets),
                    orgUnit: currentOu,
                    ...rest,
                };
            });
            return data;
        },
    );
};

export const queryProgramObjectives = async ({
    ndpVersion,
    attributeValue,
    program,
    orgUnit,
    programObjectives,
}: {
    ndpVersion: string;
    attributeValue: string;
    program?: string;
    orgUnit?: string;
    programObjectives: Option[];
}) => {
    const dataElements = await db.dataElements
        .where({ fsIKncW1Eps: ndpVersion, BmUMiIbD5XY: attributeValue })
        .filter((de) => {
            return (
                de.attributes !== undefined &&
                isArray(de.attributes) &&
                de.attributes.some((attr) => attr === program) &&
                isArray(de.organisationUnits) &&
                de.organisationUnits.some((ou) => ou.includes(orgUnit || ""))
            );
        })
        .toArray();

    const uniqueObjectives = dataElements.map((de) => de["GuoVDNEBAXA"]).flat();

    return programObjectives.filter((degSet) =>
        uniqueObjectives.includes(degSet.code),
    );
};

export const processByPerformance = ({
    dataElements,
    groupingBy,
    pe,
    programs,
    votes,
}: {
    dataElements: ReturnType<typeof processDataElements>;
    groupingBy: string;
    pe: string;
    programs: Option[];
    votes: Omit<DHIS2OrgUnit, "dataSets" | "leaf" | "parent">[];
}) => {
    return Object.values(groupBy(dataElements, groupingBy)).map((groups) => {
        const total = groups.length;
        const current = groups[0];
        const groupedPerformance = groupBy(groups, `${pe}performance-group`);
        const achieved = groupedPerformance["a"]
            ? groupedPerformance["a"].length
            : 0;
        const moderatelyAchieved = groupedPerformance["m"]
            ? groupedPerformance["m"].length
            : 0;
        const notAchieved = groupedPerformance["n"]
            ? groupedPerformance["n"].length
            : 0;
        const noData = groupedPerformance["x"]
            ? groupedPerformance["x"].length
            : 0;

        const percentAchieved = total !== 0 ? achieved / total : 0;
        const percentModeratelyAchieved =
            total !== 0 ? moderatelyAchieved / total : 0;
        const percentNotAchieved = total !== 0 ? notAchieved / total : 0;
        const percentNoData = total !== 0 ? noData / total : 0;

        const achievedWeighted = percentAchieved * (1 / 2);
        const moderatelyAchievedWeighted = percentModeratelyAchieved * (7 / 20);
        const notAchievedWeighted = percentNotAchieved * (3 / 20);
        const noDataWeighted = percentNoData * (0 / 200);

        const totalWeighted =
            achievedWeighted +
            moderatelyAchievedWeighted +
            notAchievedWeighted +
            noDataWeighted;

        const sumBaseline = groups.reduce((acc, curr) => {
            const baselineValue = Number(curr[`${pe}baseline`]);
            if (!isNaN(baselineValue)) {
                return acc + baselineValue;
            }
            return acc;
        }, 0);
        const sumTarget = groups.reduce((acc, curr) => {
            const targetValue = Number(curr[`${pe}target`]);
            if (!isNaN(targetValue)) {
                return acc + targetValue;
            }
            return acc;
        }, 0);

        const sumActual = groups.reduce((acc, curr) => {
            const actualValue = Number(curr[`${pe}actual`]);
            if (!isNaN(actualValue)) {
                return acc + actualValue;
            }
            return acc;
        }, 0);
        const sumApproved = groups.reduce((acc, curr) => {
            const approvedValue = Number(curr[`${pe}approved`]);
            if (!isNaN(approvedValue)) {
                return acc + approvedValue;
            }
            return acc;
        }, 0);

        let spend = "-";
        let allocation = "-";
        let actualSpend = 0;
        let approvedAllocation = 0;

        if (sumApproved !== 0) {
            approvedAllocation = sumTarget / sumApproved;
            allocation = formatter.format(approvedAllocation);
        }

        if (sumTarget !== 0) {
            actualSpend = sumActual / sumTarget;
            spend = formatter.format(actualSpend);
        }

        const vote = votes.find((v) => v.id === current["orgUnit"]) ?? {
            name: "",
            code: "",
        };

        return {
            ...current,
            achieved,
            moderatelyAchieved,
            notAchieved,
            noData,
            percentAchieved: percentFormatter.format(achieved / total),
            percentModeratelyAchieved: percentFormatter.format(
                moderatelyAchieved / total,
            ),
            percentNotAchieved: percentFormatter.format(notAchieved / total),
            percentNoData: percentFormatter.format(noData / total),
            total,
            program: programs?.find((p) => p.code === current["UBWSASWdyfi"])
                ?.name,
            groups,
            target: sumTarget,
            actual: sumActual,
            approved: sumApproved,
            baseline: sumBaseline,
            allocation,
            spend,
            actualSpend,
            approvedAllocation,
            achievedWeighted,
            moderatelyAchievedWeighted,
            notAchievedWeighted,
            noDataWeighted,
            totalWeighted,
            performance: sumTarget === 0 ? 0 : sumActual / sumTarget,
            ...vote,
        };
    });
};

export const createPerformanceColumns = ({
    nameColumn,
    baseline,
    pe,
    nonBaseline = false,
    quarters = false,
    categoryOptions = [],
    items,
}: {
    nameColumn: TableProps<AnalyticsData>["columns"];
    baseline: string;
    pe: string[];
    nonBaseline?: boolean;
    quarters?: boolean;
    categoryOptions?: string[];
    items: Record<string, Dx>;
    dimensions: Record<string, string[]>;
}) => {
    return [
        ...(nameColumn ?? []),
        ...pe.flatMap((pe) => {
            if (nonBaseline && baseline === pe) {
                return [];
            }
            return {
                title: items[pe]?.name,
                align: "center" as const,
                children: nonBaseline
                    ? categoryOptions
                          ?.flatMap((option, index) => {
                              if (index > 1) return [];
                              return {
                                  title:
                                      budgetColumns[option] ||
                                      items[option]?.name?.replace(
                                          "Budget ",
                                          "",
                                      ),
                                  dataIndex: `${pe}${option}`,
                                  align: "center" as const,
                                  // minWidth: 50,
                                  width: 110,
                              };
                          })
                          .concat(
                              [3, 4, 1, 2].map((quarter, index) => {
                                  const year = Number(pe.slice(0, 4));
                                  const currentYear =
                                      quarter === 1 || quarter === 2
                                          ? year + 1
                                          : year;
                                  return {
                                      title: `Q${index + 1}`,
                                      key: `${pe}${currentYear}Q${quarter}`,
                                      align: "center",
                                      dataIndex: `${pe}${currentYear}Q${quarter}`,
                                      // minWidth: 100,
                                      width: 110,
                                      children: [
                                          ...categoryOptions
                                              .slice(2)
                                              .map((option) => ({
                                                  title:
                                                      budgetColumns[option] ||
                                                      items[option]?.name,
                                                  dataIndex: `${currentYear}Q${quarter}${option}`,
                                                  key: `${currentYear}Q${quarter}${option}`,
                                                  align: "center" as const,
                                                  // minWidth: 40,
                                                  width: 110,
                                              })),
                                          {
                                              title: `%`,
                                              dataIndex: `${currentYear}Q${quarter}performance`,
                                              key: `${currentYear}Q${quarter}performance`,
                                              align: "center",
                                              // minWidth: 40,
                                              width: 110,
                                              onCell: (
                                                  row: Record<string, any>,
                                              ) => {
                                                  return {
                                                      style: row[
                                                          `${currentYear}Q${quarter}style`
                                                      ],
                                                  };
                                              },
                                          },
                                      ],
                                  };
                              }),
                          )
                    : (baseline === pe
                          ? [baseline]
                          : ["target", "actual", "performance"]
                      ).flatMap((currentValue, index) => {
                          const year = Number(pe.slice(0, 4));
                          if (index === 1 && quarters) {
                              return [3, 4, 1, 2].map((quarter, index) => {
                                  const currentYear =
                                      quarter === 1 || quarter === 2
                                          ? year + 1
                                          : year;
                                  return {
                                      title: `Q${index + 1}`,
                                      key: `${pe}${currentYear}Q${quarter}`,
                                      align: "center",
                                      width: 110,
                                      children: [
                                          {
                                              title: `A`,
                                              key: `${currentYear}Q${quarter}actual`,
                                              dataIndex: `${currentYear}Q${quarter}actual`,
                                              align: "center",
                                              // minWidth: 40,
                                              width: 110,
                                          },
                                          {
                                              title: `%`,
                                              dataIndex: `${currentYear}Q${quarter}performance`,
                                              key: `${currentYear}Q${quarter}performance`,
                                              align: "center",
                                              onCell: (
                                                  row: Record<string, any>,
                                              ) => {
                                                  return {
                                                      style: row[
                                                          `${currentYear}Q${quarter}style`
                                                      ],
                                                  };
                                              },
                                              // minWidth: 40,
                                              width: 110,
                                          },
                                      ],
                                  };
                              });
                          } else {
                              const title =
                                  items[currentValue]?.name ??
                                  PERFORMANCE_LABELS[index];
                              return {
                                  title: budgetColumns[currentValue] || title,
                                  key: `${pe}${currentValue}`,
                                  // minWidth: baseline === pe ? 78 : undefined,
                                  width: 110,
                                  align: "center",
                                  onCell: (row: Record<string, any>) => {
                                      if (index === 2) {
                                          return {
                                              style: row[`${pe}style`],
                                          };
                                      }
                                      return {};
                                  },
                                  dataIndex: `${pe}${currentValue}`,
                                  children: [],
                              };
                          }
                      }),
            };
        }),
    ];
};
