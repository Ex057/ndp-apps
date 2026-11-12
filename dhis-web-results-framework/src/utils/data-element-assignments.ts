export type DataElementAssignment = {
    orgUnitId?: unknown;
    dataSetId?: unknown;
    dataSetName?: unknown;
    periodType?: unknown;
};

export function getDataElementProgrammeCode(
    dataElement: Record<string, unknown>,
) {
    return String(
        dataElement.UBWSASWdyfi ??
            dataElement.ndpProgramme ??
            dataElement["NDP Programme List"] ??
            dataElement.Programme ??
            "",
    );
}

export function isDataElementInProgramme(
    dataElement: Record<string, unknown>,
    programmeCode: string,
) {
    return getDataElementProgrammeCode(dataElement) === programmeCode;
}

export function isDataElementAssignedToOrgUnit(
    dataElement: {
        datasetAssignments?: DataElementAssignment[];
    },
    orgUnitId: string,
) {
    return (
        Array.isArray(dataElement.datasetAssignments) &&
        dataElement.datasetAssignments.some(
            (assignment) => String(assignment.orgUnitId ?? "") === orgUnitId,
        )
    );
}

function normalizeProgrammeCode(value: unknown) {
    const code = String(value ?? "").trim();
    return /^\d+$/.test(code) ? String(Number(code)) : code.toUpperCase();
}

export function getDataSetProgrammeCode(dataSetName: unknown) {
    return String(dataSetName ?? "").match(
        /\bProgramme\s+0*([0-9]+)\b/i,
    )?.[1] ?? "";
}

export function isDataElementAssignedToMatchingProgrammeDataSet(
    dataElement: Record<string, unknown>,
    orgUnitId: string,
    ndpVersion: string,
) {
    const programmeCode = normalizeProgrammeCode(
        getDataElementProgrammeCode(dataElement),
    );
    if (!programmeCode) return false;

    const assignments = Array.isArray(dataElement.datasetAssignments)
        ? dataElement.datasetAssignments
        : [];

    return assignments.some((assignment) => {
        const selectedOrgUnitId = String(assignment.orgUnitId ?? "");
        const periodType = String(assignment.periodType ?? "").toLowerCase();
        const dataSetName = String(assignment.dataSetName ?? "");
        const dataSetProgrammeCode = normalizeProgrammeCode(
            getDataSetProgrammeCode(dataSetName),
        );
        const dataSetNdpVersion = dataSetName.match(
            /\bNDP(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b/i,
        )?.[0];

        return (
            selectedOrgUnitId === orgUnitId &&
            periodType.includes("quarter") &&
            Boolean(dataSetProgrammeCode) &&
            dataSetProgrammeCode === programmeCode &&
            (!dataSetNdpVersion ||
                dataSetNdpVersion.toUpperCase() === ndpVersion.toUpperCase())
        );
    });
}

export function getReportingProgrammeCodesForOrgUnit(
    dataElements: Array<Record<string, unknown>>,
    orgUnitId: string,
    ndpVersion: string,
) {
    const programmeCountsByDataSet = new Map<string, Map<string, number>>();

    dataElements.forEach((dataElement) => {
        const indicatorGroupType = String(
            dataElement.BmUMiIbD5XY ??
                dataElement.indicatorGroupType ??
                dataElement["Indicator Group Type"] ??
                "",
        )
            .trim()
            .toLowerCase();
        if (!indicatorGroupType || indicatorGroupType === "action") return;

        const programmeCode = getDataElementProgrammeCode(dataElement);
        if (!programmeCode) return;

        const assignments = Array.isArray(dataElement.datasetAssignments)
            ? dataElement.datasetAssignments
            : [];
        assignments.forEach((assignment) => {
            const selectedOrgUnitId = String(assignment.orgUnitId ?? "");
            const dataSetId = String(assignment.dataSetId ?? "");
            const periodType = String(assignment.periodType ?? "").toLowerCase();
            const dataSetName = String(assignment.dataSetName ?? "");
            const dataSetNdpVersion =
                dataSetName.match(
                    /\bNDP(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\b/i,
                )?.[0];

            if (
                selectedOrgUnitId !== orgUnitId ||
                !dataSetId ||
                !periodType.includes("quarter") ||
                (dataSetNdpVersion &&
                    dataSetNdpVersion.toUpperCase() !== ndpVersion.toUpperCase())
            ) {
                return;
            }

            const programmeCounts =
                programmeCountsByDataSet.get(dataSetId) ??
                new Map<string, number>();
            programmeCounts.set(
                programmeCode,
                (programmeCounts.get(programmeCode) ?? 0) + 1,
            );
            programmeCountsByDataSet.set(dataSetId, programmeCounts);
        });
    });

    return new Set(
        Array.from(programmeCountsByDataSet.values()).flatMap(
            (programmeCounts) => {
                const canonicalProgramme = Array.from(
                    programmeCounts.entries(),
                ).sort((a, b) => {
                    if (b[1] !== a[1]) return b[1] - a[1];
                    return a[0].localeCompare(b[0]);
                })[0]?.[0];
                return canonicalProgramme ? [canonicalProgramme] : [];
            },
        ),
    );
}

export function getProgrammeVoteIds(
    dataElements: Array<Record<string, unknown>>,
    programmeCode: string,
) {
    return Array.from(
        new Set(
            dataElements.flatMap((dataElement) => {
                if (!isDataElementInProgramme(dataElement, programmeCode)) {
                    return [];
                }
                const orgUnitId = String(dataElement.orgUnit ?? "");
                return orgUnitId ? [orgUnitId] : [];
            }),
        ),
    ).sort();
}

export function getDataValueContextKey({
    dataElement,
    orgUnit,
    period,
}: {
    dataElement: string;
    orgUnit: string;
    period: string;
}) {
    return `${dataElement}-${orgUnit}-${period}`;
}
