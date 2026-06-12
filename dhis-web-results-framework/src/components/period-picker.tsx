import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { generateFixedPeriods, periodTypes } from "@dhis2/multi-calendar-dates";
import { Button, Flex, Select } from "antd";
import React, { useMemo, useState } from "react";

type PeriodType = (typeof periodTypes)[number];
export default function PeriodPicker({
    period,
    onChange,
    startingYear,
    multiple = false,
    periodType = "FYJUL",
}: {
    period: string | string[] | undefined;
    onChange: (period: string | string[] | undefined) => void;
    startingYear: number;
    multiple?: boolean;
    periodType?: PeriodType;
}) {
    const [year, setYear] = useState<number>(startingYear);
    const [current, setCurrent] = useState<string | string[] | undefined>(
        period,
    );

    const availableFixedPeriods = useMemo(() => {
        return generateFixedPeriods({
            year,
            calendar: "iso8601",
            periodType,
            locale: "en",
        }).map(({ name, id }) => ({ label: name, value: id }));
    }, [year]);

    if (multiple) {
        return (
            <Flex gap="8px" align="center">
                <Select
                    mode="multiple"
                    options={availableFixedPeriods.sort()}
                    allowClear
                    onChange={(val) => {
                        setCurrent(val);
                        onChange(val);
                    }}
                    style={{ flex: 1 }}
                    value={current}
                    placeholder="Select baseline"
                />
                <Flex>
                    <Button
                        icon={<LeftOutlined />}
                        onClick={() => setYear((prev) => prev - 1)}
                    />
                    <Button
                        icon={<RightOutlined />}
                        onClick={() => setYear((prev) => prev + 1)}
                    />
                </Flex>
            </Flex>
        );
    }

    return (
        <Flex gap="8px" align="center">
            <Select
                options={availableFixedPeriods.sort()}
                allowClear
                onChange={(val) => {
                    setCurrent(val);
                    onChange(val);
                }}
                style={{ flex: 1 }}
                value={current}
                placeholder="Select baseline"
            />
            <Flex>
                <Button
                    icon={<LeftOutlined />}
                    onClick={() => setYear((prev) => prev - 1)}
                />
                <Button
                    icon={<RightOutlined />}
                    onClick={() => setYear((prev) => prev + 1)}
                />
            </Flex>
        </Flex>
    );
}
