import { message, Select } from "antd";
import type { SelectProps } from "antd";
import React from "react";

export type VoteOption = {
    id: string;
    name: string;
};

export default function RequiredVoteSelect({
    votes,
    value,
    onChange,
    style,
}: {
    votes: VoteOption[];
    value: string;
    onChange: (value: string) => void;
    style?: SelectProps["style"];
}) {
    return (
        <Select
            options={votes.map(({ name, id }) => ({ label: name, value: id }))}
            style={style}
            value={value}
            onChange={(nextValue) => {
                if (!nextValue) {
                    void message.warning(
                        "Vote is required. Select another vote before clearing the current one.",
                    );
                    return;
                }
                onChange(nextValue);
            }}
            filterOption={(input, option) =>
                String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
            }
            showSearch
            allowClear
        />
    );
}
