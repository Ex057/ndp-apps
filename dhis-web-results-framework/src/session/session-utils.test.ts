import {
    getRemainingSeconds,
    getSafeLoginUrl,
    getSessionPhase,
    isDhisApiRequest,
    SESSION_TIMEOUT_MS,
} from "./session-utils";

describe("Results Framework session utilities", () => {
    it("builds the DHIS2 safe-login URL", () => {
        expect(getSafeLoginUrl("https://example.org/ndpdb/")).toBe(
            "https://example.org/ndpdb/dhis-web-commons/security/login.action",
        );
        expect(getSafeLoginUrl("http://localhost:8080")).toBe(
            "http://localhost:8080/dhis-web-commons/security/login.action",
        );
    });

    it("recognises API requests for the configured DHIS2 base URL", () => {
        expect(
            isDhisApiRequest(
                "https://example.org/ndpdb/api/me",
                "https://example.org/ndpdb",
            ),
        ).toBe(true);
    });

    it("ignores non-API and different-origin requests", () => {
        expect(
            isDhisApiRequest(
                "https://example.org/ndpdb/apps/results",
                "https://example.org/ndpdb",
            ),
        ).toBe(false);
        expect(
            isDhisApiRequest(
                "https://other.example/ndpdb/api/me",
                "https://example.org/ndpdb",
            ),
        ).toBe(false);
    });

    it("warns two minutes before the 60-minute deadline", () => {
        const now = 10_000;
        const deadline = now + SESSION_TIMEOUT_MS;
        expect(getSessionPhase(now, deadline)).toBe("active");
        expect(getSessionPhase(deadline - 120_000, deadline)).toBe("warning");
        expect(getSessionPhase(deadline, deadline)).toBe("expired");
    });

    it("returns whole remaining seconds", () => {
        expect(getRemainingSeconds(1_000, 2_001)).toBe(2);
        expect(getRemainingSeconds(3_000, 2_000)).toBe(0);
    });
});
