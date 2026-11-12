import {
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    getRemainingSeconds,
    getSessionPhase,
    getSessionTimeoutMs,
    isDhisApiRequest,
    SESSION_WARNING_LEAD_MS,
} from "./session-utils";

describe("session utilities", () => {
    describe("getSessionTimeoutMs", () => {
        it("uses a valid configured timeout", () => {
            expect(getSessionTimeoutMs(15)).toBe(15 * 60_000);
        });

        it.each([undefined, null, "30", 2, 2.5, -1, Number.NaN])(
            "uses the default for invalid value %p",
            (value) => {
                expect(getSessionTimeoutMs(value)).toBe(
                    DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000,
                );
            },
        );
    });

    describe("getSessionPhase", () => {
        const deadline = 30 * 60_000;

        it("is active before the warning window", () => {
            expect(
                getSessionPhase({
                    now: deadline - SESSION_WARNING_LEAD_MS - 1,
                    deadline,
                }),
            ).toBe("active");
        });

        it("warns exactly two minutes before expiry", () => {
            expect(
                getSessionPhase({
                    now: deadline - SESSION_WARNING_LEAD_MS,
                    deadline,
                }),
            ).toBe("warning");
        });

        it("does not repeat a dismissed warning for the same deadline", () => {
            expect(
                getSessionPhase({
                    now: deadline - 1,
                    deadline,
                    warningDismissedForDeadline: deadline,
                }),
            ).toBe("active");
        });

        it("expires at the deadline even when the warning was dismissed", () => {
            expect(
                getSessionPhase({
                    now: deadline,
                    deadline,
                    warningDismissedForDeadline: deadline,
                }),
            ).toBe("expired");
        });
    });

    it("rounds the displayed remaining time up and never below zero", () => {
        expect(getRemainingSeconds(1000, 2001)).toBe(2);
        expect(getRemainingSeconds(3000, 2000)).toBe(0);
    });

    describe("isDhisApiRequest", () => {
        it("matches API requests under the configured DHIS2 base URL", () => {
            expect(
                isDhisApiRequest(
                    "https://example.org/ndpdb/api/me",
                    "https://example.org/ndpdb",
                ),
            ).toBe(true);
        });

        it("does not match non-API or different-origin requests", () => {
            expect(
                isDhisApiRequest(
                    "https://example.org/ndpdb/apps/test/app.js",
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
    });
});
