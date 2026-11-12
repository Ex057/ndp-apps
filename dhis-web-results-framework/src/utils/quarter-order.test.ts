import { orderReportingQuarters } from "./quarter-order";

describe("orderReportingQuarters", () => {
    it("orders selected quarters chronologically", () => {
        expect(orderReportingQuarters(["Q4", "Q2", "Q1"])).toEqual([
            "Q1",
            "Q2",
            "Q4",
        ]);
    });
});
