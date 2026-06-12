import { QueryClient } from "@tanstack/react-query";
import {
    createHashHistory,
    createRouter,
    ErrorComponent,
} from "@tanstack/react-router";
import React from "react";
import Spinner from "./components/Spinner";
import { RootRoute } from "./routes/__root";
import { IndexRoute } from "./routes/index";
import { NDPIndexRoute } from "./routes/layout/ndp";
import { FAQIndexRoute } from "./routes/layout/ndp/faqs";
import { FAQRoute } from "./routes/layout/ndp/faqs/route";
import { GoalIndexRoute } from "./routes/layout/ndp/goals";
import { GoalRoute } from "./routes/layout/ndp/goals/route";
import { IndicatorDictionaryIndexRoute } from "./routes/layout/ndp/indicator-dictionaries";
import { IndicatorDictionaryRoute } from "./routes/layout/ndp/indicator-dictionaries/route";
import { LibraryIndexRoute } from "./routes/layout/ndp/libraries";
import { LibraryRoute } from "./routes/layout/ndp/libraries/route";
import { ObjectIndexRoute } from "./routes/layout/ndp/objectives";
import { ObjectiveRoute } from "./routes/layout/ndp/objectives/route";
import { OutcomeLevelIndexRoute } from "./routes/layout/ndp/outcome-levels";
import { OutcomeLevelRoute } from "./routes/layout/ndp/outcome-levels/route";
import { OutcomePerformanceIndexRoute } from "./routes/layout/ndp/outcome-performance";
import { OutcomePerformanceRoute } from "./routes/layout/ndp/outcome-performance/route";
import { OutputPerformanceIndexRoute } from "./routes/layout/ndp/output-performance";
import { OutputPerformanceRoute } from "./routes/layout/ndp/output-performance/route";
import { OverallPerformanceIndexRoute } from "./routes/layout/ndp/overall-performance";
import { OverallPerformanceRoute } from "./routes/layout/ndp/overall-performance/route";
import { PolicyActionIndexRoute } from "./routes/layout/ndp/policy-actions";
import { PolicyActionRoute } from "./routes/layout/ndp/policy-actions/route";
import { ProjectPerformanceIndexRoute } from "./routes/layout/ndp/project-performances";
import { ProjectPerformanceRoute } from "./routes/layout/ndp/project-performances/route";
import { NDPRoute } from "./routes/layout/ndp/route";
import { SubProgramActionIndexRoute } from "./routes/layout/ndp/sub-program-actions";
import { SubProgramActionRoute } from "./routes/layout/ndp/sub-program-actions/route";
import { SubProgramOutcomeIndexRoute } from "./routes/layout/ndp/sub-program-outcomes";
import { SubProgramOutcomeRoute } from "./routes/layout/ndp/sub-program-outcomes/route";
import { SubProgramOutputIndexRoute } from "./routes/layout/ndp/sub-program-outputs";
import { SubProgramOutputRoute } from "./routes/layout/ndp/sub-program-outputs/route";
import { VisionIndexRoute } from "./routes/layout/ndp/visions";
import { VisionRoute } from "./routes/layout/ndp/visions/route";
import { WorkFlowIndexRoute } from "./routes/layout/ndp/workflows";
import { WorkflowRoute } from "./routes/layout/ndp/workflows/route";
import { LayoutRoute } from "./routes/layout/route";
import { SettingsIndexRoute } from "./routes/settings";
import { SettingsRoute } from "./routes/settings/route";
import { VoteOutcomePerformanceRoute } from "./routes/layout/ndp/vote-outcome-performance/route";
import { VoteOutcomePerformanceIndexRoute } from "./routes/layout/ndp/vote-outcome-performance";
import { VoteProgramPerformanceRoute } from "./routes/layout/ndp/vote-program-performance/route";
import { VoteProgramPerformanceIndexRoute } from "./routes/layout/ndp/vote-program-performance";
import { VoteOutputPerformanceRoute } from "./routes/layout/ndp/vote-output-performance/route";
import { VoteOutputPerformanceIndexRoute } from "./routes/layout/ndp/vote-output-performance";
import { BudgetPerformanceRoute } from "./routes/layout/ndp/budget-performance/route";
import { BudgetPerformanceIndexRoute } from "./routes/layout/ndp/budget-performance";
import { VoteFlashReportRoute } from "./routes/layout/ndp/vote-flash-report/route";
import { VoteFlashReportIndexRoute } from "./routes/layout/ndp/vote-flash-report";
import { ProgramFlashReportRoute } from "./routes/layout/ndp/program-flash-report/route";
import { ProgramFlashReportIndexRoute } from "./routes/layout/ndp/program-flash-report";

const routeTree = RootRoute.addChildren([
    IndexRoute,
    LayoutRoute.addChildren([
        NDPRoute.addChildren([
            NDPIndexRoute,
            FAQRoute.addChildren([FAQIndexRoute]),
            GoalRoute.addChildren([GoalIndexRoute]),
            IndicatorDictionaryRoute.addChildren([
                IndicatorDictionaryIndexRoute,
            ]),
            ObjectiveRoute.addChildren([ObjectIndexRoute]),
            OutcomeLevelRoute.addChildren([OutcomeLevelIndexRoute]),
            LibraryRoute.addChildren([LibraryIndexRoute]),
            PolicyActionRoute.addChildren([PolicyActionIndexRoute]),
            SubProgramActionRoute.addChildren([SubProgramActionIndexRoute]),
            SubProgramOutcomeRoute.addChildren([SubProgramOutcomeIndexRoute]),
            SubProgramOutputRoute.addChildren([SubProgramOutputIndexRoute]),
            VisionRoute.addChildren([VisionIndexRoute]),
            WorkflowRoute.addChildren([WorkFlowIndexRoute]),
            ProjectPerformanceRoute.addChildren([ProjectPerformanceIndexRoute]),
            OverallPerformanceRoute.addChildren([OverallPerformanceIndexRoute]),
            OutcomePerformanceRoute.addChildren([OutcomePerformanceIndexRoute]),
            OutputPerformanceRoute.addChildren([OutputPerformanceIndexRoute]),
            BudgetPerformanceRoute.addChildren([BudgetPerformanceIndexRoute]),
            VoteOutcomePerformanceRoute.addChildren([
                VoteOutcomePerformanceIndexRoute,
            ]),
            VoteProgramPerformanceRoute.addChildren([
                VoteProgramPerformanceIndexRoute,
            ]),
            VoteOutputPerformanceRoute.addChildren([
                VoteOutputPerformanceIndexRoute,
            ]),
            VoteFlashReportRoute.addChildren([VoteFlashReportIndexRoute]),
            ProgramFlashReportRoute.addChildren([ProgramFlashReportIndexRoute]),
        ]),
    ]),
    SettingsRoute.addChildren([SettingsIndexRoute]),
]);
export const router = createRouter({
    routeTree,
    defaultPendingComponent: () => <Spinner message="Loading..." />,
    defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
    history: createHashHistory(),
    context: { queryClient: new QueryClient(), engine: undefined! },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
});
