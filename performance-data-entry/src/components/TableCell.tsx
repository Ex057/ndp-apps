import { useDataEngine } from "@dhis2/app-runtime";
import { Input, InputNumber, message, Select, Spin } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import React, { useEffect, useState } from "react";
import { db } from "../db";
import { useSaveDataValue } from "../query-options";
import { IDataElement } from "../types";

export default function TableCell({
    dataElement,
    coc,
    aoc,
    de,
    pe,
    ou,
    cc,
    cp,
    co,
    disabled = true,
}: {
    dataElement: IDataElement;
    coc: string;
    aoc: string;
    co: string;
    cc: string;
    cp: string;
    de: string;
    ou: string;
    pe: string;
    disabled?: boolean;
    comment?: boolean;
}) {
    const engine = useDataEngine();
    const saveDataValue = useSaveDataValue();
    const value = useLiveQuery(async () => {
        return await db.dataValues.get({
            dataElement: de,
            period: pe,
            orgUnit: ou,
            categoryOptionCombo: coc,
            attributeOptionCombo: aoc,
        });
    }, [de, aoc, coc, ou, pe]);
    const [currentValue, setCurrentValue] = useState<string | undefined>(
        value?.value,
    );
    const [isLoading, setIsLoading] = useState(false);
    const handleUpdate = async (value: string | number | null) => {
        if (disabled) return;
        setIsLoading(true);
        const originalValue = await db.dataValues.get([de, aoc, coc, ou, pe]);
        if (originalValue) {
            await db.dataValues.put({
                ...originalValue,
                value: value?.toString() || "",
            });
        } else {
            await db.dataValues.put({
                dataElement: de,
                period: pe,
                orgUnit: ou,
                categoryOptionCombo: coc,
                attributeOptionCombo: aoc,
                value: value?.toString() || "",
            });
        }
        const stringValue = value?.toString() || "";
        try {
            await saveDataValue.mutateAsync({
                engine,
                dataValue: {
                    de,
                    pe,
                    ou,
                    co,
                    cc,
                    cp,
                    value: stringValue,
                },
            });
            message.success("Data saved successfully", 2);
        } catch (error) {
            message.error(
                `Failed to save data. Please try again. ${error.message}`,
                4,
            );
            if (originalValue) {
                await db.dataValues.put(originalValue);
            } else {
                await db.dataValues.delete([de, aoc, coc, ou, pe]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setCurrentValue(value?.value);
    }, [value?.value]);

    if (
        dataElement.valueType.toLowerCase().includes("number") ||
        dataElement.valueType.toLowerCase().includes("integer") ||
        dataElement.valueType.toLowerCase().includes("unit")
    ) {
        return (
            <Spin spinning={isLoading} size="small">
                <InputNumber
                    style={{
                        width: "100%",
												textAlign:"center"
                    }}
                    value={currentValue}
                    onChange={(value) => {
                        setCurrentValue(value || undefined);
                    }}
                    onBlur={(e) => handleUpdate(e.target.value)}
                    disabled={isLoading || disabled}
										className=""
										
                />
            </Spin>
        );
    }

    if (
        dataElement.optionSetValue &&
        dataElement.optionSet &&
        dataElement.optionSet.options.length > 0
    ) {
        return (
            <Select
                style={{
                    width: "100%",
                }}
                value={currentValue}
                onChange={(value) => {
                    setCurrentValue(value || undefined);
                    handleUpdate(value);
                }}
                disabled={isLoading || disabled}
                options={dataElement.optionSet.options.map((opt) => ({
                    label: opt.name,
                    value: opt.code,
                }))}
            />
        );
    }

    return (
        <Spin spinning={isLoading} size="small">
            <Input
                style={{
                    width: "100%",
                    textAlign: "center",
                }}
                value={currentValue}
                onChange={(e) => {
                    setCurrentValue(e.target.value);
                }}
                onBlur={(e) => handleUpdate(e.target.value)}
                // onFocus={() => setIsEditing(true)}
                disabled={isLoading || disabled}
            />
        </Spin>
    );
}
