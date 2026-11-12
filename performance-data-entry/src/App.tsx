import { useConfig, useDataEngine } from "@dhis2/app-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ConfigProvider } from "antd";
import React, { FC } from "react";
import { router } from "./router";
import SessionManager from "./session/SessionManager";
import "./app.css";

const queryClient = new QueryClient();
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const MyApp: FC = () => {
    const engine = useDataEngine();
    const { baseUrl } = useConfig();

    return (
        <ConfigProvider
            theme={{
                token: {
                    // borderRadius: 0,
                    colorPrimary: "#2B6998",
                    colorTextDisabled: "rgba(0,0,0,0.75)",
                },
                components: {
                    Table: {
                        borderColor: "#CAD5E5",
                        borderRadius: 0,
                        // headerBg: "#BBD1EE",
                        headerBorderRadius: 0,
                    },
                    Tree: {
                        nodeSelectedBg: "#2B6998",
                        nodeSelectedColor: "#FFFFFF",
                    },
                    Tabs: {
                        cardBg: "#B4CDCD",
                    },
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <SessionManager baseUrl={baseUrl}>
                    <RouterProvider router={router} context={{ engine }} />
                </SessionManager>
            </QueryClientProvider>
        </ConfigProvider>
    );
};

export default MyApp;
