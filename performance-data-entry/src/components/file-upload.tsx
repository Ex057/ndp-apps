import { useConfig, useDataEngine } from "@dhis2/app-runtime";
import {
    Button,
    Flex,
    List,
    message,
    Space,
    Tag,
    Typography,
    Upload,
    UploadProps,
} from "antd";
import React from "react";

import {
    CheckCircleOutlined,
    DeleteOutlined,
    FileOutlined,
} from "@ant-design/icons";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useSaveDataValue } from "../query-options";
import { FileResource, ICategoryOption, IDataSet } from "../types";
import { isEmpty } from "lodash";

const { Text } = Typography;
const { Dragger } = Upload;

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export default function FileUpload({
    engine,
    ou,
    record,
    pe,
    targetYear,
    baselineYear,
    dataSet,
    aoc,
    coc,
    de,
    cc,
    cp,
    co,
    disabled,
}: {
    engine: ReturnType<typeof useDataEngine>;
    ou: string;
    record: ICategoryOption;
    pe: string;
    targetYear: string;
    baselineYear: string;
    dataSet: IDataSet;
    aoc: string;
    coc: string;
    de: string;
    co: string;
    cc: string;
    cp: string;
    disabled: boolean;
}) {
    const saveDataValue = useSaveDataValue(true);
    const { baseUrl } = useConfig();
    const coc1 = dataSet.categoryCombo.categoryOptionCombos.find((c) =>
        c.categoryOptions.some((opt) => opt.id === record.id),
    )!;
    let period = pe;
    if (
        coc1.name.includes("Target") ||
        coc1.name.includes("Planned") ||
        coc1.name.includes("Approved")
    ) {
        period = targetYear;
    } else if (coc1.name.includes("Baseline")) {
        period = baselineYear;
    }
    const value = useLiveQuery(async () => {
        return await db.dataValues.get({
            dataElement: de,
            period: period,
            orgUnit: ou,
            categoryOptionCombo: coc,
            attributeOptionCombo: aoc,
        });
    }, [de, aoc, coc, ou, pe]);

    const uploadProps: UploadProps = {
        name: "file",
        multiple: true,
        beforeUpload: async (file) => {
            if (disabled) return Upload.LIST_IGNORE;
            const formData = new FormData();
            formData.append("file", file as File);
            const res = await fetch(`${baseUrl}/api/fileResources`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!res.ok) throw new Error("Upload failed");
            const uploaded = await res.json();
            const fileResourceId = uploaded.response.fileResource.id;
            const response2: any = await engine.mutate({
                resource: "events",
                type: "create",
                data: {
                    program: "j1relEmr69u",
                    programStage: "evywplQ17kH",
                    orgUnit: ou,
                    status: "ACTIVE",
                    eventDate: new Date().toISOString().split("T")[0],
                    dataValues: [
                        {
                            dataElement: "qeGJBGmsr0d",
                            value: fileResourceId,
                        },
                    ],
                },
            });

            const event: string =
                response2?.response?.importSummaries?.[0].reference;
            const { fileResource } = (await engine.query({
                fileResource: {
                    resource: `fileResources/${fileResourceId}`,
                },
            })) as unknown as { fileResource: FileResource };

            const prev = await db.dataValues.get([de, aoc, coc, ou, pe]);

            if (prev) {
                await db.dataValues.put({
                    ...prev,
                    attachment: [
                        ...(prev.attachment || []),
                        { ...fileResource, event },
                    ],
                    attachments: [...(prev.attachments || []), event],
                });
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
                            comment: JSON.stringify({
                                explanation: prev.explanation || "",
                                attachment: [
                                    ...(prev.attachments || []),
                                    response2?.response?.importSummaries?.[0]
                                        .reference,
                                ],
                            }),
                        },
                    });
                    message.success(`${file.name} uploaded successfully`);
                } catch (error) {
                    await db.dataValues.put(prev);
                    message.error(
                        `Failed to save data. Please try again. ${error.message}`,
                    );
                }
            }

            return false;
        },
        showUploadList: false,
        disabled: disabled || isEmpty(value?.value),
    };

    const handleDelete = async (file: FileResource) => {
        if (disabled) return;
        const prev = await db.dataValues.get([de, aoc, coc, ou, pe]);
        if (prev !== undefined) {
            await db.dataValues.put({
                ...prev,
                attachment: prev.attachment?.filter((a) => a.id !== file.id),
                attachments: prev.attachments?.filter((a) => a !== file.event),
            });

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
                        comment: JSON.stringify({
                            explanation: prev.explanation || "",
                            attachment: prev.attachments?.filter(
                                (a) => a !== file.event,
                            ),
                        }),
                    },
                });
                await engine.mutate({
                    resource: `tracker`,
                    type: "create",
                    data: {
                        events: [{ event: file.event }],
                    },
                    params: {
                        importStrategy: "DELETE",
                        async: "false",
                    },
                });

                message.success(`${file.name} file deleted successfully`);
            } catch (error) {
                await db.dataValues.put(prev);
                message.error(
                    `Failed to delete file. Please try again. ${error.message}`,
                );
            }
        }
        message.info("File removed");
    };
    return (
        <Flex vertical gap={10}>
            <Dragger {...uploadProps}>
                <Typography.Text style={{ color: "#05416eff" }}>
                    Click or drag file to this area to upload
                </Typography.Text>
            </Dragger>
            <List
                itemLayout="horizontal"
                size="small"
                dataSource={value?.attachment ?? []}
                renderItem={(file: FileResource) => (
                    <List.Item
                        actions={[
                            <Button
                                key="delete"
                                type="text"
                                danger
                                disabled={disabled}
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete(file)}
                            >
                                Delete
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={
                                <FileOutlined
                                    style={{
                                        color: "#1890ff",
                                    }}
                                />
                            }
                            title={
                                <Space>
                                    <Text strong>{file.name}</Text>
                                    {file.storageStatus === "STORED" && (
                                        <Tag
                                            icon={<CheckCircleOutlined />}
                                            color="success"
                                        >
                                            Completed
                                        </Tag>
                                    )}
                                </Space>
                            }
                            description={
                                <Space split="•">
                                    <Text type="secondary">
                                        {formatFileSize(file.contentLength)}
                                    </Text>
                                    <Text type="secondary">
                                        {file.lastUpdated}
                                    </Text>
                                </Space>
                            }
                        />
                    </List.Item>
                )}
            />
        </Flex>
    );
}
