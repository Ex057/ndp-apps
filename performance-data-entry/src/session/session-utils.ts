// Match the DHIS2 server's 3,600-second session timeout.
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;
export const SESSION_WARNING_LEAD_MS = 2 * 60 * 1000;

export type SessionPhase = "active" | "warning" | "expired";

export const getSessionTimeoutMs = (value: unknown): number => {
    if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value <= SESSION_WARNING_LEAD_MS / 60_000
    ) {
        return DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000;
    }

    return value * 60_000;
};

export const getSessionPhase = ({
    now,
    deadline,
    warningDismissedForDeadline,
}: {
    now: number;
    deadline: number;
    warningDismissedForDeadline?: number;
}): SessionPhase => {
    if (now >= deadline) {
        return "expired";
    }

    if (
        now >= deadline - SESSION_WARNING_LEAD_MS &&
        warningDismissedForDeadline !== deadline
    ) {
        return "warning";
    }

    return "active";
};

export const getRemainingSeconds = (now: number, deadline: number): number =>
    Math.max(0, Math.ceil((deadline - now) / 1000));

export const isDhisApiRequest = (
    input: RequestInfo | URL,
    baseUrl: string,
): boolean => {
    try {
        const requestUrl = new URL(
            typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
            window.location.href,
        );
        const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
        const apiUrl = new URL(`${normalizedBaseUrl}/api/`, window.location.href);

        return (
            requestUrl.origin === apiUrl.origin &&
            requestUrl.pathname.startsWith(apiUrl.pathname)
        );
    } catch {
        return false;
    }
};
