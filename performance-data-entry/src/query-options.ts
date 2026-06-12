import { useDataEngine } from "@dhis2/app-runtime";
import { queryOptions, useMutation } from "@tanstack/react-query";
import { UploadProps } from "antd";
import { fromPairs } from "lodash";
import { db } from "./db";
import {
    CompleteDataSetRegistrations,
    DataSetValues,
    DHIS2OrgUnit,
    FileResource,
    IDataElement,
    IDataSet,
    OptionSet,
    Search,
} from "./types";
import { convertToAntdTree } from "./utils";

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
                        fields: "organisationUnits[id],dataSets",
                    },
                },
                configuration: {
                    resource: "dataStore/ndp-configurations",
                    params: {
                        fields: "baseline,financialYears,activeQuarters,activeFinancialYears",
                        paging: false,
                    },
                },
                options: {
                    resource: "optionSets",
                    params: {
                        filter: `id:in:[Az2bwwUIPWn,fALlyU4UYhZ,uV4fZlNvUsw,nZffnMQwoWr,D5J653eYk73,YY3JtOQIccj,xQG5xfRYb50,rcESKgz4zKM,jiBHfTa5VzB,zVYsHjAeHlG,fsIKncW1Eps,xLQd0SrtSF8,MfNa8J3R2Uv]`,
                        fields: "id,name,options[*]",
                    },
                },
                central: {
                    resource: "organisationUnits/ONXWQ2EoOcP",
                    params: { level: 1, fields: "id,name,code", paging: false },
                },
            });
            const {
                orgUnits: { organisationUnits, dataSets },
                configuration,
                options,
            } = response as unknown as {
                orgUnits: {
                    organisationUnits: DHIS2OrgUnit[];
                    dataSets: string[];
                };
                configuration: Array<{
                    key: string;
                    baseline: string;
                    financialYears: string[];
                    activeQuarters: string[];
                    activeFinancialYears: string[];
                }>;
                options: { optionSets: OptionSet[] };
                central: {
                    organisationUnits: Array<
                        Omit<DHIS2OrgUnit, "leaf" | "dataSets" | "parent">
                    >;
                };
            };

            const { xLQd0SrtSF8: ndp4, nZffnMQwoWr: ndp3 } = fromPairs(
                options.optionSets.map((oset) => [oset.id, oset.options]),
            );
            const all: Map<string, string> = new Map(
                options.optionSets
                    .flatMap((oset) => oset.options)
                    .map((o) => [o.code, o.name]),
            );

            const nextQuery = (await engine.query(
                organisationUnits.reduce<Record<string, any>>((acc, unit) => {
                    acc[unit.id] = {
                        resource: `organisationUnits/${unit.id}`,
                        params: {
                            fields: "id,name,leaf,parent,dataSets[id,name,displayName,periodType]",
                            includeDescendants: true,
                            paging: false,
                        },
                    };
                    return acc;
                }, {}),
            )) as unknown as Record<
                string,
                { organisationUnits: DHIS2OrgUnit[] } | DHIS2OrgUnit
            >;
            const allUnits = Object.values(nextQuery).flatMap((res) => {
                if ("organisationUnits" in res) {
                    return res.organisationUnits;
                }
                return res;
            });

            const orgUnitDataSets = Object.fromEntries(
                allUnits.map((unit) => [
                    unit.id,
                    unit.dataSets
                        ? unit.dataSets.map((ds) => ({
                              ...ds,
                              orgUnit: unit.name,
                          }))
                        : [],
                ]),
            );
            return {
                organisationTree: convertToAntdTree(allUnits),
                orgUnitDataSets,
                configuration,
                ndp3,
                ndp4,
                dataSets,
                all,
            };
        },
    });
};

export const dataValuesQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    search: Search,
) => {
    return queryOptions({
        queryKey: [
            "data-values",
            search.orgUnit,
            search.dataSet,
            search.pe,
            search.baseline,
            search.targetYear,
        ],
        queryFn: async () => {
            let query: Record<string, any> = {
                dataSetValues: {
                    resource: "dataValueSets",
                    params: {
                        orgUnit: search.orgUnit,
                        dataSet: search.dataSet,
                        period: search.pe,
                    },
                },
                baselineDataValues: {
                    resource: "dataValueSets",
                    params: {
                        orgUnit: search.orgUnit,
                        dataSet: search.dataSet,
                        period: search.baseline,
                    },
                },
                completeDataSetRegistrations: {
                    resource: "completeDataSetRegistrations",
                    params: {
                        orgUnit: search.orgUnit,
                        dataSet: search.dataSet,
                        attributeOptionCombo: "VHmIifPr01a",
                        period: search.pe,
                    },
                },
            };

            if (search.targetYear && search.targetYear !== search.pe) {
                query = {
                    ...query,
                    targetDataValues: {
                        resource: "dataValueSets",
                        params: {
                            orgUnit: search.orgUnit,
                            dataSet: search.dataSet,
                            period: search.targetYear,
                        },
                    },
                };
            }

            const {
                dataSetValues,
                completeDataSetRegistrations,
                baselineDataValues,
                targetDataValues,
            } = (await engine.query(query)) as unknown as {
                dataSetValues: DataSetValues;
                completeDataSetRegistrations: CompleteDataSetRegistrations;
                baselineDataValues: DataSetValues;
                targetDataValues: DataSetValues;
            };

            const allDataValues: DataSetValues = {
                ...dataSetValues,
                dataValues: [
                    ...(dataSetValues?.dataValues ?? []),
                    ...(targetDataValues?.dataValues ?? []),
                    ...(baselineDataValues?.dataValues ?? []),
                ],
            };

            const expanded = allDataValues.dataValues.map((dv) => {
                let explanation = "";
                let attachments: string[] = [];
                if (dv.comment) {
                    try {
                        const { explanation: e, attachment: a } = JSON.parse(
                            dv.comment,
                        ) as {
                            explanation: string;
                            attachment: string[];
                        };
                        explanation = e ?? "";
                        attachments = a ?? [];
                    } catch (error) {
                        console.error("Failed to parse comment", error);
                    }
                }
                return { ...dv, explanation, attachments };
            });

            const attachments = expanded.flatMap((dv) => dv.attachments);
            const allAttachments = new Map<string, FileResource>();

            for (const a of attachments) {
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
                    })) as unknown as { fileResource: FileResource };

                    allAttachments.set(a, { ...fileResource, event: a });
                } catch (error) {}
            }

            const finalDataValues = expanded.map((dv) => {
                return {
                    ...dv,
                    attachment: dv.attachments.flatMap((att) => {
                        const found = allAttachments.get(att);
                        return found ? found : [];
                    }),
                };
            });

            await db.dataValues.bulkPut(finalDataValues);

            return {
                completeDataSetRegistrations:
                    completeDataSetRegistrations.completeDataSetRegistrations,
                dataValues: finalDataValues,
            };
        },
        enabled:
            !!search.orgUnit &&
            !!search.pe &&
            !!search.dataSet &&
            !!search.baseline &&
            !!search.targetYear,
        refetchOnWindowFocus: false,
    });
};

export const dataSetQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    id: string | undefined,
) => {
    return queryOptions({
        queryKey: ["data-set", id],
        queryFn: async () => {
            const { dataSet } = (await engine.query({
                dataSet: {
                    resource: `dataSets/${id}.json`,
                    params: {
                        fields: "id,name,categoryCombo[id,name,categoryOptionCombos[id,name,categoryOptions[id,name]],categories[id,name,categoryOptions[id,name]]],dataSetElements[dataElement[id,name,formName,valueType,optionSetValue,optionSet,code[options[id,name,code]],categoryCombo[id,name,categoryOptionCombos[id,name,categoryOptions[id,name]],categories[id,name,categoryOptions[id,name]]]]]",
                    },
                },
            })) as unknown as {
                dataSet: IDataSet;
            };

            const groupedDataSetElements = dataSet.dataSetElements.reduce(
                (acc, el) => {
                    const de = el.dataElement;
                    if (!acc[de.categoryCombo.id]) {
                        acc[de.categoryCombo.id] = [];
                    }
                    acc[de.categoryCombo.id].push(de);
                    return acc;
                },
                {} as Record<string, IDataElement[]>,
            );

            return {
                dataSet,
                groupedDataSetElements,
            };
        },
        enabled: !!id,
        refetchOnWindowFocus: false,
    });
};

// Hook for saving data values
export const useSaveDataValue = (isComment: boolean = false) => {
    return useMutation({
        mutationFn: async ({
            engine,
            dataValue,
        }: {
            engine: ReturnType<typeof useDataEngine>;
            dataValue: {
                value?: string;
                de: string;
                pe: string;
                ou: string;
                co: string;
                cc: string;
                cp: string;
                comment?: string;
            };
        }) => {
            let resource = `dataValues?${new URLSearchParams({
                de: dataValue.de,
                pe: dataValue.pe,
                ou: dataValue.ou,
                co: dataValue.co,
                cc: dataValue.cc,
                cp: dataValue.cp,
                value: dataValue.value ?? "",
            }).toString()}`;
            if (isComment && dataValue.comment) {
                resource = `dataValues?${new URLSearchParams({
                    de: dataValue.de,
                    pe: dataValue.pe,
                    ou: dataValue.ou,
                    co: dataValue.co,
                    cc: dataValue.cc,
                    cp: dataValue.cp,
                    comment: dataValue.comment,
                }).toString()}`;
            }
            const response = await engine.mutate({
                type: "create",
                resource,
                data: {},
            });
            return response;
        },
        onSuccess: () => {},
        onError: (error) => {
            console.error("Failed to save data value:", error);
        },
    });
};

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

export const indicatorQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    id: string,
) => {
    return queryOptions({
        queryKey: ["indicator-query-options", id],
        queryFn: async () => {
            const { indicator } = (await engine.query({
                indicator: {
                    resource: `dataElements/${id}`,
                    params: {
                        fields: "id,name,code,description,aggregationType,attributeValues[attribute[id,name,code],value],dataSetElements[dataSet[name,periodType,id,organisationUnits[code,name,displayName,id]]],dataElementGroups[id,name,code,attributeValues[attribute[id,name,code],value],groupSets[id,name,code,attributeValues[attribute[id,code,name],value]]]",
                    },
                },
            })) as unknown as { indicator: IDataElement };
            return {
                ...indicator,
                ...indicator.attributeValues.reduce(
                    (acc, attr) => {
                        acc[attr.attribute.name] = attr.value;
                        acc[attr.attribute.id] = attr.value;
                        return acc;
                    },
                    {} as Record<string, string>,
                ),

                ...indicator.dataElementGroups
                    .flatMap(({ attributeValues, groupSets }) => {
                        return [
                            ...attributeValues,
                            ...groupSets.flatMap((gs) => gs.attributeValues),
                        ];
                    })
                    .reduce(
                        (acc, attr) => {
                            acc[attr.attribute.name] = attr.value;
                            acc[attr.attribute.id] = attr.value;
                            return acc;
                        },
                        {} as Record<string, string>,
                    ),

                ...indicator.dataElementGroups.reduce(
                    (acc, deg) => {
                        acc["dataElementGroupName"] = deg.name;
                        acc["dataElementGroupId"] = deg.id;
                        acc["dataElementGroupCode"] = deg.code;
                        return acc;
                    },
                    {} as Record<string, string>,
                ),
                ...indicator.dataElementGroups
                    .flatMap(({ groupSets }) => groupSets)
                    .reduce(
                        (acc, deg) => {
                            acc["dataElementGroupSetName"] = deg.name;
                            acc["dataElementGroupSetId"] = deg.id;
                            acc["dataElementGroupSetCode"] = deg.code;
                            return acc;
                        },
                        {} as Record<string, string>,
                    ),

                ...indicator.dataSetElements
                    .flatMap(({ dataSet }) => dataSet)
                    .reduce(
                        (acc, ds) => {
                            acc["dataSetName"] = ds.name;
                            acc["dataSetId"] = ds.id;
                            acc["dataSetPeriodType"] = ds.periodType;
                            return acc;
                        },
                        {} as Record<string, string>,
                    ),

                ...indicator.dataSetElements
                    .flatMap(({ dataSet }) => dataSet.organisationUnits)
                    .reduce(
                        (acc, ou) => {
                            acc["dataSetOrganisationUnitName"] = ou.name;
                            acc["dataSetOrganisationUnitCode"] = ou.code;
                            acc["dataSetOrganisationUnitId"] = ou.id;
                            return acc;
                        },
                        {} as Record<string, string>,
                    ),
            };
        },
    });
};
