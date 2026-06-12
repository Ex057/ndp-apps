import { createFixedPeriodFromPeriodId } from "@dhis2/multi-calendar-dates";

import { Select } from "antd";
import React, { useMemo } from "react";
import { RootRoute } from "../routes/__root";
import { PeriodType } from "../types";
import { IndexRoute } from "../routes";

function moveNumbersToEnd(str: string): string {
    const numbers = str.match(/\d+/g) || [];
    const text = str.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
    return `${text} ${numbers.join(" ")}`.trim();
}

export default function PeriodPicker({
    period,
    onChange,
    periodType,
}: {
    period?: string;
    onChange: (period: string | undefined) => void;
    periodType?: PeriodType;
}) {
    const { configuration } = RootRoute.useLoaderData();
    const { ndp } = IndexRoute.useSearch();

    const availableFixedPeriods = useMemo(() => {
        if (periodType === undefined || ndp === undefined) {
            return [];
        }

        const first = configuration.find(({ key }) => key === ndp);

        if (
            periodType === "FYJUL" &&
            first &&
            first.activeFinancialYears.length > 0
        ) {
            return first.activeFinancialYears
                .map((p) => {
                    return createFixedPeriodFromPeriodId({
                        periodId: p,
                        calendar: "iso8601",
                    });
                })
                .map(({ name, id }) => {
                    console.log(name, id);
                    return {
                        label: moveNumbersToEnd(name),
                        value: id,
                    };
                });
        } else if (
            periodType === "QUARTERLY" &&
            first &&
            first.activeQuarters.length > 0
        ) {
            return first.activeQuarters
                .map((p) => {
                    return createFixedPeriodFromPeriodId({
                        periodId: p,
                        calendar: "iso8601",
                    });
                })
                .map(({ name, id }) => {
                    return {
                        label: moveNumbersToEnd(name),
                        value: id,
                    };
                });
        }

        return [];
    }, [periodType, onChange, ndp]);

    return (
        <Select
            options={availableFixedPeriods}
            allowClear
            onChange={(val) => {
                onChange(val);
            }}
            showSearch
            filterOption={(input, option) =>
                String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
            }
            style={{ flex: 1 }}
            value={period}
            placeholder="Select period"
        />
    );

    // return (
    //     <Flex gap="8px">

    //         <Flex>
    //             <Button
    //                 icon={<LeftOutlined />}
    //                 onClick={() => {
    //                     setYear((prev) => prev - 1);
    //                     onChange(undefined);
    //                 }}
    //                 disabled={
    //                     year <= minYear ||
    //                     (periodType === "FYJUL" && defaultPeriods.length > 0)
    //                 }
    //             />
    //             <Button
    //                 icon={<RightOutlined />}
    //                 onClick={() => {
    //                     setYear((prev) => prev + 1);
    //                     onChange(undefined);
    //                 }}
    //                 disabled={
    //                     year > maxYear ||
    //                     (periodType === "FYJUL" && defaultPeriods.length > 0)
    //                 }
    //             />
    //         </Flex>
    //     </Flex>
    // );
}
