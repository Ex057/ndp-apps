import { Flex, Typography } from "antd";
import { TableProps } from "antd/es/table";
import React from "react";
import {
    ICategory,
    ICategoryCombo,
    ICategoryOptionCombo,
    DataEntryLocks,
    IDataElement,
    IDataSet,
} from "../types";
import TableCell from "./TableCell";
import CommentCell from "./comment-cell";
import { isDataEntryColumnLocked } from "../data-entry-locks";

function replaceQNumber(str: string): string {
    const map: Record<string, string> = {
        "1": "3",
        "2": "4",
        "3": "1",
        "4": "2",
    };

    return str.replace(/Q(\d)$/, (_, n) => ` - Q${map[n] ?? n}`);
}

function equivalentNumberFromString(str: string) {
    const map: Record<string, string> = {
        "1": "3",
        "2": "4",
        "3": "1",
        "4": "2",
    };

    const match = str.match(/Q(\d)(?:\/\d+)?$/);
    if (!match) return null;

    return map[match[1]];
}

export function generateGroupedColumns({
    dataSet,
    dataElements,
    pe,
    ou,
    baselineYear,
    targetYear,
    disabled,
    dataEntryLocks,
    now = Date.now(),
}: {
    dataSet: IDataSet;
    dataElements: IDataElement[];
    pe: string;
    ou: string;
    targetYear: string;
    baselineYear: string;
    disabled: boolean;
    dataEntryLocks?: DataEntryLocks;
    now?: number;
}): TableProps<IDataElement>["columns"] {
    const columns: TableProps<IDataElement>["columns"] = [];
    const categoryCombos = new Map<string, ICategoryCombo>();
    dataElements.forEach((de) => {
        if (de.categoryCombo && !categoryCombos.has(de.categoryCombo.id)) {
            categoryCombos.set(de.categoryCombo.id, de.categoryCombo);
        }
    });

    categoryCombos.forEach((categoryCombo) => {
        if (categoryCombo.categories.length > 1) {
            const groupedColumn = createGroupedColumn(categoryCombo);
            columns?.push(groupedColumn);
        } else {
            categoryCombo.categoryOptionCombos?.forEach((coc) => {
                const indexToLock =
                    dataSet.categoryCombo.categoryOptionCombos.length === 3
                        ? 2
                        : 1;
                const isColumnDisabled = (name: string, index: number) =>
                    disabled ||
                    isDataEntryColumnLocked({
                        locks: dataEntryLocks,
                        dataSet,
                        categoryOptionName: name,
                        reportingPeriod: pe,
                        organisationUnitId: ou,
                        fallbackLocked: index < indexToLock,
                        now,
                    });
                dataSet.categoryCombo.categories
                    .flatMap((cat) => cat.categoryOptions)
                    .forEach((dataSetCOC, index, arr) => {
                        const coc1 =
                            dataSet.categoryCombo.categoryOptionCombos.find(
                                (c) =>
                                    c.categoryOptions.some(
                                        (opt) => opt.id === dataSetCOC.id,
                                    ),
                            );
                        let period = pe;
                        let periodText = pe?.includes("Q")
                            ? `${Number(targetYear.slice(0, 4))}/${String(
                                  Number(targetYear.slice(0, 4)) + 1,
                              ).slice(2)} - Q${equivalentNumberFromString(pe)}`
                            : pe;

                        if (
                            (String(dataSetCOC.name)
                                .toLowerCase()
                                .includes("target") ||
                                String(dataSetCOC.name)
                                    .toLowerCase()
                                    .includes("planned") ||
                                String(dataSetCOC.name)
                                    .toLowerCase()
                                    .includes("approved")) &&
                            targetYear
                        ) {
                            period = targetYear;
                            periodText = `${Number(
                                targetYear.slice(0, 4),
                            )}/${String(
                                Number(targetYear.slice(0, 4)) + 1,
                            ).slice(2)}`;
                        } else if (
                            String(dataSetCOC.name)
                                .toLowerCase()
                                .includes("baseline") &&
                            baselineYear
                        ) {
                            period = baselineYear;
                            periodText = `${Number(
                                baselineYear.slice(0, 4),
                            )}/${String(
                                Number(baselineYear.slice(0, 4)) + 1,
                            ).slice(2)}`;
                        }
                        columns?.push({
                            title: (
                                <Flex vertical gap={2}>
                                    <Typography.Text
                                        style={{ color: "#05416eff" }}
                                    >
                                        {`${dataSetCOC.name}`}
                                    </Typography.Text>
                                    <Typography.Text
                                        style={{ color: "#05416eff" }}
                                    >
                                        {periodText}
                                        {indexToLock === 1 ? (
                                            <>
                                                <br />
                                                {`(Ugx Bn)`}
                                            </>
                                        ) : null}
                                    </Typography.Text>
                                </Flex>
                            ),
                            key: `${coc1?.id}_${coc.id}`,
                            align: "center",
                            width: 150,
                            render: (_, record) => (
                                <TableCell
                                    dataElement={record}
                                    coc={coc.id}
                                    aoc={coc1?.id ?? ""}
                                    co={coc.id}
                                    cc={dataSet.categoryCombo.id}
                                    cp={dataSetCOC.id}
                                    ou={ou}
                                    pe={period}
                                    de={record.id}
                                    disabled={isColumnDisabled(
                                        dataSetCOC.name,
                                        index,
                                    )}
                                />
                            ),
                        });
                        if (index === arr.length - 1) {
                            columns?.push({
                                title: (
                                    <Typography.Text
                                        style={{
                                            color: "#05416eff",
                                        }}
                                    >
                                        Explanation/Attachment
                                    </Typography.Text>
                                ),
                                key: "explanation",
                                width: 230,
                                render: (_, record) => (
                                    <CommentCell
                                        coc={coc.id}
                                        aoc={coc1?.id ?? ""}
                                        co={coc.id}
                                        cc={dataSet.categoryCombo.id}
                                        cp={dataSetCOC.id}
                                        ou={ou}
                                        pe={period}
                                        de={record.id}
                                        dataSet={dataSet}
                                        targetYear={targetYear}
                                        baselineYear={baselineYear}
                                        disabled={disabled}
                                        isCategoryOptionDisabled={
                                            isColumnDisabled
                                        }
                                    />
                                ),
                            });
                        }
                    });
            });
        }
    });

    return columns;
}

export function createGroupedColumn(
    categoryCombo: ICategoryCombo,
): NonNullable<TableProps<IDataElement>["columns"]>[number] {
    const firstCategory = categoryCombo.categories[0];
    const groupedCOCs = new Map<string, ICategoryOptionCombo[]>();

    categoryCombo.categoryOptionCombos?.forEach((coc) => {
        const firstCategoryOption = coc.categoryOptions.find((opt) =>
            firstCategory.categoryOptions.some(
                (catOpt) => catOpt.id === opt.id,
            ),
        );

        if (firstCategoryOption) {
            if (!groupedCOCs.has(firstCategoryOption.id)) {
                groupedCOCs.set(firstCategoryOption.id, []);
            }
            groupedCOCs.get(firstCategoryOption.id)!.push(coc);
        }
    });
    const children: TableProps<IDataElement>["columns"] = [];
    groupedCOCs.forEach((cocs, categoryOptionId) => {
        const categoryOption = firstCategory.categoryOptions.find(
            (opt) => opt.id === categoryOptionId,
        );

        if (cocs.length === 1) {
            children?.push({
                title: categoryOption?.name || "Unknown",
                dataIndex: `${categoryCombo.id}_${cocs[0].id}`,
                key: `${categoryCombo.id}_${cocs[0].id}`,
                width: 120,
            });
        } else {
            const subChildren: TableProps<IDataElement>["columns"] = cocs.map(
                (coc) => ({
                    title: getSubColumnTitle(
                        coc,
                        categoryCombo.categories.slice(1),
                    ),
                    dataIndex: `${categoryCombo.id}_${coc.id}`,
                    key: `${categoryCombo.id}_${coc.id}`,
                    width: 120,
                }),
            );

            children?.push({
                title: categoryOption?.name || "Unknown",
                children: subChildren,
            });
        }
    });

    return {
        title: categoryCombo.name,
        children: children,
    };
}
export function getSubColumnTitle(
    coc: ICategoryOptionCombo,
    remainingCategories: ICategory[],
): string {
    const relevantOptions = coc.categoryOptions.filter((opt) =>
        remainingCategories.some((cat) =>
            cat.categoryOptions.some((catOpt) => catOpt.id === opt.id),
        ),
    );
    return relevantOptions.map((opt) => opt.name).join(" × ");
}
