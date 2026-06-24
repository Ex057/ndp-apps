import { createRoute, Outlet } from "@tanstack/react-router";
import React from "react";
import { Flex } from "antd";
import { NDPRoute } from "../route";

export const ReportingRatesRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "reporting-rates",
    component: Component,
});

function Component() {
    return (
        <Flex style={{ width: "100%" }}>
            <Outlet />
        </Flex>
    );
}
