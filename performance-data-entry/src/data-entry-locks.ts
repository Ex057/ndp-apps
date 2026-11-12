import {
    DataEntryLockColumn,
    DataEntryLocks,
    DataEntrySection,
    IDataSet,
} from "./types";

export function getDataEntrySection(
    dataSet: Pick<IDataSet, "id" | "name">,
) {
    return dataSet.name.toLowerCase().includes("action")
        ? "actions"
        : "results";
}

export function classifyDataEntryColumn(
    name: string,
    section: DataEntrySection,
): DataEntryLockColumn | undefined {
    const normalizedName = name.toLowerCase();

    if (section === "results") {
        if (normalizedName.includes("baseline")) return "baseline";
        if (normalizedName.includes("target")) return "target";
        return undefined;
    }

    if (normalizedName.includes("planned")) return "budgetPlanned";
    if (normalizedName.includes("approved")) return "budgetApproved";
    return undefined;
}

export function isDataEntryColumnLocked({
    locks,
    dataSet,
    categoryOptionName,
    organisationUnitId,
    fallbackLocked,
    now = Date.now(),
}: {
    locks?: DataEntryLocks;
    dataSet: Pick<IDataSet, "id" | "name">;
    categoryOptionName: string;
    organisationUnitId: string;
    fallbackLocked: boolean;
    now?: number;
}) {
    const section = getDataEntrySection(dataSet);
    const rule = [...(locks?.rules ?? [])].reverse().find((candidate) => {
        return (
            candidate.enabled &&
            candidate.section === section &&
            ((candidate.organisationUnitIds?.length ?? 0) === 0 ||
                candidate.organisationUnitIds?.includes(organisationUnitId)) &&
            ((candidate.dataSetIds?.length ?? 0) === 0 ||
                candidate.dataSetIds?.includes(dataSet.id))
        );
    });

    if (!rule) return fallbackLocked;
    const column = classifyDataEntryColumn(categoryOptionName, section);
    if (!column) return fallbackLocked;
    if (!rule.columns?.includes(column)) return false;
    if (rule.mode === "open") return false;
    if (rule.mode === "locked") return true;

    const lockTime = rule.lockAt ? Date.parse(rule.lockAt) : Number.NaN;
    return Number.isFinite(lockTime) ? now >= lockTime : fallbackLocked;
}

export function getNextLockDeadline({
    locks,
    dataSet,
    organisationUnitId,
    now = Date.now(),
}: {
    locks?: DataEntryLocks;
    dataSet: Pick<IDataSet, "id" | "name">;
    organisationUnitId: string;
    now?: number;
}) {
    const section = getDataEntrySection(dataSet);
    const upcomingDeadlines = (locks?.rules ?? [])
        .filter(
            (rule) =>
                rule.enabled &&
                rule.section === section &&
                rule.mode === "scheduled" &&
                ((rule.organisationUnitIds?.length ?? 0) === 0 ||
                    rule.organisationUnitIds?.includes(organisationUnitId)) &&
                ((rule.dataSetIds?.length ?? 0) === 0 ||
                    rule.dataSetIds?.includes(dataSet.id)),
        )
        .map((rule) => (rule.lockAt ? Date.parse(rule.lockAt) : Number.NaN))
        .filter((deadline) => Number.isFinite(deadline) && deadline > now);

    return upcomingDeadlines.length > 0
        ? Math.min(...upcomingDeadlines)
        : undefined;
}
