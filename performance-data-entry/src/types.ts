import { generateFixedPeriods, periodTypes } from "@dhis2/multi-calendar-dates";
import { TreeDataNode, UploadFile } from "antd";

import { z } from "zod";
export const search = z.object({
    orgUnit: z.string().optional(),
    pe: z.string().optional(),
    dataSet: z.string().optional(),
    expanded: z.string().optional(),
    baseline: z.string().optional(),
    targetYear: z.string().optional(),
    minPeriod: z.string().optional(),
    maxPeriod: z.string().optional(),
    periodType: z.enum(periodTypes).optional(),
    ndp: z.string().optional(),
});

export type Search = z.infer<typeof search>;
export interface OrgUnit extends TreeDataNode {
    pId?: string;
    value: string;
    id: string;
    title: string;
    children?: OrgUnit[];
}

export type DHIS2OrgUnit = {
    id: string;
    name: string;
    leaf: boolean;
    code?: string;
    parent?: { id: string };
    dataSets: IDataSet[];
};

export type PeriodType = (typeof periodTypes)[number];

export type FixedPeriod = ReturnType<typeof generateFixedPeriods>[number];

export interface Form {
    label: string;
    subtitle: string;
    options: Options;
    categoryCombo: CategoryCombo;
    groups: Group[];
}

export interface Group {
    label: string;
    description: string;
    dataElementCount: number;
    metaData: MetaData;
    fields: Field[];
}

export interface Field {
    label: string;
    dataElement: string;
    categoryOptionCombo: string;
    type: string;
}

export interface MetaData {}

export interface CategoryCombo {
    id: string;
    categories: Category[];
}

export interface Category {
    id: string;
    label: string;
    categoryOptions: CategoryOption[];
}

export interface CategoryOption {
    id: string;
    label: string;
}

export interface Options {
    openPeriodsAfterCoEndDate: number;
    periodType: string;
    openFuturePeriods: number;
    expiryDays: number;
}

export interface DataSetValues {
    dataSet: string;
    completeDate: string | null;
    period: string;
    orgUnit: string;
    dataValues: DataValue[];
}

export interface DataValue {
    dataElement: string;
    period: string;
    orgUnit: string;
    categoryOptionCombo: string;
    attributeOptionCombo: string;
    value: string;
    storedBy?: string;
    created?: string;
    lastUpdated?: string;
    comment?: any;
    followup?: boolean;
    attachment?: FileResource[];
    explanation?: string;
    attachments?: string[];
}

export type DataValues = Array<DataValue & IDataElement & { dataSet: string }>;
export interface IDataSet {
    name: string;
    displayName: string;
    dataSetElements: IDataSetElement[];
    categoryCombo: ICategoryCombo;
    access: IAccess;
    id: string;
    periodType: PeriodType;
    organisationUnits: Array<{ id: string; name: string; code: string }>;
}

export interface IDataSetElement {
    dataElement: IDataElement;
}

export interface IDataElement {
    name: string;
    id: string;
    description: string;
    aggregationType: string;
    formName: string;
    categoryCombo: ICategoryCombo;
    valueType: string;
    optionSetValue: boolean;
    optionSet?: {
        options: Option[];
    };

    attributeValues: IAttributeValue[];
    dataElementGroups: IDataElementGroup[];

    dataSetElements: Array<{ dataSet: IDataSet }>;
}

export interface ICategoryCombo {
    categories: ICategory[];
    categoryOptionCombos: ICategoryOptionCombo[];
    id: string;
    name: string;
}

export interface ICategory {
    name: string;
    id: string;
    categoryOptions: ICategoryOption[];
}
export interface ICategoryOptionCombo {
    name: string;
    id: string;
    categoryOptions: ICategoryOption[];
}

export interface ICategoryOption {
    name: string;
    id: string;
    access: IAccess;
    attributeValues: IAttributeValue[];
}

export interface TableDataRow extends IDataElement {
    key: string;
    dataElement: string;
    [key: string]: any;
}

export type Option = {
    id: string;
    name: string;
    code: string;
    created: string;
};

interface IAttributeValue {
    attribute: IAttribute;
    value: string;
}

interface IAttribute {
    code: string;
    name: string;
    valueType: string;
    id: string;
}

interface IAccess {
    manage: boolean;
    externalize: boolean;
    write: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    data: IData;
}

interface IData {
    write: boolean;
    read: boolean;
}

export interface DataElementDataValue extends IDataElement {
    dataValue: Record<string, string>;
    pe: string;
    ou: string;
    targetYear: string;
    baselineYear: string;
}

export interface CompleteDataSetRegistrations {
    completeDataSetRegistrations: CompleteDataSetRegistration[];
}

export interface CompleteDataSetRegistration {
    period: string;
    dataSet: string;
    organisationUnit: string;
    attributeOptionCombo: string;
    date: string;
    storedBy: string;
    completed: boolean;
}

export interface FileResource {
    name: string;
    created: string;
    lastUpdated: string;
    translations: any[];
    externalAccess: boolean;
    createdBy: {
        id: string;
        code: any;
        name: string;
        displayName: string;
        username: string;
    };
    userGroupAccesses: any[];
    userAccesses: any[];
    favorites: any[];
    lastUpdatedBy: {
        id: string;
        code: any;
        name: string;
        displayName: string;
        username: string;
    };

    contentType: string;
    contentLength: number;
    contentMd5: string;
    domain: string;
    hasMultipleStorageFiles: boolean;
    storageStatus: string;
    displayName: string;
    favorite: boolean;
    id: string;
    attributeValues: any[];
    event: string;
}

export interface IDataElementGroup {
    code: string;
    name: string;
    groupSets: GroupSet[];
    id: string;
    attributeValues: IAttributeValue[];
}

export interface GroupSet {
    code: string;
    name: string;
    id: string;
    attributeValues: IAttributeValue[];
}

export type OptionSet = {
    id: string;
    name: string;
    options: Option[];
};
