import { MinusSquareOutlined, PlusSquareOutlined } from "@ant-design/icons";
import type { CollapseProps, SelectProps } from "antd";
import { Collapse, Flex, Form, Select } from "antd";
import React from "react";
import { OrgUnitSelect } from "./organisation";
import PeriodSelector from "./period-selector";

export default function Filter({
    options,
    data,
    onChange,
}: {
    options: Array<{
        options: SelectProps["options"];
        key: string;
        label: string;
        displayIfEmpty?: boolean;
        defaultValue?: string;
        loading?: boolean;
        disabled?: boolean;
        error?: boolean;
        emptyText?: string;
    }>;
    data: {
        ou?: string | string[];
        pe?: string[];
        keyResultArea?: string;
        objective?: string;
        program?: string;
        goal?: string;
    };
    onChange: (
        val: { [key: string]: string | string[] | undefined },
        next: string | undefined,
    ) => void;
}) {
    const items: CollapseProps["items"] = [
        {
            key: "1",
            label: "Advanced report filters (by FY, by MDALGs)",
            children: (
                <>
                    <OrgUnitSelect
                        value={data.ou}
                        onChange={(ou) => {
                            if (ou && !Array.isArray(ou)) {
                                onChange(
                                    {
                                        ou,
                                    },
                                    undefined,
                                );
                            }
                        }}
                    />
                    <Form.Item
                        label="Period"
                        layout="horizontal"
                        labelCol={{ span: 4 }}
                        wrapperCol={{ span: 20 }}
                        labelAlign="left"
                    >
                        <PeriodSelector
                            onChange={(pe) =>
                                onChange(
                                    {
                                        pe,
                                    },
                                    undefined,
                                )
                            }
                            selectedPeriods={data.pe ?? []}
                        />
                    </Form.Item>
                </>
            ),
        },
    ];
    return (
        <Flex gap={10}>
            <Flex
                vertical
                style={{
                    width: "50%",
                    maxWidth: "50%",
                    backgroundColor: "#d0eBd0",
                    padding: 10,
                    border: "1px solid #a4d2a3",
                    borderRadius: "3px",
                }}
            >
                {options.map((option, index) => {
                    if (option.displayIfEmpty || option.options) {
                        return (
                            <Form.Item
                                label={option.label}
                                layout="horizontal"
                                labelCol={{ span: 6 }}
                                wrapperCol={{ span: 18 }}
                                labelAlign="left"
                                key={option.key}
                                style={{ margin: 0, padding: 5 }}
                            >
                                <Select
                                    options={option.options}
                                    style={{ width: "100%" }}
                                    allowClear
                                    value={data[option.key]}
                                    loading={option.loading}
                                    disabled={option.disabled}
                                    status={option.error ? "error" : undefined}
                                    notFoundContent={
                                        option.loading
                                            ? "Loading..."
                                            : option.emptyText
                                    }
                                    placeholder={`Select ${option.label}`}
                                    filterOption={(input, option) =>
                                        String(option?.label ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase()) ||
                                        String(option?.value ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    showSearch
                                    onChange={(value) => {
                                        onChange(
                                            {
                                                [option.key]:
                                                    value ||
                                                    option.defaultValue,
                                            },
                                            index < options.length - 1
                                                ? options[index + 1].key
                                                : undefined,
                                        );
                                    }}
                                />
                            </Form.Item>
                        );
                    }
                })}
            </Flex>
            <Flex
                vertical
                gap={10}
                style={{
                    width: "50%",
                    maxWidth: "50%",
                    backgroundColor: "#BBD1EE",
                    padding: 10,
                    border: "1px solid #729fcf",
                    borderRadius: "3px",
                }}
            >
                <Collapse
                    bordered={false}
                    expandIcon={({ isActive }) =>
                        isActive ? (
                            <MinusSquareOutlined style={{ fontSize: "24px" }} />
                        ) : (
                            <PlusSquareOutlined style={{ fontSize: "24px" }} />
                        )
                    }
                    items={items}
                    expandIconPosition={"end"}
                />
            </Flex>
        </Flex>
    );
}
