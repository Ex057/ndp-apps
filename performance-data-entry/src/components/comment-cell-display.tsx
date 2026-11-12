import { Input, message } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import React from "react";
import { db } from "../db";
import { useSaveDataValue } from "../query-options";
import { IndexRoute } from "../routes";
import { isEmpty } from "lodash";

export default function CommentCellDisplay({
    coc,
    aoc,
    de,
    ou,
    pe,
    isComment,
    co,
    cc,
    cp,
    disabled,
}: {
    coc: string;
    aoc: string;
    de: string;
    ou: string;
    pe: string;
    co: string;
    cc: string;
    cp: string;
    isComment?: boolean;
    disabled: boolean;
}) {
    const { engine } = IndexRoute.useRouteContext();
    const saveDataValue = useSaveDataValue(true);
    const value = useLiveQuery(async () => {
        return await db.dataValues.get({
            dataElement: de,
            period: pe,
            orgUnit: ou,
            categoryOptionCombo: coc,
            attributeOptionCombo: aoc,
        });
    }, [de, aoc, coc, ou, pe]);

    const [explanation, setExplanation] = React.useState(
        value?.explanation || "",
    );

    React.useEffect(() => {
        setExplanation(value?.explanation || "");
    }, [value?.explanation]);

    const saveComment = async (explanation: string) => {
        if (disabled) return;
        const prev = await db.dataValues.get([de, aoc, coc, ou, pe]);
        if (prev) {
            await db.dataValues.put({
                ...prev,
                explanation,
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
                            explanation,
                            attachment: prev.attachments || [],
                        }),
                    },
                });
                message.success(`Comment saved successfully`);
            } catch (error) {
                await db.dataValues.put(prev);
                message.error(
                    `Failed to save data. Please try again. ${error.message}`,
                );
            }
        }
    };
    if (isComment) {
        return (
            <Input.TextArea
                rows={6}
                onBlur={(e) => saveComment(e.target.value)}
                value={explanation}
                onChange={(e) => setExplanation(() => e.target.value)}
                disabled={disabled || isEmpty(value?.value)}
            />
        );
    }
    return value?.value;
}
