import { createRoute, Outlet } from "@tanstack/react-router";
import React from "react";

import { Flex } from "antd";
import { PolicyActionSearchSchema } from "../../../../types";
import { NDPRoute } from "../route";

export const PolicyActionRoute = createRoute({
    getParentRoute: () => NDPRoute,
    path: "policy-actions",
    validateSearch: PolicyActionSearchSchema,
    component: Component,
});

function Component() {
    return (
        <Flex style={{ height: "100%", width: "100%", flex: 1 }}>
            <Outlet />
        </Flex>
    );
}
