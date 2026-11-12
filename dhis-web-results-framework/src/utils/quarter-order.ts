export const REPORTING_QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export type ReportingQuarter = (typeof REPORTING_QUARTERS)[number];

export function orderReportingQuarters(quarters: ReportingQuarter[]) {
    return REPORTING_QUARTERS.filter((quarter) => quarters.includes(quarter));
}
