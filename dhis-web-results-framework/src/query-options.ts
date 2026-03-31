import { useDataEngine } from "@dhis2/app-runtime";
import { queryOptions } from "@tanstack/react-query";
import { Dexie } from "dexie";
import { UploadProps } from "antd";

import {
    chunk,
    fromPairs,
    groupBy,
    isArray,
    isEmpty,
    orderBy,
    uniqBy,
} from "lodash";
import { db } from "./db";
import {
    Analytics,
    AnalyticsData,
    DataElement,
    DHIS2OrgUnit,
    GoalSearch,
    Option,
    OptionSet,
    OrgUnit,
} from "./types";
import {
    calculatePerformanceRatio,
    convertAnalyticsToObjects,
    findBackground,
    formatPercentage,
    processDataElements,
} from "./utils";

export const attachmentsQueryOptions = (
    baseUrl: string,
    engine: ReturnType<typeof useDataEngine>,
    attachments: string,
) => {
    return queryOptions({
        queryKey: ["attachments-query-options", attachments],
        queryFn: async () => {
            const defaultFileList: UploadProps<any>["defaultFileList"] = [];
            try {
                const { attachment } = JSON.parse(
                    attachments ?? '{"explanation": "", "attachment": []}',
                );
                if (
                    attachment &&
                    Array.isArray(attachment) &&
                    attachment.length > 0
                ) {
                    for (const a of attachment) {
                        try {
                            const event = (await engine.query({
                                event: {
                                    resource: `events/${a}`,
                                    params: {
                                        event: a,
                                    },
                                },
                            })) as any;
                            const fileResourceId = event.event.dataValues.find(
                                (dv: any) => dv.dataElement === "qeGJBGmsr0d",
                            )?.value;
                            const { fileResource } = (await engine.query({
                                fileResource: {
                                    resource: `fileResources/${fileResourceId}`,
                                },
                            })) as any;
                            defaultFileList.push({
                                uid: a,
                                name: fileResource?.name,
                                status: "done",
                                url: `${baseUrl}/api/events/files?dataElementUid=qeGJBGmsr0d&eventUid=${a}`,
                            });
                        } catch (error) {}
                    }
                }
            } catch (error) {}
            return defaultFileList;
        },
    });
};

export const queryDataElements = async ({
    ndpVersion,
    attributeValue,
    program,
    objective,
    keyResultArea,
    goal,
    ou,
    requiresProgram,
    queryByOu,
    isVision,
}: {
    ndpVersion: string;
    attributeValue?: string;
    program?: string;
    objective?: string;
    keyResultArea?: string;
    goal?: string;
    ou: string;
    requiresProgram?: boolean;
    queryByOu?: boolean;
    isVision?: boolean;
}) => {
    let where: Record<string, string | string[]> = {
        fsIKncW1Eps: ndpVersion,
    };

    if (attributeValue) {
        where.BmUMiIbD5XY = attributeValue;
    }

    if (queryByOu && ou) {
        where.orgUnit = ou;
    }
    const requiredAttributes: string[] = [];

    if (requiresProgram && program && program !== "All") {
        requiredAttributes.push(program);
    } else if (requiresProgram) {
        return [];
    }

    if (objective && objective !== "All") {
        requiredAttributes.push(objective);
    }

    if (keyResultArea && keyResultArea !== "All") {
        requiredAttributes.push(keyResultArea);
    }

    if (goal && goal !== "All") {
        requiredAttributes.push(goal);
    }

    if (isVision) {
        requiredAttributes.push("true");
    }

    const dataElements = await db.dataElements
        .where(where)
        .filter((de) => {
            if (requiredAttributes.length) {
                if (!Array.isArray(de.attributes)) return false;
                const hasAllAttributes = requiredAttributes.every((attr) =>
                    de.attributes.includes(attr),
                );
                if (!hasAllAttributes) return false;
            }
            if (ou && Array.isArray(de.organisationUnits)) {
                return de.organisationUnits.some(
                    (ouItem) => ouItem.indexOf(ou) !== -1,
                );
            }
            return true;
        })
        .toArray();

    return dataElements;
};

export const queryAnalytics = async ({
    pe,
    quarters,
    ou,
    engine,
    category,
    categoryOptions,
    ouIsFilter,
    requiresProgram,
    ndpVersion,
    attributeValue,
    program,
    objective,
    queryByOu,
    specificLevel,
    isVision,
    goal,
    keyResultArea,
}: {
    pe: string | string[];
    quarters?: boolean;
    ou: string;
    category: string;
    categoryOptions: string[];
    engine: ReturnType<typeof useDataEngine>;
    ouIsFilter: boolean;
    periodIsFilter?: boolean;
    requiresProgram?: boolean;
    ndpVersion: string;
    attributeValue?: string;
    program?: string;
    objective?: string;
    queryByOu?: boolean;
    specificLevel?: number;
    isVision?: boolean;
    goal?: string;
    keyResultArea?: string;
}): Promise<{
    data: AnalyticsData[];
    items: Analytics["metaData"]["items"];
    dimensions: Analytics["metaData"]["dimensions"];
}> => {
    const analyticsChunkSize = 200;
    let data: ReturnType<typeof processDataElements> = [];
    let items: Analytics["metaData"]["items"] = {};
    let dimensions: Analytics["metaData"]["dimensions"] = {};

    const target = categoryOptions.at(-2) ?? "";
    const actual = categoryOptions.at(-1) ?? "";
    const baseline = categoryOptions.at(0) ?? "";
    const approved = categoryOptions.at(1) ?? "";
    const dataElements = await queryDataElements({
        ndpVersion,
        attributeValue,
        program,
        objective,
        ou,
        requiresProgram,
        queryByOu,
        isVision,
        goal,
        keyResultArea,
    });
    const dataElementsMap = new Map(dataElements.map((de) => [de.id, de]));

    if (!isEmpty(pe) && dataElements.length > 0) {
        const periodFilter = new Set(pe);
        if (quarters) {
            for (const p of pe) {
                const year = Number(p?.slice(0, 4));
                const q1 = `${year}Q3`;
                const q2 = `${year}Q4`;
                const q3 = `${year + 1}Q1`;
                const q4 = `${year + 1}Q2`;
                periodFilter.add(q1).add(q2).add(q3).add(q4);
            }
        }

        const dataElementIds = Array.from(dataElementsMap.keys());

        const params = new URLSearchParams({
            includeMetadataDetails: "true",
        });

        let orgUnitParam = `ou:${ou}`;
        if (specificLevel !== undefined) {
            orgUnitParam = `${orgUnitParam};LEVEL-${specificLevel}`;
        }

        params.append("dimension", orgUnitParam);
        params.append("dimension", `${category}:${categoryOptions?.join(";")}`);
        params.append("dimension", `pe:${Array.from(periodFilter).join(";")}`);

        const queries: Record<string, any> = {};
        const dataValuesQueries: Record<string, any> = {};

        chunk(dataElementIds, analyticsChunkSize).forEach((deIds, index) => {
            const currentParams = new URLSearchParams(params);
            currentParams.append("dimension", `dx:${deIds.join(";")}`);

            queries[`analytics${index}`] = {
                resource: `analytics?${currentParams.toString()}`,
            };
        });

        chunk(dataElementIds, analyticsChunkSize).forEach((deIds, index) => {
            const currentParams = new URLSearchParams(params);
            currentParams.append("dimension", `dx:${deIds.join(";")}`);
            dataValuesQueries[`dataValues${index}`] = {
                resource: `dataValueSets?orgUnit=${ou}&period=${Array.from(periodFilter).join(",")}&dataElement=${deIds.join(",")}&attributeOptionCombo=${categoryOptions.join(",")}&children=true`,
            };
        });

        const currentData = (await engine.query(queries)) as Record<
            string,
            Analytics
        >;

        const currentDataValues = (await engine.query(
            dataValuesQueries,
        )) as Record<
            string,
            {
                dataValues?: Array<{
                    dataElement: string;
                    value: string;
                    period: string;
                    orgUnit: string;
                    categoryOptionCombo: string;
                    attributeOptionCombo: string;
                    comment?: string;
                }>;
            }
        >;

        const allComments: Record<string, string> = {};
        const allAttachments: Record<string, string> = {};
        for (const [, dataValues] of Object.entries(currentDataValues)) {
            if (dataValues) {
                for (const dv of dataValues.dataValues ?? []) {
                    try {
                        if (dv.comment) {
                            const { explanation } = JSON.parse(dv.comment) as {
                                explanation?: string;
                            };
                            allAttachments[
                                `${dv.dataElement}-${dv.period}-attachment`
                            ] = dv.comment;
                            allComments[
                                `${dv.dataElement}-${dv.period}-comment`
                            ] =
                                `${allComments[`${dv.dataElement}-${dv.period}-comment`] ?? ""}\r${explanation ?? ""}`;
                        }
                    } catch (error) {}
                }
            }
        }
        for (const [, analytics] of Object.entries(currentData)) {
            items = { ...items, ...analytics.metaData.items };
            dimensions = { ...dimensions, ...analytics.metaData.dimensions };
            const actualData = convertAnalyticsToObjects(analytics);
            const processedDataElements = analytics.metaData.dimensions[
                "dx"
            ].flatMap((dx) => {
                const de = dataElementsMap.get(dx)!;
                const dxFiltered = actualData.filter((item) => item.dx === dx);
                return Object.entries(groupBy(dxFiltered, "ou")).map(
                    ([orgUnit, orgUnitFiltered]) => {
                        const current: Map<string, any> = new Map();
                        for (const pe of analytics.metaData.dimensions["pe"]) {
                            const periodData = orgUnitFiltered.filter(
                                (row) => row.pe === pe,
                            );
                            const baselineValue = Number(
                                periodData.find((row) => {
                                    return row[category] === baseline;
                                })?.value,
                            );
                            let targetValue = Number(
                                periodData.find(
                                    (row) => row[category] === target,
                                )?.value,
                            );
                            let approvedValue = Number(
                                periodData.find(
                                    (row) => row[category] === approved,
                                )?.value,
                            );

                            const actualValue = Number(
                                periodData.find(
                                    (row) => row[category] === actual,
                                )?.value,
                            );
                            let year = pe.slice(0, 4);
                            if (pe.indexOf("Q") > -1) {
                                const quarter = pe.slice(-1);
                                if (quarter === "1" || quarter === "2") {
                                    year = String(Number(year) - 1);
                                }
                                targetValue = Number(
                                    orgUnitFiltered.find(
                                        (row) =>
                                            row[category] === target &&
                                            row["pe"] === `${year}July`,
                                    )?.value,
                                );
                            }

                            const ratio = calculatePerformanceRatio(
                                actualValue,
                                targetValue,
                                de.aggregationType,
                                de["descending indicator type"],
                            );
                            const { performance, style } =
                                findBackground(ratio);
                            if (isNaN(ratio)) {
                                current.set(`${pe}performance`, "-");
                            } else {
                                current.set(
                                    `${pe}performance`,
                                    formatPercentage(ratio / 100),
                                );
                            }

                            current.set("ou", orgUnit);
                            current.set(`${pe}style`, style);
                            current.set(`${pe}performance-group`, performance);
                            current.set(
                                `${pe}target`,
                                isNaN(targetValue) ? "-" : targetValue,
                            );
                            current.set(
                                `${pe}approved`,
                                isNaN(approvedValue) ? "-" : approvedValue,
                            );
                            current.set(
                                `${pe}actual`,
                                isNaN(actualValue) ? "-" : actualValue,
                            );
                            current.set(
                                `${pe}baseline`,
                                isNaN(baselineValue) ? "-" : baselineValue,
                            );
                            current.set(
                                `${pe}${target}`,
                                isNaN(targetValue) ? "-" : targetValue,
                            );
                            current.set(
                                `${pe}${actual}`,
                                isNaN(actualValue) ? "-" : actualValue,
                            );
                            current.set(
                                `${pe}${baseline}`,
                                isNaN(baselineValue) ? "-" : baselineValue,
                            );
                            current.set(
                                `${pe}${approved}`,
                                isNaN(approvedValue) ? "-" : approvedValue,
                            );
                            current.set(
                                `${pe}comment`,
                                allComments[`${dx}-${pe}-comment`] ?? "",
                            );
                            current.set(
                                `${pe}attachment`,
                                allAttachments[`${dx}-${pe}-attachment`] ?? [],
                            );
                        }
                        return {
                            ...de,
                            ...Object.fromEntries(current),
                        };
                    },
                );
            });
            data = data.concat(processedDataElements);
        }
    }
    return { data: orderBy(data, "code"), items, dimensions };
};

export const initialQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
) => {
    return queryOptions({
        queryKey: ["initial-query-options"],
        queryFn: async () => {
            const response = await engine.query({
                orgUnits: {
                    resource: "me",
                    params: {
                        fields: "organisationUnits[id,name,leaf],dataViewOrganisationUnits[id,name,leaf]",
                    },
                },
                options: {
                    resource: "optionSets",
                    params: {
                        filter: `id:in:[Az2bwwUIPWn,fALlyU4UYhZ,uV4fZlNvUsw,nZffnMQwoWr,D5J653eYk73,YY3JtOQIccj,xQG5xfRYb50,rcESKgz4zKM,jiBHfTa5VzB,zVYsHjAeHlG,fsIKncW1Eps,xLQd0SrtSF8,MfNa8J3R2Uv]`,
                        fields: "id,name,options[*]",
                    },
                },
                categories: {
                    resource: "categories",
                    params: {
                        filter: "id:in:[Duw5yep8Vae,kfnptfEdnYl]",
                        fields: "id,categoryOptions[id,name]",
                    },
                },
                central: {
                    resource: "organisationUnits/ONXWQ2EoOcP",
                    params: {
                        level: 1,
                        fields: "id,name,code,path",
                        paging: false,
                    },
                },
            });

            const {
                orgUnits: { dataViewOrganisationUnits },
                options,
                categories: { categories },
                central,
            } = response as unknown as {
                orgUnits: {
                    organisationUnits: DHIS2OrgUnit[];
                    dataViewOrganisationUnits: DHIS2OrgUnit[];
                };
                options: { optionSets: OptionSet[] };
                categories: {
                    categories: Array<{
                        id: string;
                        categoryOptions: Array<{
                            id: string;
                            name: string;
                        }>;
                    }>;
                };
                central: {
                    organisationUnits: Array<
                        Omit<DHIS2OrgUnit, "leaf" | "dataSets" | "parent">
                    >;
                };
            };
            const organisationUnits: OrgUnit[] = dataViewOrganisationUnits.map(
                ({ id, name, leaf }) => {
                    const current: OrgUnit = {
                        id,
                        title: name,
                        isLeaf: leaf,
                        value: id,
                        key: id,
                    };
                    return current;
                },
            );
            const allAreLeaves = organisationUnits.every((ou) => ou.isLeaf);
            const configurations: Record<string, any> = {};
            const {
                D5J653eYk73: programGoals,
                fALlyU4UYhZ: programObjectives,
                uV4fZlNvUsw: ndpVersions,
                rcESKgz4zKM: programOutcomes,
                jiBHfTa5VzB: programOutputs,
                xQG5xfRYb50: strategicObjectives,
                zVYsHjAeHlG: keyResultAreas,
                xLQd0SrtSF8: programs,
                MfNa8J3R2Uv: programInterventions,
            } = fromPairs(
                options.optionSets.map((oset) => [oset.id, oset.options]),
            );
            const all: Map<string, string> = new Map(
                options.optionSets
                    .flatMap((oset) => oset.options)
                    .map((o) => [o.code, o.name]),
            );
            for (const version of ndpVersions) {
                try {
                    const response = await engine.query({
                        data: {
                            resource: `dataStore/ndp-configurations/${version.code}`,
                        },
                    });
                    configurations[version.code] = response;
                } catch (error) {
                    try {
                        await engine.mutate({
                            resource: `dataStore/ndp-configurations/${version.code}`,
                            data: {
                                baseline: "",
                            },
                            type: "create",
                        });
                    } catch (error) {}
                }
            }
            await db.dataViewOrgUnits.bulkPut(organisationUnits);
            return {
                programs,
                ndpVersions,
                ou: dataViewOrganisationUnits[0].id,
                configurations,
                programGoals,
                programObjectives,
                programOutcomes,
                programOutputs,
                strategicObjectives,
                keyResultAreas,
                programInterventions,
                categories: new Map(
                    categories.map((c) => [
                        c.id,
                        c.categoryOptions.map((co) => co.id),
                    ]),
                ),
                categoryOptions: new Map(
                    categories
                        .flatMap((c) => c.categoryOptions)
                        .map((co) => [co.id, co.name]),
                ),
                votes: central.organisationUnits.filter((ou) => {
                    if (allAreLeaves) {
                        return dataViewOrganisationUnits.some(
                            (dvou) => dvou.id === ou.id,
                        );
                    }
                    return true;
                }),
                allAreLeaves,
                allOptionsMap: all,
            };
        },
    });
};

export const optionSetQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    optionsSet: string,
) => {
    return queryOptions({
        queryKey: ["option-set", optionsSet],
        queryFn: async () => {
            const { options } = await engine.query({
                options: {
                    resource: `optionSets/${optionsSet}/options`,
                },
            });
            return options;
        },
    });
};

export const dataElementGroupSetsQueryOptions = (
    attributeValue: string,
    ndpVersion: string,
) => {
    return queryOptions({
        queryKey: ["data-element-groupSets", attributeValue, ndpVersion],
        queryFn: async () => {
            const dataElements = await db.dataElements
                .where({ fsIKncW1Eps: ndpVersion, BmUMiIbD5XY: attributeValue })
                .toArray();
            return dataElements;
        },
    });
};

export const dataElementGroupSetsWithProgramsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    attributeValue: string,
    ndpVersion: string,
    program: string | undefined,
    orgUnit: string | undefined,
    objective?: string,
) => {
    return queryOptions({
        queryKey: [
            "option-sets-programs",
            program,
            orgUnit,
            ndpVersion,
            attributeValue,
            objective,
        ],
        queryFn: async () => {
            const dataElements = await db.dataElements
                .where({ fsIKncW1Eps: ndpVersion, BmUMiIbD5XY: attributeValue })
                .filter((de) => {
                    if (objective) {
                        return (
                            de.attributes !== undefined &&
                            isArray(de.attributes) &&
                            de.attributes.some((attr) => attr === program) &&
                            de.attributes.some((attr) => attr === objective) &&
                            isArray(de.organisationUnits) &&
                            de.organisationUnits.some((ou) =>
                                ou.includes(orgUnit || ""),
                            )
                        );
                    }
                    return (
                        de.attributes !== undefined &&
                        isArray(de.attributes) &&
                        de.attributes.some((attr) => attr === program) &&
                        isArray(de.organisationUnits) &&
                        de.organisationUnits.some((ou) =>
                            ou.includes(orgUnit || ""),
                        )
                    );
                })
                .toArray();
            return dataElements;
        },
    });
};

export const orgUnitQueryOptions = (
    orgUnit: string,
    engine: ReturnType<typeof useDataEngine>,
) => {
    return queryOptions({
        queryKey: ["organisations", orgUnit],
        queryFn: async () => {
            const response = await engine.query({
                organisationUnits: {
                    resource: `organisationUnits/${orgUnit}`,
                    params: {
                        fields: "children[id,name,leaf]",
                    },
                },
            });
            const {
                organisationUnits: { children },
            } = response as unknown as {
                organisationUnits: {
                    children: Array<{
                        id: string;
                        name: string;
                        leaf: boolean;
                    }>;
                };
            };

            if (children.length === 0) {
                return "No children found";
            }

            const organisationUnits = children.map(({ id, name, leaf }) => {
                const current: OrgUnit = {
                    id,
                    title: name,
                    isLeaf: leaf,
                    value: id,
                    key: id,
                    pId: orgUnit,
                };
                return current;
            });
            await db.dataViewOrgUnits.bulkPut(organisationUnits);
            return "Done";
        },
    });
};

export const analyticsQueryOptions = ({
    engine,
    search: {
        pe,
        ou,
        category,
        categoryOptions,
        requiresProgram,
        objective,
        program,
        quarters,
        goal,
        keyResultArea,
    },
    attributeValue,
    ndpVersion,
    queryByOu,
    specificLevel,
    ouIsFilter = true,
    isVision,
}: {
    engine: ReturnType<typeof useDataEngine>;
    search: GoalSearch;
    ndpVersion: string;
    attributeValue?: string;
    queryByOu?: boolean;
    specificLevel?: number;
    ouIsFilter?: boolean;
    isVision?: boolean;
}) => {
    return queryOptions({
        queryKey: [
            "analytics",
            ...(pe ?? []),
            ou,
            category,
            ...(categoryOptions ?? []),
            requiresProgram,
            objective,
            program,
            ndpVersion,
            attributeValue,
            goal,
            keyResultArea,
            isVision,
        ],
        queryFn: async () => {
            const data = await queryAnalytics({
                pe: pe ?? [],
                category,
                categoryOptions: categoryOptions ?? [],
                ou,
                ouIsFilter,
                engine,
                quarters,
                objective,
                program,
                requiresProgram,
                ndpVersion,
                attributeValue,
                queryByOu,
                specificLevel,
                isVision,
                goal,
                keyResultArea,
            });
            return data;
        },
        refetchOnWindowFocus: false,
        retry: false,
    });
};

export const dataStoreQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    ndpVersions: Array<Option>,
) => {
    return queryOptions({
        queryKey: ["dataStore"],
        queryFn: async () => {
            const data: Record<string, any> = {};
            for (const version of ndpVersions) {
                try {
                    const response = await engine.query({
                        data: {
                            resource: `dataStore/ndp-configurations/${version.code}`,
                        },
                    });
                    data[version.code] = response;
                } catch (error) {
                    try {
                        await engine.mutate({
                            resource: `dataStore/ndp-configurations/${version.code}`,
                            data: {
                                baseline: "-",
                            },
                            type: "create",
                        });
                    } catch (error) {}
                }
            }
            return data;
        },
    });
};

export const ndpIndicatorsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    ndpVersion: string,
) => {
    return queryOptions({
        queryKey: ["ndp-indicators", ndpVersion],
        queryFn: async () => {
            try {
                const doneCount = await db.dataElements
                    .where({ fsIKncW1Eps: ndpVersion })
                    .count();
                if (doneCount === 0) {
                    const {
                        dataElements: { dataElements },
                    } = (await engine.query({
                        dataElements: {
                            resource: `dataElements?filter=attributeValues.value:eq:${ndpVersion}&fields=id,name,code,aggregationType,description,attributeValues[value,attribute[id,name,code]],dataSetElements[dataSet[id,organisationUnits[path]]]&paging=false`,
                        },
                    })) as {
                        dataElements: { dataElements: DataElement[] };
                    };

                    const processed = processDataElements(dataElements);
                    await db.dataElements.bulkPut(processed);
                }
            } catch (error) {
                await Dexie.delete("ndp-rf");
                const {
                    dataElements: { dataElements },
                } = (await engine.query({
                    dataElements: {
                        resource: `dataElements?filter=attributeValues.value:eq:${ndpVersion}&fields=id,name,code,aggregationType,description,attributeValues[value,attribute[id,name,code]],dataSetElements[dataSet[id,organisationUnits[id]]]&paging=false`,
                    },
                })) as {
                    dataElements: { dataElements: DataElement[] };
                };
                const processed = processDataElements(dataElements);
                await db.dataElements.bulkPut(processed);
            }
            return "Done";
        },
    });
};

export const voteProgramOutcomesQueryOptions = ({
    engine,
    ndpVersion,
    ou,
    pe,
    quarters,
    searchKey,
    searchValue,
    programs,
    finalGrouping,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ndpVersion: string;
    ou: string;
    pe?: string;
    quarters?: boolean;
    searchKey?: string;
    searchValue?: string;
    programs: Option[];
    finalGrouping: string;
}) => {
    return queryOptions({
        queryKey: [
            "vote-program-outcomes",
            ndpVersion,
            ou,
            quarters,
            pe,
            searchKey,
            searchValue,
            finalGrouping,
            programs.map((p) => p.code).join(","),
        ],
        queryFn: async () => {
            const percentFormatter = new Intl.NumberFormat("en-US", {
                style: "percent",
            });

            let dataElements = await db.dataElements
                .where("organisationUnits")
                .equals(ou)
                .and((de) => {
                    return (
                        de["NDP"] === ndpVersion &&
                        de["UBWSASWdyfi"] !== undefined
                    );
                })
                .toArray();

            if (searchKey && searchValue) {
                dataElements = uniqBy(
                    dataElements.filter(
                        (de) =>
                            de[searchKey] === searchValue &&
                            de["UBWSASWdyfi"] !== undefined,
                    ),
                    "id",
                );
            } else {
                dataElements = uniqBy(
                    dataElements.filter(
                        (de) =>
                            de["UBWSASWdyfi"] !== undefined &&
                            ![
                                "action",
                                "output4action",
                                // "intervention4actions",
                                // "intervention",
                            ].includes(String(de["aWsagpqErAq"])),
                    ),
                    "id",
                );
            }

            const allDataElementGroups = groupBy(
                dataElements,
                "dataElementGroupId",
            );

            let periodFilter = pe;
            if (quarters) {
                const year = Number(pe?.slice(0, 4));
                const q1 = `${year}Q3`;
                const q2 = `${year}Q4`;
                const q3 = `${year + 1}Q1`;
                const q4 = `${year + 1}Q2`;
                periodFilter = `${pe};${q1};${q2};${q3};${q4}`;
            }

            const params = new URLSearchParams({
                includeMetadataDetails: "true",
            });
            params.append("filter", `ou:${ou}`);
            params.append(
                "dimension",
                `Duw5yep8Vae:bqIaasqpTas;Px8Lqkxy2si;HKtncMjp06U`,
            );
            params.append("dimension", `pe:${periodFilter}`);
            params.append(
                "dimension",
                `dx:${Object.keys(allDataElementGroups)
                    .map((de) => `DE_GROUP-${de}`)
                    .join(";")}`,
            );

            const { analytics } = (await engine.query({
                analytics: {
                    resource: `analytics??${params.toString()}`,
                },
            })) as { analytics: Analytics };

            const values = convertAnalyticsToObjects(analytics);

            const allProcessed = dataElements.map((de) => {
                const matched = values.filter((v) => v.dx === de.id);
                const target = matched.find(
                    (v) => v.Duw5yep8Vae === "Px8Lqkxy2si",
                );
                const actual = matched.filter((v) => {
                    if (quarters) {
                        return (
                            v.Duw5yep8Vae === "HKtncMjp06U" &&
                            v.pe.includes("Q")
                        );
                    }
                    return v.Duw5yep8Vae === "HKtncMjp06U";
                });
                const orderedActuals = orderBy(actual, "pe", "desc");

                if (target && orderedActuals.length > 0) {
                    const latestActual = Number(orderedActuals[0].value);
                    const targetValue = Number(target.value);
                    const performance = (latestActual / targetValue) * 100;
                    if (isNaN(performance) || !isFinite(performance)) {
                        return {
                            ...de,
                            performance,
                            status: "nd",
                        };
                    }

                    if (performance >= 100) {
                        return {
                            ...de,
                            performance,
                            status: "a",
                        };
                    }

                    if (performance >= 75 && performance < 100) {
                        return {
                            ...de,
                            performance,
                            status: "m",
                        };
                    }

                    if (performance < 75) {
                        return {
                            ...de,
                            performance,
                            status: "n",
                        };
                    }

                    return {
                        ...de,
                        performance,
                        status: "nd",
                    };
                }
                return {
                    ...de,
                    performance: 0,
                    status: "nd",
                };
            });
            const processed = Object.values(
                groupBy(allProcessed, finalGrouping),
            ).map((groups) => {
                const total = groups.length;
                const current = groups[0];
                const groupedPerformance = groupBy(groups, "status");
                const achieved = groupedPerformance["a"]
                    ? groupedPerformance["a"].length
                    : 0;
                const moderatelyAchieved = groupedPerformance["m"]
                    ? groupedPerformance["m"].length
                    : 0;
                const notAchieved = groupedPerformance["n"]
                    ? groupedPerformance["n"].length
                    : 0;
                const noData = groupedPerformance["nd"]
                    ? groupedPerformance["nd"].length
                    : 0;

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
                    percentNotAchieved: percentFormatter.format(
                        notAchieved / total,
                    ),
                    percentNoData: percentFormatter.format(noData / total),
                    total,
                    program: programs?.find(
                        (p) => p.code === current["UBWSASWdyfi"],
                    )?.name,
                    groups,
                };
            });
            return processed;
        },
        enabled: ou !== undefined && ou !== "" && pe !== undefined && pe !== "",
    });
};

export const voteFlashQueryOptions = ({
    engine,
    ndpVersion,
    ou,
    pe,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ndpVersion: string;
    ou: string;
    pe?: string;
}) => {
    return queryOptions({
        queryKey: ["vote-flash-report", ndpVersion, ou, pe],
        queryFn: async () => {
            const percentFormatter = new Intl.NumberFormat("en-US", {
                style: "percent",
            });

            let dataElements = await db.dataElements
                .where("organisationUnits")
                .equals(ou)
                .and((de) => {
                    return de["NDP"] === ndpVersion;
                })
                .toArray();

            const objectiveDataElements = dataElements.filter((de) => {
                return de["aWsagpqErAq"] === "objective";
            });
            const outcomeDataElements = dataElements.filter((de) => {
                return de["aWsagpqErAq"] === "sub-programme";
            });

            const outputDataElements = dataElements.filter((de) => {
                if (ndpVersion === "NDPIII") {
                    return de["aWsagpqErAq"] === "sub-intervention";
                }
                return de["aWsagpqErAq"] === "intervention";
            });
            const actionDataElements = dataElements.filter((de) => {
                if (ndpVersion === "NDPIII") {
                    return de["aWsagpqErAq"] === "sub-intervention4action";
                }
                return de["aWsagpqErAq"] === "intervention4actions";
            });

            const allDataElementGroups = groupBy(
                dataElements,
                "dataElementGroupId",
            );

            const year = Number(pe?.slice(0, 4));
            const q1 = `${year}Q3`;
            const q2 = `${year}Q4`;
            const q3 = `${year + 1}Q1`;
            const q4 = `${year + 1}Q2`;
            const periodFilter = `${pe};${q1};${q2};${q3};${q4}`;

            const params = new URLSearchParams({
                includeMetadataDetails: "true",
            });
            params.append("filter", `ou:${ou}`);

            params.append("dimension", `pe:${periodFilter}`);
            // params.append(
            //     "dimension",
            //     `dx:${Object.keys(allDataElementGroups)
            //         .map((de) => `DE_GROUP-${de}`)
            //         .join(";")}`,
            // );

            const objectiveParams = new URLSearchParams(params);
            const outcomeParams = new URLSearchParams(params);
            const outputParams = new URLSearchParams(params);
            const actionParams = new URLSearchParams(params);

            objectiveParams.append(
                "dimension",
                `Duw5yep8Vae:bqIaasqpTas;Px8Lqkxy2si;HKtncMjp06U`,
            );
            outcomeParams.append(
                "dimension",
                `Duw5yep8Vae:bqIaasqpTas;Px8Lqkxy2si;HKtncMjp06U`,
            );
            outputParams.append(
                "dimension",
                `Duw5yep8Vae:bqIaasqpTas;Px8Lqkxy2si;HKtncMjp06U`,
            );
            actionParams.append(
                "dimension",
                `kfnptfEdnYl:YE32G6hzVDl;UHhWlfyy5bm;lAyLQi6IqVF;NfADZSy1VzB`,
            );

            // objectiveParams.append(
            //     "dimension",
            //     `dx:${[
            //         ...new Set(
            //             objectiveDataElements.map(
            //                 (de) => `DE_GROUP-${de.dataElementGroupId}`,
            //             ),
            //         ),
            //     ].join(";")}`,
            // );
            // outcomeParams.append(
            //     "dimension",
            //     `dx:${[
            //         ...new Set(
            //             outcomeDataElements.map(
            //                 (de) => `DE_GROUP-${de.dataElementGroupId}`,
            //             ),
            //         ),
            //     ].join(";")}`,
            // );
            // outputParams.append(
            //     "dimension",
            //     `dx:${[
            //         ...new Set(
            //             outputDataElements.map(
            //                 (de) => `DE_GROUP-${de.dataElementGroupId}`,
            //             ),
            //         ),
            //     ].join(";")}`,
            // );
            // actionParams.append(
            //     "dimension",
            //     `dx:${[
            //         ...new Set(
            //             actionDataElements.map(
            //                 (de) => `DE_GROUP-${de.dataElementGroupId}`,
            //             ),
            //         ),
            //     ].join(";")}`,
            // );

            const {
                objectiveAnalytics,
                outcomeAnalytics,
                outputAnalytics,
                actionAnalytics,
            } = (await engine.query({
                objectiveAnalytics: {
                    resource: `analytics??${objectiveParams.toString()}`,
                },
                outcomeAnalytics: {
                    resource: `analytics??${outcomeParams.toString()}`,
                },
                outputAnalytics: {
                    resource: `analytics??${outputParams.toString()}`,
                },
                actionAnalytics: {
                    resource: `analytics??${actionParams.toString()}`,
                },
            })) as {
                objectiveAnalytics: Analytics;
                outcomeAnalytics: Analytics;
                outputAnalytics: Analytics;
                actionAnalytics: Analytics;
            };

            return {
                objective: convertAnalyticsToObjects(objectiveAnalytics),
                outcome: convertAnalyticsToObjects(outcomeAnalytics),
                output: convertAnalyticsToObjects(outputAnalytics),
                action: convertAnalyticsToObjects(actionAnalytics),
            };
        },
        enabled: ou !== undefined && ou !== "" && pe !== undefined && pe !== "",
    });
};
