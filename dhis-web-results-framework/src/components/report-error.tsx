import { useConfig } from "@dhis2/app-runtime";
import { Alert, Button, Collapse, Flex, Typography } from "antd";
import React from "react";
import { getSafeLoginUrl } from "../session/session-utils";

export default function ReportError({ error }: { error: unknown }) {
    const { baseUrl } = useConfig();
    const technicalMessage =
        error instanceof Error ? error.stack ?? error.message : String(error);
    const mayBeAuthentication = /401|unauthori[sz]ed|network|fetch/i.test(
        technicalMessage,
    );

    return (
        <Flex vertical gap={16} style={{ padding: 24, maxWidth: 760 }}>
            <Alert
                type="error"
                showIcon
                message="The report could not be loaded"
                description={
                    mayBeAuthentication
                        ? "Your session may have expired, or the server could not be reached. Check your connection, then reload or sign in again."
                        : "Reload the report to try again. If the problem continues, share the technical details with support."
                }
            />
            <Flex gap={8} wrap>
                <Button type="primary" onClick={() => window.location.reload()}>
                    Reload report
                </Button>
                {mayBeAuthentication && (
                    <Button
                        onClick={() =>
                            window.location.assign(getSafeLoginUrl(baseUrl))
                        }
                    >
                        Sign in again
                    </Button>
                )}
            </Flex>
            <Collapse
                items={[
                    {
                        key: "technical-details",
                        label: "Technical details",
                        children: (
                            <Typography.Paragraph copyable>
                                <pre style={{ whiteSpace: "pre-wrap" }}>
                                    {technicalMessage}
                                </pre>
                            </Typography.Paragraph>
                        ),
                    },
                ]}
            />
        </Flex>
    );
}
