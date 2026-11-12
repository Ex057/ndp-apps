import {
    getDataElementProgrammeCode,
    getDataValueContextKey,
    getProgrammeVoteIds,
    getReportingProgrammeCodesForOrgUnit,
    isDataElementAssignedToOrgUnit,
    isDataElementAssignedToMatchingProgrammeDataSet,
    isDataElementInProgramme,
} from "./data-element-assignments";

describe("data-element organisation-unit assignments", () => {
    const dataElement = {
        datasetAssignments: [
            { orgUnitId: "vote-a" },
            { orgUnitId: "vote-c" },
        ],
    };

    it("accepts an organisation unit assigned to the data element", () => {
        expect(isDataElementAssignedToOrgUnit(dataElement, "vote-a")).toBe(true);
    });

    it("rejects an organisation unit not assigned to the data element", () => {
        expect(isDataElementAssignedToOrgUnit(dataElement, "vote-b")).toBe(false);
    });

    it("rejects data elements without assignment metadata", () => {
        expect(isDataElementAssignedToOrgUnit({}, "vote-a")).toBe(false);
    });

    it("matches the selected programme using its dedicated attribute", () => {
        const programmeDataElement = {
            UBWSASWdyfi: "06",
            attributes: ["01", "06", "NDPIV"],
        };

        expect(getDataElementProgrammeCode(programmeDataElement)).toBe("06");
        expect(isDataElementInProgramme(programmeDataElement, "06")).toBe(true);
        expect(isDataElementInProgramme(programmeDataElement, "01")).toBe(false);
    });

    it("supports the programme attribute code alias", () => {
        expect(
            isDataElementInProgramme({ ndpProgramme: "06" }, "06"),
        ).toBe(true);
    });

    it("builds the programme-to-vote relationship in reverse", () => {
        const dataElements = [
            { id: "de-1", UBWSASWdyfi: "06", orgUnit: "vote-001" },
            { id: "de-2", UBWSASWdyfi: "16", orgUnit: "vote-143" },
            { id: "de-3", UBWSASWdyfi: "06", orgUnit: "vote-012" },
            { id: "de-4", UBWSASWdyfi: "06", orgUnit: "vote-001" },
        ];

        expect(getProgrammeVoteIds(dataElements, "06")).toEqual([
            "vote-001",
            "vote-012",
        ]);
        expect(getProgrammeVoteIds(dataElements, "16")).toEqual([
            "vote-143",
        ]);
    });

    it("uses the organisation unit when identifying comments", () => {
        expect(
            getDataValueContextKey({
                dataElement: "indicator-a",
                orgUnit: "vote-a",
                period: "2026Q3",
            }),
        ).not.toBe(
            getDataValueContextKey({
                dataElement: "indicator-a",
                orgUnit: "vote-b",
                period: "2026Q3",
            }),
        );
    });

    it("derives the canonical quarterly programmes for an exact vote", () => {
        const assignment = {
            orgUnitId: "vote-311",
            dataSetId: "quarterly-dataset",
            dataSetName: "Vote 311 - NDPIV - Programme 02 - Outcomes",
            periodType: "Quarterly",
        };
        const codes = getReportingProgrammeCodesForOrgUnit(
            [
                {
                    id: "de-1",
                    UBWSASWdyfi: "02",
                    BmUMiIbD5XY: "outcome",
                    datasetAssignments: [assignment],
                },
                {
                    id: "de-2",
                    UBWSASWdyfi: "02",
                    BmUMiIbD5XY: "output",
                    datasetAssignments: [assignment],
                },
                {
                    id: "reused-de",
                    UBWSASWdyfi: "16",
                    BmUMiIbD5XY: "outcome",
                    datasetAssignments: [assignment],
                },
                {
                    id: "annual-de",
                    UBWSASWdyfi: "18",
                    BmUMiIbD5XY: "outcome",
                    datasetAssignments: [
                        {
                            ...assignment,
                            dataSetId: "annual-dataset",
                            periodType: "FinancialJuly",
                        },
                    ],
                },
                {
                    id: "other-vote",
                    UBWSASWdyfi: "09",
                    BmUMiIbD5XY: "outcome",
                    datasetAssignments: [
                        { ...assignment, orgUnitId: "vote-001" },
                    ],
                },
            ],
            "vote-311",
            "NDPIV",
        );

        expect(Array.from(codes)).toEqual(["02"]);
    });

    it("rejects an indicator whose programme conflicts with its assigned dataset", () => {
        const assignment = {
            orgUnitId: "vote-311",
            dataSetName: "Vote 311 - NDPIV - Programme 02 - Outcome",
            periodType: "Quarterly",
        };

        expect(
            isDataElementAssignedToMatchingProgrammeDataSet(
                { UBWSASWdyfi: "16", datasetAssignments: [assignment] },
                "vote-311",
                "NDPIV",
            ),
        ).toBe(false);
        expect(
            isDataElementAssignedToMatchingProgrammeDataSet(
                { UBWSASWdyfi: "02", datasetAssignments: [assignment] },
                "vote-311",
                "NDPIV",
            ),
        ).toBe(true);
    });
});
