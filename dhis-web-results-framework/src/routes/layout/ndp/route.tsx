import { createRoute, Outlet } from "@tanstack/react-router";
import React from "react";
import { LayoutRoute } from "../route";
import { ndpIndicatorsQueryOptions } from "../../../query-options";

export const NDPRoute = createRoute({
    getParentRoute: () => LayoutRoute,
    path: "/ndp",
    component: Component,
    loaderDeps: ({ search }) => ({
        v: search.v,
    }),
    loader: async ({ context, deps: { v } }) => {
        if (!v) {
            return "Skipped";
        }
        const { engine, queryClient } = context;
        const data = await queryClient.ensureQueryData(
            ndpIndicatorsQueryOptions(engine, v),
        );
        return data;
    },
});

function Component() {
    return <Outlet />;
}
