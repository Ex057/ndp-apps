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
    TrackerLineListColumnMetadata,
    TrackerLineListRow,
    TrackerProgrammeOption,
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

    console.log(program, requiresProgram);

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
                orgUnits: {
                    organisationUnits: assignedOrganisationUnits,
                },
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
            const organisationUnits: OrgUnit[] = assignedOrganisationUnits.map(
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
            await db.dataViewOrgUnits.clear();
            await db.dataViewOrgUnits.bulkPut(organisationUnits);
            return {
                programs,
                ndpVersions,
                ou: assignedOrganisationUnits[0]?.id,
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
                        return assignedOrganisationUnits.some(
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

export const trackerProgramsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    mode: "policy-actions" | "project-performances" = "policy-actions",
) => {
    return queryOptions({
        queryKey: ["tracker-programs", mode],
        queryFn: async () => {
            const response = await engine.query({
                programs: {
                    resource: "programs",
                    params: {
                        filter: "programType:eq:WITH_REGISTRATION",
                        fields: [
                            "id",
                            "name",
                            "displayName",
                            "code",
                            "programDomain",
                            "programTrackedEntityAttributes[displayInList]",
                            "programStages[programStageDataElements[displayInReports]]",
                        ].join(","),
                        pageSize: 1000,
                    },
                },
            });
            const { programs } = response as unknown as {
                programs: {
                    programs: Array<{
                        id: string;
                        name: string;
                        displayName?: string;
                        code?: string;
                        programDomain?: string;
                        programTrackedEntityAttributes?: Array<{
                            displayInList?: boolean;
                        }>;
                        programStages?: Array<{
                            programStageDataElements?: Array<{
                                displayInReports?: boolean;
                            }>;
                        }>;
                    }>;
                };
            };
            const scopedPrograms =
                mode === "project-performances"
                    ? programs.programs.filter(isLikelyProjectTrackerProgram)
                    : programs.programs.filter(isLikelyPolicyActionProgram);
            const visiblePrograms =
                scopedPrograms.length > 0 ? scopedPrograms : programs.programs;

            return orderBy(
                visiblePrograms.map<TrackerProgrammeOption>(
                    ({ id, name, displayName }) => ({
                        id,
                        name: displayName ?? name,
                    }),
                ),
                "name",
            );
        },
    });
};

export const trackerProgramMetadataQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    programId?: string,
) => {
    return queryOptions({
        queryKey: ["tracker-program-metadata", programId],
        enabled: Boolean(programId),
        queryFn: async () => {
            if (!programId) return [];
            const response = await engine.query({
                program: {
                    resource: `programs/${programId}`,
                    params: {
                        fields: [
                            "programTrackedEntityAttributes[displayInList,searchable,sortOrder,trackedEntityAttribute[id,name,displayName,optionSet[id,options[code,name,displayName]]]]",
                            "programStages[id,name,displayName,sortOrder,programStageDataElements[displayInReports,sortOrder,dataElement[id,name,displayName,optionSet[id,options[code,name,displayName]]]]]",
                        ].join(","),
                    },
                },
            });

            const { program } = response as unknown as {
                program: {
                    programTrackedEntityAttributes?: Array<{
                        displayInList?: boolean;
                        searchable?: boolean;
                        sortOrder?: number;
                        trackedEntityAttribute?: TrackerMetadataItem;
                    }>;
                    programStages?: Array<{
                        id?: string;
                        name?: string;
                        displayName?: string;
                        sortOrder?: number;
                        programStageDataElements?: Array<{
                            displayInReports?: boolean;
                            sortOrder?: number;
                            dataElement?: TrackerMetadataItem;
                        }>;
                    }>;
                };
            };

            const attributes =
                orderBy(
                    program.programTrackedEntityAttributes?.filter(
                        ({ displayInList }) => displayInList,
                    ) ?? [],
                    "sortOrder",
                ).flatMap(({ trackedEntityAttribute, searchable }) =>
                    trackedEntityAttribute
                        ? [
                              toTrackerColumnMetadata(
                                  trackedEntityAttribute,
                                  "attribute",
                                  { searchable },
                              ),
                          ]
                        : [],
                );

            const dataElements =
                orderBy(program.programStages ?? [], "sortOrder").flatMap(
                    (stage) =>
                        orderBy(
                            stage.programStageDataElements?.filter(
                                (de) => de.displayInReports === true,
                            ) ?? [],
                            "sortOrder",
                        ).flatMap((de) =>
                            de.dataElement
                                ? [
                                      toTrackerColumnMetadata(
                                          de.dataElement,
                                          "dataElement",
                                          {
                                              stageId: stage.id,
                                              stageLabel:
                                                  stage.displayName ??
                                                  stage.name,
                                          },
                                      ),
                                  ]
                                : [],
                        ),
                );

            return uniqBy([...attributes, ...dataElements], "id");
        },
    });
};

export const trackerLineListQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    {
        programId,
        rootOrgUnitId,
        orgUnitId,
        page = 1,
        pageSize = 50,
        fetchAll = false,
        enabled = true,
    }: {
        programId?: string;
        rootOrgUnitId?: string;
        orgUnitId?: string;
        page?: number;
        pageSize?: number;
        fetchAll?: boolean;
        enabled?: boolean;
    },
) => {
    return queryOptions({
        queryKey: [
            "tracker-line-list",
            programId,
            rootOrgUnitId,
            orgUnitId,
            page,
            pageSize,
            fetchAll,
        ],
        enabled: Boolean(programId && rootOrgUnitId && orgUnitId && enabled),
        queryFn: async () => {
            if (!programId || !rootOrgUnitId || !orgUnitId) {
                return { rows: [], total: 0 } satisfies TrackerLineListResult;
            }

            if (fetchAll) {
                const directTrackedEntityInstances =
                    await fetchTrackedEntitiesSafely(engine, {
                        programId,
                        orgUnitId,
                        pageSize: 1000,
                    });

                const shouldFallbackToRootScope =
                    orgUnitId !== rootOrgUnitId &&
                    directTrackedEntityInstances.length === 0;

                const trackedEntityInstances = shouldFallbackToRootScope
                    ? await fetchTrackedEntitiesSafely(engine, {
                          programId,
                          orgUnitId: rootOrgUnitId,
                          pageSize: 1000,
                      })
                    : directTrackedEntityInstances;

                const orgUnitDetailsById =
                    trackedEntityInstances.length > 0
                        ? await fetchOrgUnitDetailsByIdSafely(
                              engine,
                              Array.from(
                                  new Set(
                                      trackedEntityInstances.flatMap(({ orgUnit }) =>
                                          orgUnit ? [orgUnit] : [],
                                      ),
                                  ),
                              ),
                          )
                        : new Map<string, { name: string; path?: string }>();

                const processedRows = mapTrackedEntitiesToRows(
                    trackedEntityInstances,
                    orgUnitDetailsById,
                );

                const filteredRows =
                    shouldFallbackToRootScope && orgUnitId !== rootOrgUnitId
                        ? processedRows.filter((row) => {
                              const path = row.orgUnit
                                  ? orgUnitDetailsById.get(row.orgUnit)?.path
                                  : undefined;
                              return Boolean(
                                  path &&
                                      (path === `/${orgUnitId}` ||
                                          path.startsWith(`/${orgUnitId}/`) ||
                                          path.includes(`/${orgUnitId}/`)),
                              );
                          })
                        : processedRows;

                return {
                    rows: orderBy(
                        filteredRows,
                        [
                            (row) =>
                                String(
                                    row.orgUnitName ?? row.orgUnit ?? "",
                                ).toLowerCase(),
                        ],
                        ["asc"],
                    ),
                    total: filteredRows.length,
                } satisfies TrackerLineListResult;
            }

            const directPageResponse = await fetchTrackedEntityPage(engine, {
                programId,
                orgUnitId,
                page,
                pageSize,
            });
            const directTrackedEntityInstances =
                directPageResponse.trackedEntities.trackedEntityInstances ?? [];

            const shouldFallbackToRootScope =
                orgUnitId !== rootOrgUnitId &&
                directTrackedEntityInstances.length === 0;

            if (!shouldFallbackToRootScope) {
                const orgUnitDetailsById =
                    directTrackedEntityInstances.length > 0
                        ? await fetchOrgUnitDetailsByIdSafely(
                              engine,
                              Array.from(
                                  new Set(
                                      directTrackedEntityInstances.flatMap(
                                          ({ orgUnit }) =>
                                              orgUnit ? [orgUnit] : [],
                                      ),
                                  ),
                              ),
                          )
                        : new Map<string, { name: string; path?: string }>();

                const processedRows = mapTrackedEntitiesToRows(
                    directTrackedEntityInstances,
                    orgUnitDetailsById,
                );

                return {
                    rows: orderBy(
                        processedRows,
                        [
                            (row) =>
                                String(
                                    row.orgUnitName ?? row.orgUnit ?? "",
                                ).toLowerCase(),
                        ],
                        ["asc"],
                    ),
                    total:
                        directPageResponse.trackedEntities.pager?.total ??
                        processedRows.length,
                } satisfies TrackerLineListResult;
            }

            const fallbackTrackedEntityInstances =
                await fetchTrackedEntitiesSafely(engine, {
                    programId,
                    orgUnitId: rootOrgUnitId,
                    pageSize: 1000,
                });

            const orgUnitDetailsById =
                fallbackTrackedEntityInstances.length > 0
                    ? await fetchOrgUnitDetailsByIdSafely(
                          engine,
                          Array.from(
                              new Set(
                                  fallbackTrackedEntityInstances.flatMap(({ orgUnit }) =>
                                      orgUnit ? [orgUnit] : [],
                                  ),
                              ),
                          ),
                      )
                    : new Map<string, { name: string; path?: string }>();

            const filteredRows = mapTrackedEntitiesToRows(
                fallbackTrackedEntityInstances,
                orgUnitDetailsById,
            ).filter((row) => {
                const path = row.orgUnit
                    ? orgUnitDetailsById.get(row.orgUnit)?.path
                    : undefined;
                return Boolean(
                    path &&
                        (path === `/${orgUnitId}` ||
                            path.startsWith(`/${orgUnitId}/`) ||
                            path.includes(`/${orgUnitId}/`)),
                );
            });

            const sortedFilteredRows = orderBy(
                filteredRows,
                [
                    (row) =>
                        String(row.orgUnitName ?? row.orgUnit ?? "").toLowerCase(),
                ],
                ["asc"],
            );
            const startIndex = (page - 1) * pageSize;

            return {
                rows: sortedFilteredRows.slice(startIndex, startIndex + pageSize),
                total: sortedFilteredRows.length,
            } satisfies TrackerLineListResult;
        },
    });
};

export const orgUnitHierarchyQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    rootId?: string,
) => {
    return queryOptions({
        queryKey: ["org-unit-hierarchy", rootId],
        enabled: Boolean(rootId),
        queryFn: async () => {
            if (!rootId) return [];
            const response = await engine.query({
                root: {
                    resource: `organisationUnits/${rootId}`,
                    params: {
                        fields: "id,name,displayName,leaf,parent[id],path,ancestors[id,name,displayName,leaf,parent[id],path],children[id,name,displayName,leaf,parent[id],path]",
                    },
                },
            });
            const { root } = response as unknown as {
                root: {
                    id: string;
                    name: string;
                    displayName?: string;
                    leaf: boolean;
                    parent?: { id: string };
                    path: string;
                    ancestors?: Array<{
                        id: string;
                        name: string;
                        displayName?: string;
                        leaf: boolean;
                        parent?: { id: string };
                        path: string;
                    }>;
                    children?: Array<{
                        id: string;
                        name: string;
                        displayName?: string;
                        leaf: boolean;
                        parent?: { id: string };
                        path: string;
                    }>;
                };
            };
            const units = orderBy(
                uniqBy(
                    [
                        ...(root.ancestors ?? []),
                        root,
                        ...(root.children ?? []),
                    ],
                    "id",
                ),
                "path",
            );
            const rootPathIds = new Set(root.path.split("/").filter(Boolean));
            const nodes = new Map<string, OrgUnit>();

            units.forEach(({ id, name, displayName, leaf, parent }) => {
                nodes.set(id, {
                    id,
                    key: id,
                    value: id,
                    title: displayName ?? name,
                    isLeaf: leaf,
                    pId: parent?.id,
                    disabled: id !== rootId && rootPathIds.has(id),
                });
            });

            const tree: OrgUnit[] = [];
            nodes.forEach((node) => {
                if (node.pId && nodes.has(node.pId)) {
                    const parent = nodes.get(node.pId)!;
                    parent.children = [...(parent.children ?? []), node];
                } else {
                    tree.push(node);
                }
            });

            return sortOrgUnitTree(tree);
        },
    });
};

export const orgUnitChildrenQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    orgUnitId?: string,
) => {
    return queryOptions({
        queryKey: ["org-unit-children", orgUnitId],
        enabled: Boolean(orgUnitId),
        queryFn: async () => {
            if (!orgUnitId) return [];
            return fetchOrgUnitChildren(engine, orgUnitId);
        },
    });
};

type TrackerMetadataItem = {
    id: string;
    name: string;
    displayName?: string;
    optionSet?: {
        id: string;
        options?: Array<{
            code: string;
            name: string;
            displayName?: string;
        }>;
    };
};

const toTrackerColumnMetadata = (
    item: TrackerMetadataItem,
    source: TrackerLineListColumnMetadata["source"],
    extras?: Partial<
        Pick<
            TrackerLineListColumnMetadata,
            "searchable" | "stageId" | "stageLabel"
        >
    >,
): TrackerLineListColumnMetadata => ({
    id: item.id,
    label: item.displayName ?? item.name,
    source,
    searchable: extras?.searchable,
    stageId: extras?.stageId,
    stageLabel: extras?.stageLabel,
    optionSet: item.optionSet
        ? {
              id: item.optionSet.id,
              options:
                  item.optionSet.options?.map(({ code, name, displayName }) => ({
                      code,
                      name: displayName ?? name,
                  })) ?? [],
          }
        : undefined,
});

type DeprecatedTrackerTrackedEntity = {
    trackedEntityInstance: string;
    orgUnit?: string;
    orgUnitName?: string;
    attributes?: Array<{
        attribute: string;
        value: string;
    }>;
    enrollments?: Array<{
        events?: Array<{
            occurredAt?: string;
            eventDate?: string;
            dataValues?: Array<{
                dataElement: string;
                value: string;
            }>;
        }>;
    }>;
};

type DeprecatedTrackerResponse = {
    trackedEntities: {
        pager?: {
            page?: number;
            pageCount?: number;
            total?: number;
        };
        trackedEntityInstances?: DeprecatedTrackerTrackedEntity[];
    };
};

type TrackerLineListResult = {
    rows: TrackerLineListRow[];
    total: number;
};

async function fetchTrackedEntityPage(
    engine: ReturnType<typeof useDataEngine>,
    {
        programId,
        orgUnitId,
        page,
        pageSize,
    }: {
        programId: string;
        orgUnitId: string;
        page: number;
        pageSize: number;
    },
) {
    const response = await engine.query({
        trackedEntities: {
            resource: "trackedEntityInstances.json",
            params: {
                program: programId,
                ou: orgUnitId,
                ouMode: "DESCENDANTS",
                page,
                pageSize,
                totalPages: true,
                fields: [
                    "trackedEntityInstance",
                    "orgUnit",
                    "orgUnitName",
                    "attributes[attribute,value]",
                    "enrollments[enrollment,program,status,enrollmentDate,eventDate,events[event,programStage,status,eventDate,dataValues[dataElement,value]]]",
                ].join(","),
            },
        },
    });

    return response as unknown as DeprecatedTrackerResponse;
}

function mapTrackedEntitiesToRows(
    trackedEntityInstances: DeprecatedTrackerTrackedEntity[],
    orgUnitDetailsById: Map<string, { name: string; path?: string }>,
) {
    return trackedEntityInstances.map<TrackerLineListRow>((trackedEntity) => {
        const trackedEntityId = trackedEntity.trackedEntityInstance;
        const orgUnitDetails = trackedEntity.orgUnit
            ? orgUnitDetailsById.get(trackedEntity.orgUnit)
            : undefined;
        const row: TrackerLineListRow = {
            key: trackedEntityId,
            trackedEntity: trackedEntityId,
            orgUnit: trackedEntity.orgUnit,
            orgUnitName:
                trackedEntity.orgUnitName ??
                orgUnitDetails?.name ??
                trackedEntity.orgUnit,
        };

        trackedEntity.attributes?.forEach(({ attribute, value }) => {
            row[attribute] = value;
        });

        const latestValues = new Map<string, { value: string; occurredAt: string }>();

        trackedEntity.enrollments?.forEach(({ events }) => {
            events?.forEach((event) => {
                const occurredAt = event.eventDate ?? event.occurredAt ?? "";
                event.dataValues?.forEach(({ dataElement, value }) => {
                    const previous = latestValues.get(dataElement);
                    if (!previous || occurredAt >= previous.occurredAt) {
                        latestValues.set(dataElement, {
                            value,
                            occurredAt,
                        });
                    }
                });
            });
        });

        latestValues.forEach(({ value }, dataElement) => {
            row[dataElement] = value;
        });

        return row;
    });
}

async function fetchAllTrackedEntityPages(
    engine: ReturnType<typeof useDataEngine>,
    {
        programId,
        orgUnitId,
        pageSize,
    }: {
        programId: string;
        orgUnitId: string;
        pageSize: number;
    },
) {
    const allRows: DeprecatedTrackerTrackedEntity[] = [];
    let page = 1;
    let pageCount = 1;

    do {
        const response = await fetchTrackedEntityPage(engine, {
            programId,
            orgUnitId,
            page,
            pageSize,
        });
        const { trackedEntities } = response;

        allRows.push(...(trackedEntities.trackedEntityInstances ?? []));
        pageCount = trackedEntities.pager?.pageCount ?? pageCount;
        page += 1;
    } while (page <= pageCount);

    return allRows;
}

async function fetchTrackedEntitiesSafely(
    engine: ReturnType<typeof useDataEngine>,
    params: {
        programId: string;
        orgUnitId: string;
        pageSize: number;
    },
) {
    try {
        return await fetchAllTrackedEntityPages(engine, params);
    } catch (error) {
        if (isOrgUnitAccessError(error)) {
            return [];
        }
        throw error;
    }
}

function isLikelyPolicyActionProgram(program: {
    name: string;
    displayName?: string;
    code?: string;
    programDomain?: string;
    programTrackedEntityAttributes?: Array<{ displayInList?: boolean }>;
    programStages?: Array<{
        programStageDataElements?: Array<{ displayInReports?: boolean }>;
    }>;
}) {
    const searchableText = [
        program.name,
        program.displayName,
        program.code,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const normalizedDomain = program.programDomain?.toLowerCase();
    const hasReportProfile =
        program.programTrackedEntityAttributes?.some(
            ({ displayInList }) => displayInList,
        ) ||
        program.programStages?.some(({ programStageDataElements }) =>
            programStageDataElements?.some(
                ({ displayInReports }) => displayInReports,
            ),
        );

    return (
        hasReportProfile &&
        (normalizedDomain === "policyaction" ||
            normalizedDomain === "policy_action" ||
            searchableText.includes("policy action") ||
            searchableText.includes("policy directive") ||
            searchableText.includes("directive tracker"))
    );
}

function isLikelyProjectTrackerProgram(program: {
    name: string;
    displayName?: string;
    code?: string;
    programDomain?: string;
    programTrackedEntityAttributes?: Array<{ displayInList?: boolean }>;
    programStages?: Array<{
        programStageDataElements?: Array<{ displayInReports?: boolean }>;
    }>;
}) {
    const searchableText = [
        program.name,
        program.displayName,
        program.code,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    const normalizedDomain = program.programDomain?.toLowerCase();
    const hasReportProfile =
        program.programTrackedEntityAttributes?.some(
            ({ displayInList }) => displayInList,
        ) ||
        program.programStages?.some(({ programStageDataElements }) =>
            programStageDataElements?.some(
                ({ displayInReports }) => displayInReports,
            ),
        );

    return (
        hasReportProfile &&
        (normalizedDomain === "project" ||
            normalizedDomain === "projecttracker" ||
            normalizedDomain === "project_tracker" ||
            searchableText.includes("project tracker") ||
            searchableText.includes("project performance"))
    );
}

async function fetchOrgUnitDetailsById(
    engine: ReturnType<typeof useDataEngine>,
    orgUnitIds: string[],
) {
    if (orgUnitIds.length === 0) {
        return new Map<string, { name: string; path?: string }>();
    }

    const response = await engine.query({
        orgUnits: {
            resource: "organisationUnits",
            params: {
                filter: `id:in:[${orgUnitIds.join(",")}]`,
                fields: "id,name,displayName,path",
                pageSize: orgUnitIds.length,
            },
        },
    });
    const { orgUnits } = response as unknown as {
        orgUnits: {
            organisationUnits: Array<{
                id: string;
                name: string;
                displayName?: string;
                path?: string;
            }>;
        };
    };

    return new Map(
        orgUnits.organisationUnits.map(({ id, name, displayName, path }) => [
            id,
            {
                name: displayName ?? name,
                path,
            },
        ]),
    );
}

async function fetchOrgUnitDetailsByIdSafely(
    engine: ReturnType<typeof useDataEngine>,
    orgUnitIds: string[],
) {
    try {
        return await fetchOrgUnitDetailsById(engine, orgUnitIds);
    } catch (error) {
        if (isOrgUnitAccessError(error)) {
            return new Map<string, { name: string; path?: string }>();
        }
        throw error;
    }
}

async function fetchOrgUnitChildren(
    engine: ReturnType<typeof useDataEngine>,
    orgUnitId: string,
): Promise<OrgUnit[]> {
    const response = await engine.query({
        orgUnit: {
            resource: `organisationUnits/${orgUnitId}`,
            params: {
                fields: "children[id,name,displayName,leaf,parent[id],path]",
            },
        },
    });
    const { orgUnit } = response as unknown as {
        orgUnit: {
            children?: Array<{
                id: string;
                name: string;
                displayName?: string;
                leaf: boolean;
                parent?: { id: string };
                path: string;
            }>;
        };
    };

    return orderBy(
        (orgUnit.children ?? []).map(({ id, name, displayName, leaf, parent }) => ({
            id,
            key: id,
            value: id,
            title: displayName ?? name,
            isLeaf: leaf,
            pId: parent?.id,
        })),
        [(node) => String(node.title).toLowerCase()],
    );
}

function sortOrgUnitTree(nodes: OrgUnit[]): OrgUnit[] {
    return orderBy(
        nodes.map((node) => ({
            ...node,
            children: node.children
                ? sortOrgUnitTree(node.children as OrgUnit[])
                : undefined,
        })),
        [(node) => String(node.title).toLowerCase()],
    );
}

function isOrgUnitAccessError(error: unknown) {
    const errorText = JSON.stringify(error).toLowerCase();
    return (
        errorText.includes("organisation unit") &&
        (errorText.includes("access") ||
            errorText.includes("permission") ||
            errorText.includes("denied") ||
            errorText.includes("not found"))
    );
}

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
            const requiresRefresh = async () => {
                const sample = await db.dataElements
                    .where("fsIKncW1Eps")
                    .equals(ndpVersion)
                    .first();
                if (!sample) return true;
                return !(
                    Array.isArray(sample.voteCodes) &&
                    Array.isArray(sample.reportingCycles) &&
                    typeof sample.valueType === "string" &&
                    Array.isArray(sample.datasetAssignments) &&
                    Array.isArray(sample.dataSetNames)
                );
            };

            const loadDataElements = async () => {
                const {
                    dataElements: { dataElements },
                } = (await engine.query({
                    dataElements: {
                        resource: `dataElements?filter=attributeValues.value:eq:${ndpVersion}&fields=id,name,displayName,code,aggregationType,valueType,categoryCombo[id,name,displayName],description,attributeValues[value,attribute[id,name,code]],dataSetElements[dataSet[id,name,periodType,organisationUnits[code,displayName,id,path]]]&paging=false`,
                    },
                })) as {
                    dataElements: { dataElements: DataElement[] };
                };
                const processed = processDataElements(dataElements);
                await db.dataElements
                    .where("fsIKncW1Eps")
                    .equals(ndpVersion)
                    .delete();
                await db.dataElements.bulkPut(processed);
            };

            try {
                const doneCount = await db.dataElements
                    .where({ fsIKncW1Eps: ndpVersion })
                    .count();
                if (doneCount === 0 || (await requiresRefresh())) {
                    await loadDataElements();
                }
            } catch (error) {
                await Dexie.delete("ndp-rf");
                await loadDataElements();
            }
            return "Done";
        },
    });
};

export type IndicatorDictionaryRow = {
    key: string;
    id: string;
    displayName: string;
    code: string;
    aggregationType: string;
    disaggregation: string;
    valueType: string;
    periodType: string;
    vote: string;
    indicatorGroupType: string;
    completenessConfigured: number;
    completenessTotal: number;
    completenessRate: string;
    completenessState: "green" | "yellow" | "red";
    [key: string]: string | number;
};

export type IndicatorDictionaryTab = "ndpIndicators" | "classification";

export type IndicatorDictionarySortField = "displayName" | "code";

export type IndicatorDictionaryHeaderDefinition = {
    id: string;
    title: string;
    defaultVisible: boolean;
    width: number;
    sortable?: boolean;
    aliases?: string[];
};

export type IndicatorDictionaryPager = {
    page: number;
    pageCount: number;
    pageSize: number;
    total: number;
};

export type IndicatorClassificationOption = {
    id: string;
    code?: string;
    name: string;
};

export type ReportingRatesDatasetOption = {
    value: string;
    label: string;
    periodType?: string;
    assignedOrgUnitCount: number;
};

export type ReportingRatesQuarterOption = {
    value: string;
    label: string;
    financialYear: string;
    quarter: "Q1" | "Q2" | "Q3" | "Q4";
};

export type ReportingRatesRow = {
    key: string;
    orgUnitId: string;
    orgUnitName: string;
    dataSetId: string;
    dataSetName: string;
    quarterLabel: string;
    period: string;
    expectedReports: number;
    completedReports: number;
    missingReports: number;
    reportingRate: number;
    reportingRateDisplay: string;
    performanceBand: "green" | "yellow" | "red";
};

export type ReportingRateSummaryPeriodSummary = {
    numerator: number;
    denominator: number;
    rate: number;
    display: string;
    performanceBand: "green" | "yellow" | "red";
};

export type ReportingRateSummaryExpandedRow = {
    key: string;
    dataSetId: string;
    dataSetName: string;
    periodType: string;
    indicatorGroupType: string;
    indicatorGroupTypeLabel: string;
    reported: boolean;
};

export type ReportingRateSummaryRow = {
    key: string;
    orgUnitId: string;
    orgUnitName: string;
    assignedDataSetCount: number;
    assignedDataSets: ReportingRateSummaryExpandedRow[];
    periodSummaries: Record<
        "Q1" | "Q2" | "Q3" | "Q4" | "financialYear",
        ReportingRateSummaryPeriodSummary
    >;
};

export const indicatorDictionaryHeaders: IndicatorDictionaryHeaderDefinition[] = [
    {
        id: "displayName",
        title: "Name",
        defaultVisible: true,
        width: 520,
        sortable: true,
    },
    {
        id: "code",
        title: "Indicator code",
        defaultVisible: true,
        width: 150,
        sortable: true,
    },
    {
        id: "aggregationType",
        title: "Aggregation type",
        defaultVisible: true,
        width: 160,
    },
    {
        id: "disaggregation",
        title: "Disaggregation",
        defaultVisible: true,
        width: 160,
    },
    {
        id: "valueType",
        title: "Value type",
        defaultVisible: true,
        width: 120,
    },
    {
        id: "periodType",
        title: "Reporting cycle",
        defaultVisible: true,
        width: 140,
    },
    {
        id: "vote",
        title: "Vote",
        defaultVisible: true,
        width: 220,
    },
    {
        id: "indicatorGroupType",
        title: "Indicator Group Type",
        defaultVisible: true,
        width: 190,
        aliases: ["indicatorGroupType", "BmUMiIbD5XY"],
    },
    {
        id: "alternativeDataSource",
        title: "Alternative data source",
        defaultVisible: false,
        width: 220,
        aliases: ["Alternative data source", "alternativeDataSource"],
    },
    {
        id: "measurement",
        title: "Measurement",
        defaultVisible: false,
        width: 180,
        aliases: ["Measurement", "Lxe84DpBHhm", "measurement"],
    },
    {
        id: "descendingIndicatorType",
        title: "descending indicator type",
        defaultVisible: false,
        width: 220,
        aliases: [
            "descending indicator type",
            "Descending Indicator",
            "descendingIndicatorType",
        ],
    },
    {
        id: "frequencyOfDataCollection",
        title: "Frequency of data collection",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Frequency of data collection",
            "M5nS9I96cCx",
            "frequencyOfDataCollection",
        ],
    },
    {
        id: "dataSource",
        title: "Data Source",
        defaultVisible: false,
        width: 180,
        aliases: ["Data Source", "Prss6OhQvYg", "dataSource"],
    },
    {
        id: "intermediateOutcome",
        title: "Intermediate Outcome",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Intermediate Outcome",
            "k9c6BOHIohu",
            "intermediateOutcome",
        ],
    },
    {
        id: "keyResultAreas",
        title: "Key Result Areas",
        defaultVisible: false,
        width: 220,
        aliases: ["Key Result Areas", "Key Result Area", "JmZO4hoIlfT"],
    },
    {
        id: "leadMda",
        title: "Lead MDA",
        defaultVisible: false,
        width: 180,
        aliases: ["Lead MDA", "leadMda"],
    },
    {
        id: "limitations",
        title: "Limitations",
        defaultVisible: false,
        width: 220,
        aliases: ["Limitations", "limitations"],
    },
    {
        id: "ndp",
        title: "NDP",
        defaultVisible: false,
        width: 140,
        aliases: ["NDP", "fsIKncW1Eps", "ndp"],
    },
    {
        id: "ndpProgrammeList",
        title: "NDP Programme List",
        defaultVisible: false,
        width: 220,
        aliases: ["NDP Programme List", "UBWSASWdyfi", "Programme"],
    },
    {
        id: "otherMdas",
        title: "Other MDAs",
        defaultVisible: false,
        width: 180,
        aliases: ["Other MDAs", "otherMdas"],
    },
    {
        id: "programGoal",
        title: "Program Goal",
        defaultVisible: false,
        width: 180,
        aliases: ["Program Goal", "Goal", "m3Be0z4xNnA", "programGoal"],
    },
    {
        id: "programIntervention",
        title: "Program Intervention",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Program Intervention",
            "LKWITZXQD9l",
            "programIntervention",
        ],
    },
    {
        id: "programObjective",
        title: "Program Objective",
        defaultVisible: false,
        width: 220,
        aliases: ["Program Objective", "GuoVDNEBAXA", "programObjective"],
    },
    {
        id: "responsibilityForIndicator",
        title: "Responsibility for reporting",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Responsibility for reporting",
            "responsibilityForIndicator",
            "lIRw10zARY7",
        ],
    },
    {
        id: "rationale",
        title: "Rationale",
        defaultVisible: false,
        width: 220,
        aliases: ["Rationale", "rationale"],
    },
    {
        id: "strategicObjective",
        title: "Strategic Objective",
        defaultVisible: false,
        width: 220,
        aliases: ["Strategic Objective", "fwSdMAZ9egv", "strategicObjective"],
    },
    {
        id: "unitOfMeasure",
        title: "Unit of Measure",
        defaultVisible: false,
        width: 180,
        aliases: ["Unit of Measure", "FuRWtF51PyL", "unit", "unitOfMeasure"],
    },
    {
        id: "preferredDataSource",
        title: "Preferred Data Source",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Preferred Data Source",
            "preferredDataSource",
            "Prss6OhQvYg",
        ],
    },
    {
        id: "accountabilityForIndicator",
        title: "Accountability for Indicator",
        defaultVisible: false,
        width: 220,
        aliases: [
            "Accountability for Indicator",
            "accountabilityForIndicator",
        ],
    },
    {
        id: "indicatorType",
        title: "Indicator type",
        defaultVisible: false,
        width: 180,
        aliases: ["Indicator type", "indicatorType", "aWsagpqErAq"],
    },
    {
        id: "computationMethod",
        title: "Computation Method",
        defaultVisible: false,
        width: 220,
        aliases: ["Computation Method", "computationMethod"],
    },
];

const indicatorDictionaryCompletenessRules = {
    green: [
        "displayName",
        "code",
        "periodType",
        "computationMethod",
        "indicatorType",
        "preferredDataSource",
        "rationale",
        "responsibilityForIndicator",
        "unitOfMeasure",
    ],
    yellow: [
        "displayName",
        "code",
        "accountabilityForIndicator",
        "computationMethod",
        "preferredDataSource",
        "unitOfMeasure",
    ],
};

const dictionaryPlaceholder = "-";

const hasMeaningfulDictionaryValue = (value: unknown) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "number") return !Number.isNaN(value);
    const normalized = String(value).trim();
    if (normalized.length === 0) return false;
    return normalized !== dictionaryPlaceholder;
};

const normalizeDictionaryScalar = (value: unknown): string => {
    if (Array.isArray(value)) {
        const joined = value
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0)
            .join(", ");
        return joined.length > 0 ? joined : dictionaryPlaceholder;
    }
    if (value === undefined || value === null) {
        return dictionaryPlaceholder;
    }
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : dictionaryPlaceholder;
};

const getDictionaryHeaderValue = (
    dataElement: ReturnType<typeof processDataElements>[number],
    header: IndicatorDictionaryHeaderDefinition,
) => {
    switch (header.id) {
        case "displayName":
            return dataElement.displayName ?? dataElement.name ?? "";
        case "code":
            return dataElement.code ?? "";
        case "aggregationType":
            return dataElement.aggregationType ?? "";
        case "disaggregation":
            return dataElement.disaggregation ?? "";
        case "valueType":
            return dataElement.valueType ?? "";
        case "periodType":
            return dataElement.reportingCycles ?? [];
        case "vote":
            return Array.from(
                new Set(
                    (Array.isArray(dataElement.datasetAssignments)
                        ? dataElement.datasetAssignments
                        : []
                    )
                        .map((assignment) =>
                            String(assignment.orgUnitName ?? "").trim(),
                        )
                        .filter((value) => value.length > 0),
                ),
            ).sort();
        case "indicatorGroupType":
            return formatIndicatorGroupType(
                dataElement.BmUMiIbD5XY ?? dataElement.indicatorGroupType,
            );
        default:
            for (const alias of header.aliases ?? []) {
                const value = dataElement[alias];
                if (hasMeaningfulDictionaryValue(value)) {
                    return value;
                }
            }
            return "";
    }
};

const getDictionaryCompletenessState = (
    row: Record<string, string>,
): "green" | "yellow" | "red" => {
    const matchesRule = (fields: string[]) =>
        fields.every((field) => hasMeaningfulDictionaryValue(row[field]));
    if (matchesRule(indicatorDictionaryCompletenessRules.green)) {
        return "green";
    }
    if (matchesRule(indicatorDictionaryCompletenessRules.yellow)) {
        return "yellow";
    }
    return "red";
};

const mapIndicatorDictionaryRow = (
    dataElement: ReturnType<typeof processDataElements>[number],
): IndicatorDictionaryRow => {
    const values = Object.fromEntries(
        indicatorDictionaryHeaders.map((header) => [
            header.id,
            normalizeDictionaryScalar(getDictionaryHeaderValue(dataElement, header)),
        ]),
    ) as Record<string, string>;
    const completenessConfigured = indicatorDictionaryHeaders.filter((header) =>
        hasMeaningfulDictionaryValue(values[header.id]),
    ).length;
    const completenessTotal = indicatorDictionaryHeaders.length;

    return {
        key: dataElement.id,
        id: dataElement.id,
        ...values,
        aggregationType: values.aggregationType,
        code: values.code,
        completenessConfigured,
        completenessRate: `(${completenessConfigured} / ${completenessTotal})`,
        completenessState: getDictionaryCompletenessState(values),
        completenessTotal,
        disaggregation: values.disaggregation,
        displayName: values.displayName,
        periodType: values.periodType,
        valueType: values.valueType,
        vote: values.vote,
    };
};

const formatIndicatorGroupType = (value: unknown) => {
    switch (String(value ?? "").trim()) {
        case "ndpGoal":
            return "Goal";
        case "strategicObjective":
            return "Strategic Objective";
        case "outcome":
            return "Outcome";
        case "intermediateOutcome":
            return "Intermediate Outcome";
        case "output":
            return "Output";
        case "action":
            return "Action";
        default:
            return value;
    }
};

export const indicatorDictionaryQueryOptions = ({
    engine,
    ndpVersion,
    tab = "ndpIndicators",
    searchText,
    page = 1,
    pageSize = 50,
    sortField = "displayName",
    sortOrder = "ascend",
    classificationId,
    fetchAll = false,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ndpVersion: string;
    tab?: IndicatorDictionaryTab;
    searchText?: string;
    page?: number;
    pageSize?: number;
    sortField?: IndicatorDictionarySortField;
    sortOrder?: "ascend" | "descend";
    classificationId?: string;
    fetchAll?: boolean;
}) => {
    return queryOptions({
        queryKey: [
            "indicator-dictionary",
            ndpVersion,
            tab,
            searchText?.trim().toLowerCase() ?? "",
            page,
            pageSize,
            sortField,
            sortOrder,
            classificationId ?? "",
            fetchAll,
        ],
        queryFn: async () => {
            const normalizedSearch = searchText?.trim().toLowerCase() ?? "";
            const params = new URLSearchParams({
                fields: [
                    "id",
                    "name",
                    "displayName",
                    "code",
                    "aggregationType",
                    "valueType",
                    "categoryCombo[id,name,displayName]",
                    "description",
                    "attributeValues[value,attribute[id,name,code]]",
                    "dataElementGroups[id,name,code,groupSets[id,name,code]]",
                    "dataSetElements[dataSet[id,name,periodType,organisationUnits[code,displayName,id,path]]]",
                ].join(","),
                order: `${sortField}:${sortOrder === "descend" ? "desc" : "asc"}`,
                paging: fetchAll ? "false" : "true",
            });

            params.append("filter", `attributeValues.value:eq:${ndpVersion}`);

            if (tab === "classification" && classificationId) {
                params.append("filter", `dataElementGroups.id:eq:${classificationId}`);
            }

            if (normalizedSearch) {
                params.set("query", normalizedSearch);
            }

            if (!fetchAll) {
                params.set("page", String(page));
                params.set("pageSize", String(pageSize));
                params.set("totalPages", "true");
            }

            const response = (await engine.query({
                dataElements: {
                    resource: `dataElements?${params.toString()}`,
                },
            })) as {
                dataElements: {
                    dataElements: DataElement[];
                    pager?: IndicatorDictionaryPager;
                };
            };

            const rows = uniqBy(
                processDataElements(response.dataElements.dataElements ?? []),
                "id",
            ).map(mapIndicatorDictionaryRow);
            const total = fetchAll
                ? rows.length
                : response.dataElements.pager?.total ?? rows.length;
            return {
                pager: {
                    page: fetchAll ? 1 : response.dataElements.pager?.page ?? page,
                    pageCount: fetchAll
                        ? Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
                        : Math.max(
                              1,
                              response.dataElements.pager?.pageCount ??
                                  Math.ceil(total / Math.max(pageSize, 1)),
                          ),
                    pageSize: fetchAll
                        ? total || pageSize
                        : response.dataElements.pager?.pageSize ?? pageSize,
                    total,
                } satisfies IndicatorDictionaryPager,
                rows,
            };
        },
    });
};

export const indicatorDictionaryClassificationQueryOptions = ({
    engine,
    groupSetId,
}: {
    engine: ReturnType<typeof useDataEngine>;
    groupSetId?: string;
}) => {
    return queryOptions({
        queryKey: ["indicator-dictionary-classifications", groupSetId ?? ""],
        queryFn: async () => {
            if (!groupSetId) {
                return [];
            }
            const response = (await engine.query({
                dataElementGroupSet: {
                    resource: `dataElementGroupSets/${groupSetId}`,
                    params: {
                        fields: "id,name,dataElementGroups[id,name,code]",
                    },
                },
            })) as {
                dataElementGroupSet: {
                    dataElementGroups?: IndicatorClassificationOption[];
                };
            };
            return response.dataElementGroupSet.dataElementGroups ?? [];
        },
    });
};

export const reportingRatesDatasetOptionsQueryOptions = (
    ndpVersion: string,
) => {
    return queryOptions({
        queryKey: ["reporting-rates-datasets", ndpVersion],
        queryFn: async () => {
            const dataElements = await db.dataElements
                .where("fsIKncW1Eps")
                .equals(ndpVersion)
                .toArray();

            const datasetMap = new Map<string, ReportingRatesDatasetOption>();
            const datasetOrgUnits = new Map<string, Set<string>>();

            uniqBy(dataElements, "id").forEach((dataElement) => {
                const assignments = Array.isArray(dataElement.datasetAssignments)
                    ? dataElement.datasetAssignments
                    : [];
                assignments.forEach((assignment) => {
                    const dataSetId = String(assignment.dataSetId ?? "").trim();
                    if (!dataSetId) {
                        return;
                    }
                    const orgUnits = datasetOrgUnits.get(dataSetId) ?? new Set<string>();
                    orgUnits.add(String(assignment.orgUnitId ?? ""));
                    datasetOrgUnits.set(dataSetId, orgUnits);
                    const existing = datasetMap.get(dataSetId);
                    datasetMap.set(dataSetId, {
                        value: dataSetId,
                        label: String(
                            assignment.dataSetName ?? existing?.label ?? dataSetId,
                        ),
                        periodType: String(
                            assignment.periodType ?? existing?.periodType ?? "",
                        ),
                        assignedOrgUnitCount: orgUnits.size,
                    });
                });
            });

            return orderBy(
                Array.from(datasetMap.values()),
                ["label"],
                ["asc"],
            );
        },
    });
};

export const reportingRatesQueryOptions = ({
    engine,
    ndpVersion,
    dataSetId,
    orgUnitId,
    quarter,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ndpVersion: string;
    dataSetId?: string;
    orgUnitId?: string;
    quarter?: ReportingRatesQuarterOption;
}) => {
    return queryOptions({
        queryKey: [
            "reporting-rates",
            ndpVersion,
            dataSetId ?? "",
            orgUnitId ?? "",
            quarter?.value ?? "",
        ],
        queryFn: async () => {
            if (!dataSetId || !orgUnitId || !quarter) {
                return [];
            }

            const dataElements = await db.dataElements
                .where("fsIKncW1Eps")
                .equals(ndpVersion)
                .toArray();
            const rootResponse = (await engine.query({
                organisationUnit: {
                    resource: `organisationUnits/${orgUnitId}`,
                    params: {
                        fields: "id,name,displayName,path",
                    },
                },
            })) as {
                organisationUnit: {
                    id: string;
                    name: string;
                    displayName?: string;
                    path?: string;
                };
            };
            const rootPath = rootResponse.organisationUnit.path ?? `/${orgUnitId}`;

            const expectedOrgUnits = new Map<
                string,
                { orgUnitId: string; orgUnitName: string; path: string }
            >();
            let dataSetName = dataSetId;

            uniqBy(dataElements, "id").forEach((dataElement) => {
                const assignments = Array.isArray(dataElement.datasetAssignments)
                    ? dataElement.datasetAssignments
                    : [];
                assignments.forEach((assignment) => {
                    if (String(assignment.dataSetId ?? "") !== dataSetId) {
                        return;
                    }
                    dataSetName = String(
                        assignment.dataSetName ?? dataSetName ?? dataSetId,
                    );
                    const path = String(assignment.path ?? "");
                    const assignmentOrgUnitId = String(assignment.orgUnitId ?? "");
                    if (
                        !assignmentOrgUnitId ||
                        !path ||
                        !path.startsWith(rootPath)
                    ) {
                        return;
                    }
                    expectedOrgUnits.set(assignmentOrgUnitId, {
                        orgUnitId: assignmentOrgUnitId,
                        orgUnitName: String(
                            assignment.orgUnitName ??
                                assignment.orgUnitCode ??
                                assignmentOrgUnitId,
                        ),
                        path,
                    });
                });
            });

            const registrationsResponse = (await engine.query({
                completeDataSetRegistrations: {
                    resource: "completeDataSetRegistrations",
                    params: {
                        dataSet: dataSetId,
                        period: quarter.value,
                        orgUnit: orgUnitId,
                        children: true,
                        paging: false,
                        fields: "organisationUnit[id],dataSet[id],period",
                    },
                },
            })) as {
                completeDataSetRegistrations: {
                    completeDataSetRegistrations?: Array<{
                        organisationUnit?:
                            | {
                                  id?: string;
                              }
                            | string;
                    }>;
                };
            };

            const completedCounts = new Map<string, number>();
            (
                registrationsResponse.completeDataSetRegistrations
                    .completeDataSetRegistrations ?? []
            ).forEach((registration) => {
                const organisationUnit =
                    typeof registration.organisationUnit === "string"
                        ? registration.organisationUnit
                        : registration.organisationUnit?.id;
                const registrationOrgUnitId = String(organisationUnit ?? "");
                if (!expectedOrgUnits.has(registrationOrgUnitId)) {
                    return;
                }
                completedCounts.set(
                    registrationOrgUnitId,
                    (completedCounts.get(registrationOrgUnitId) ?? 0) + 1,
                );
            });

            return orderBy(
                Array.from(expectedOrgUnits.values()).map((orgUnit) => {
                    const completedReports =
                        completedCounts.get(orgUnit.orgUnitId) ?? 0;
                    const expectedReports = 1;
                    const missingReports = Math.max(
                        expectedReports - completedReports,
                        0,
                    );
                    const reportingRate =
                        expectedReports === 0
                            ? 0
                            : (completedReports / expectedReports) * 100;
                    return {
                        key: `${dataSetId}-${quarter.value}-${orgUnit.orgUnitId}`,
                        orgUnitId: orgUnit.orgUnitId,
                        orgUnitName: orgUnit.orgUnitName,
                        dataSetId,
                        dataSetName,
                        quarterLabel: quarter.label,
                        period: quarter.value,
                        expectedReports,
                        completedReports,
                        missingReports,
                        reportingRate,
                        reportingRateDisplay: reportingRate.toFixed(2),
                        performanceBand:
                            reportingRate >= 100
                                ? "green"
                                : reportingRate >= 75
                                  ? "yellow"
                                  : "red",
                    } satisfies ReportingRatesRow;
                }),
                ["orgUnitName"],
                ["asc"],
            );
        },
    });
};

export const reportingRateSummariesQueryOptions = ({
    engine,
    ndpVersion,
    programme,
    orgUnitId,
    defaultOrgUnitId,
    financialYear,
    quarters,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ndpVersion: string;
    programme?: string;
    orgUnitId?: string;
    defaultOrgUnitId?: string;
    financialYear?: string;
    quarters: Array<"Q1" | "Q2" | "Q3" | "Q4">;
}) => {
    return queryOptions({
        queryKey: [
            "reporting-rate-summaries-v2",
            ndpVersion,
            programme ?? "",
            orgUnitId ?? "",
            defaultOrgUnitId ?? "",
            financialYear ?? "",
            quarters.join(","),
        ],
        enabled: Boolean(ndpVersion && financialYear && quarters.length > 0),
        queryFn: async (): Promise<ReportingRateSummaryRow[]> => {
            if (!financialYear || quarters.length === 0) {
                return [];
            }

            const quarterKeys = ["Q1", "Q2", "Q3", "Q4"] as const;
            type QuarterKey = (typeof quarterKeys)[number];

            const dataElements = uniqBy(
                await db.dataElements
                    .where("fsIKncW1Eps")
                    .equals(ndpVersion)
                    .toArray(),
                "id",
            );

            const eligibleDataElements = dataElements.filter((de) => {
                const programmeCode = getReportingRateProgrammeCode(de);

                if (programme && programmeCode !== programme) {
                    return false;
                }

                return normalizeReportingRateIndicatorGroupType(de) !== undefined;
            });

            const scopeRootOrgUnitId =
                orgUnitId || defaultOrgUnitId || getScopeRootOrgUnitIdFromDataElements(eligibleDataElements);

            if (!scopeRootOrgUnitId) {
                return [];
            }

            const datasetTypeLookup = buildReportingRateDatasetTypeLookup(
                eligibleDataElements,
                scopeRootOrgUnitId,
                ndpVersion,
            );
            const assignmentsByOrgUnit = buildReportingRateAssignmentsByOrgUnit(
                eligibleDataElements,
                scopeRootOrgUnitId,
                ndpVersion,
                datasetTypeLookup,
            );

            if (assignmentsByOrgUnit.size === 0) {
                return [];
            }

            const quarterPeriods = buildReportingRateQuarterPeriods(
                financialYear,
                quarters,
            );

            const requestDefinitions = quarterPeriods.flatMap((period) => {
                const dataSetIds = new Set<string>();
                assignmentsByOrgUnit.forEach((assignment) => {
                    assignment.quarterAssignments[period.key].forEach((dataSetId) =>
                        dataSetIds.add(dataSetId),
                    );
                });
                return Array.from(dataSetIds).map((dataSetId) => ({
                    dataSetId,
                    periodKey: period.key,
                    period: period.period,
                }));
            });

            const settledResponses = await Promise.allSettled(
                requestDefinitions.map((request) =>
                    engine.query({
                        completeDataSetRegistrations: {
                            resource: "completeDataSetRegistrations",
                            params: {
                                dataSet: request.dataSetId,
                                period: request.period,
                                orgUnit: scopeRootOrgUnitId,
                                children: true,
                                paging: false,
                                fields: "organisationUnit[id],dataSet[id],period",
                            },
                        },
                    }),
                ),
            );

            const completedByOrgUnit = new Map<
                string,
                Record<QuarterKey, Set<string>>
            >();

            settledResponses.forEach((result, index) => {
                if (result.status !== "fulfilled") {
                    return;
                }

                const request = requestDefinitions[index];
                const response = result.value as {
                    completeDataSetRegistrations: {
                        completeDataSetRegistrations?: Array<{
                            organisationUnit?: { id?: string } | string;
                        }>;
                    };
                };

                (
                    response.completeDataSetRegistrations
                        .completeDataSetRegistrations ?? []
                ).forEach((registration) => {
                    const organisationUnit =
                        typeof registration.organisationUnit === "string"
                            ? registration.organisationUnit
                            : registration.organisationUnit?.id;
                    const registrationOrgUnitId = String(organisationUnit ?? "");
                    const assignment = assignmentsByOrgUnit.get(registrationOrgUnitId);
                    if (
                        !assignment ||
                        !assignment.quarterAssignments[request.periodKey].has(
                            request.dataSetId,
                        )
                    ) {
                        return;
                    }

                    const periods =
                        completedByOrgUnit.get(registrationOrgUnitId) ??
                        createReportingRateQuarterAssignmentMap();
                    periods[request.periodKey].add(request.dataSetId);
                    completedByOrgUnit.set(registrationOrgUnitId, periods);
                });
            });

            return orderBy(
                Array.from(assignmentsByOrgUnit.entries())
                    .map(([currentOrgUnitId, assignment]) => {
                        const completedPeriods =
                            completedByOrgUnit.get(currentOrgUnitId) ??
                            createReportingRateQuarterAssignmentMap();
                        const quarterSummaries = Object.fromEntries(
                            quarterKeys.map((quarter) => {
                                const denominator =
                                    assignment.quarterAssignments[quarter].size;
                                const numerator = completedPeriods[quarter].size;
                                return [
                                    quarter,
                                    createReportingRatePeriodSummary(
                                        numerator,
                                        denominator,
                                    ),
                                ];
                            }),
                        ) as Record<QuarterKey, ReportingRateSummaryPeriodSummary>;

                        const assignedDataSets = orderBy(
                            Array.from(assignment.dataSets.values()).map((dataSet) => ({
                                key: `${currentOrgUnitId}-${dataSet.dataSetId}`,
                                dataSetId: dataSet.dataSetId,
                                dataSetName: dataSet.dataSetName,
                                periodType: dataSet.periodType,
                                indicatorGroupType: dataSet.indicatorGroupType,
                                indicatorGroupTypeLabel:
                                    formatReportingRateIndicatorGroupType(
                                        dataSet.indicatorGroupType,
                                    ),
                                reported: quarters.some((quarter) =>
                                    completedPeriods[quarter].has(dataSet.dataSetId),
                                ),
                            })),
                            ["dataSetName"],
                            ["asc"],
                        );

                        return {
                            key: currentOrgUnitId,
                            orgUnitId: currentOrgUnitId,
                            orgUnitName: assignment.orgUnitName,
                            assignedDataSetCount:
                                assignment.quarterCompatibleDataSetIds.size,
                            assignedDataSets,
                            periodSummaries: {
                                ...quarterSummaries,
                                financialYear: createReportingRateFinancialYearSummary(
                                    quarters.map(
                                        (quarter) => quarterSummaries[quarter],
                                    ),
                                ),
                            },
                        } satisfies ReportingRateSummaryRow;
                    })
                    .filter(
                        (row) =>
                            quarters.some(
                                (quarter) =>
                                    row.periodSummaries[quarter].denominator > 0,
                            ) && row.assignedDataSetCount > 0,
                    ),
                ["orgUnitName"],
                ["asc"],
            );
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

function buildReportingRateQuarterPeriods(
    financialYear: string,
    quarters: Array<"Q1" | "Q2" | "Q3" | "Q4">,
) {
    const startYear = Number(financialYear.slice(0, 4));
    const quarterPeriods = {
        Q1: `${startYear}Q3`,
        Q2: `${startYear}Q4`,
        Q3: `${startYear + 1}Q1`,
        Q4: `${startYear + 1}Q2`,
    } as const;

    return orderReportingRateQuarterKeys(quarters).map((quarter) => ({
        key: quarter,
        period: quarterPeriods[quarter],
    }));
}

function createReportingRateQuarterAssignmentMap() {
    return {
        Q1: new Set<string>(),
        Q2: new Set<string>(),
        Q3: new Set<string>(),
        Q4: new Set<string>(),
    };
}

function createReportingRatePeriodSummary(
    numerator: number,
    denominator: number,
): ReportingRateSummaryPeriodSummary {
    const rate = denominator === 0 ? 0 : (numerator / denominator) * 100;
    const roundedRate = Math.round(rate);

    return {
        numerator,
        denominator,
        rate,
        display:
            denominator === 0
                ? "-"
                : `${roundedRate}% (${numerator}/${denominator})`,
        performanceBand:
            rate >= 100 ? "green" : rate >= 75 ? "yellow" : "red",
    };
}

function createReportingRateFinancialYearSummary(
    quarterSummaries: ReportingRateSummaryPeriodSummary[],
): ReportingRateSummaryPeriodSummary {
    if (quarterSummaries.length === 0) {
        return createReportingRatePeriodSummary(0, 0);
    }

    const averageRate =
        quarterSummaries.reduce((sum, summary) => sum + summary.rate, 0) /
        quarterSummaries.length;
    const roundedAverageRate = Math.round(averageRate);

    return {
        numerator: 0,
        denominator: quarterSummaries.length,
        rate: averageRate,
        display: `${roundedAverageRate}%`,
        performanceBand:
            averageRate >= 100 ? "green" : averageRate >= 75 ? "yellow" : "red",
    };
}

function orderReportingRateQuarterKeys(
    quarters: Array<"Q1" | "Q2" | "Q3" | "Q4">,
) {
    const ordered = ["Q1", "Q2", "Q3", "Q4"] as const;
    return ordered.filter((quarter) => quarters.includes(quarter));
}

function normalizeReportingRateIndicatorGroupType(
    indicator: Record<string, unknown>,
) {
    const candidate = String(
        indicator.BmUMiIbD5XY ??
            indicator.indicatorGroupType ??
            indicator["Indicator Group Type"] ??
            "",
    ).trim();
    return candidate || undefined;
}

function getReportingRateProgrammeCode(dataElement: Record<string, unknown>) {
    return String(
        dataElement.ndpProgramme ??
            dataElement["NDP Programme List"] ??
            dataElement["UBWSASWdyfi"] ??
            dataElement["Programme"] ??
            "",
    ).trim();
}

function formatReportingRateIndicatorGroupType(value: string) {
    if (value === "ndpGoal") {
        return "Goal";
    }

    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function matchesReportingRateAssignmentNdpVersion(
    assignment: Record<string, unknown>,
    ndpVersion: string | undefined,
) {
    if (!ndpVersion) {
        return true;
    }

    const dataSetName = String(assignment.dataSetName ?? "").trim().toUpperCase();
    if (!dataSetName) {
        return true;
    }

    const matchedVersion =
        dataSetName.match(/\bNDP(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b/i)?.[0];
    if (!matchedVersion) {
        return true;
    }

    return matchedVersion.toUpperCase() === ndpVersion.toUpperCase();
}

function getScopeRootOrgUnitIdFromDataElements(
    dataElements: Array<Record<string, unknown>>,
) {
    for (const dataElement of dataElements) {
        const assignments = Array.isArray(dataElement.datasetAssignments)
            ? dataElement.datasetAssignments
            : [];
        for (const assignment of assignments) {
            const path = String(assignment.path ?? "");
            const pathParts = path.split("/").filter(Boolean);
            if (pathParts.length > 0) {
                return pathParts[0];
            }
        }
    }
    return undefined;
}

function buildReportingRateDatasetTypeLookup(
    dataElements: Array<Record<string, unknown>>,
    scopeRootOrgUnitId: string | undefined,
    ndpVersion: string,
) {
    const countsByAssignment = new Map<string, Map<string, number>>();

    dataElements.forEach((dataElement) => {
        const indicatorGroupType =
            normalizeReportingRateIndicatorGroupType(dataElement);
        if (!indicatorGroupType) {
            return;
        }

        const assignments = Array.isArray(dataElement.datasetAssignments)
            ? dataElement.datasetAssignments
            : [];

        assignments.forEach((assignment) => {
            const path = String(assignment.path ?? "");
            const orgUnitId = String(assignment.orgUnitId ?? "");
            const dataSetId = String(assignment.dataSetId ?? "");

            if (!orgUnitId || !dataSetId) {
                return;
            }
            if (
                scopeRootOrgUnitId &&
                !path.split("/").filter(Boolean).includes(scopeRootOrgUnitId)
            ) {
                return;
            }
            if (!matchesReportingRateAssignmentNdpVersion(assignment, ndpVersion)) {
                return;
            }

            const key = `${orgUnitId}:${dataSetId}`;
            const counts = countsByAssignment.get(key) ?? new Map<string, number>();
            counts.set(
                indicatorGroupType,
                (counts.get(indicatorGroupType) ?? 0) + 1,
            );
            countsByAssignment.set(key, counts);
        });
    });

    const canonicalTypes = new Map<string, string>();
    countsByAssignment.forEach((counts, key) => {
        const canonical = Array.from(counts.entries()).sort((a, b) => {
            if (b[1] !== a[1]) {
                return b[1] - a[1];
            }
            return a[0].localeCompare(b[0]);
        })[0]?.[0];
        if (canonical) {
            canonicalTypes.set(key, canonical);
        }
    });

    return canonicalTypes;
}

function buildReportingRateAssignmentsByOrgUnit(
    dataElements: Array<Record<string, unknown>>,
    scopeRootOrgUnitId: string | undefined,
    ndpVersion: string,
    datasetTypeLookup: Map<string, string>,
) {
    const quarterKeys = ["Q1", "Q2", "Q3", "Q4"] as const;
    const assignmentsByOrgUnit = new Map<
        string,
        {
            orgUnitName: string;
            allAssignedDataSetIds: Set<string>;
            quarterAssignments: Record<(typeof quarterKeys)[number], Set<string>>;
            dataSets: Map<
                string,
                {
                    dataSetId: string;
                    dataSetName: string;
                    periodType: string;
                    indicatorGroupType: string;
                }
            >;
            quarterCompatibleDataSetIds: Set<string>;
        }
    >();

    dataElements.forEach((dataElement) => {
        const assignments = Array.isArray(dataElement.datasetAssignments)
            ? dataElement.datasetAssignments
            : [];

        assignments.forEach((assignment) => {
            const path = String(assignment.path ?? "");
            const currentOrgUnitId = String(assignment.orgUnitId ?? "");
            const dataSetId = String(assignment.dataSetId ?? "");
            const periodType = String(assignment.periodType ?? "");

            if (!currentOrgUnitId || !dataSetId) {
                return;
            }
            if (
                scopeRootOrgUnitId &&
                !path.split("/").filter(Boolean).includes(scopeRootOrgUnitId)
            ) {
                return;
            }
            if (!matchesReportingRateAssignmentNdpVersion(assignment, ndpVersion)) {
                return;
            }

            const indicatorGroupType = datasetTypeLookup.get(
                `${currentOrgUnitId}:${dataSetId}`,
            );
            if (!indicatorGroupType) {
                return;
            }

            const current = assignmentsByOrgUnit.get(currentOrgUnitId) ?? {
                orgUnitName: String(
                    assignment.orgUnitName ??
                        assignment.orgUnitCode ??
                        currentOrgUnitId,
                ),
                allAssignedDataSetIds: new Set<string>(),
                quarterAssignments: createReportingRateQuarterAssignmentMap(),
                dataSets: new Map(),
                quarterCompatibleDataSetIds: new Set<string>(),
            };

            current.allAssignedDataSetIds.add(dataSetId);
            if (periodType.trim().toLowerCase().includes("quarter")) {
                current.quarterCompatibleDataSetIds.add(dataSetId);
                quarterKeys.forEach((quarter) => {
                    current.quarterAssignments[quarter].add(dataSetId);
                });
            }

            if (!current.dataSets.has(dataSetId)) {
                current.dataSets.set(dataSetId, {
                    dataSetId,
                    dataSetName: String(assignment.dataSetName ?? dataSetId),
                    periodType,
                    indicatorGroupType,
                });
            }

            assignmentsByOrgUnit.set(currentOrgUnitId, current);
        });
    });

    return assignmentsByOrgUnit;
}

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
