export const SESSION_TIMEOUT_MS = 60 * 60 * 1000;
export const SESSION_WARNING_LEAD_MS = 2 * 60 * 1000;

export type SessionPhase = "active" | "warning" | "expired";

export const getSafeLoginUrl = (baseUrl: string): string =>
    `${baseUrl.replace(/\/$/, "")}/dhis-web-commons/security/login.action`;

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
        const apiUrl = new URL(
            `${baseUrl.replace(/\/$/, "")}/api/`,
            window.location.href,
        );

        return (
            requestUrl.origin === apiUrl.origin &&
            requestUrl.pathname.startsWith(apiUrl.pathname)
        );
    } catch {
        return false;
    }
};

export const getSessionPhase = (
    now: number,
    deadline: number,
): SessionPhase => {
    if (now >= deadline) return "expired";
    if (now >= deadline - SESSION_WARNING_LEAD_MS) return "warning";
    return "active";
};

export const getRemainingSeconds = (now: number, deadline: number): number =>
    Math.max(0, Math.ceil((deadline - now) / 1000));
