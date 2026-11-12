import { Button, Modal, Space, Typography } from "antd";
import React, {
    PropsWithChildren,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    getRemainingSeconds,
    getSessionPhase,
    getSessionTimeoutMs,
    isDhisApiRequest,
    SESSION_WARNING_LEAD_MS,
    SessionPhase,
} from "./session-utils";

const SESSION_CONFIG_PATH =
    "/api/dataStore/ndp-configurations/session-timeout";

type SessionConfig = {
    timeoutMinutes?: unknown;
};

const formatRemainingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function SessionManager({
    baseUrl,
    children,
}: PropsWithChildren<{ baseUrl: string }>) {
    const [phase, setPhase] = useState<SessionPhase>("active");
    const [remainingSeconds, setRemainingSeconds] = useState(
        DEFAULT_SESSION_TIMEOUT_MINUTES * 60,
    );
    const [extensionError, setExtensionError] = useState<string>();

    const timeoutMsRef = useRef(
        DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000,
    );
    const deadlineRef = useRef(Date.now() + timeoutMsRef.current);
    const warningDismissedForDeadlineRef = useRef<number | undefined>(undefined);
    const warningTimerRef = useRef<
        ReturnType<typeof setTimeout> | undefined
    >(undefined);
    const expiryTimerRef = useRef<
        ReturnType<typeof setTimeout> | undefined
    >(undefined);
    const countdownTimerRef = useRef<
        ReturnType<typeof setInterval> | undefined
    >(undefined);
    const checkingSessionRef = useRef(false);

    const updatePhase = useCallback((nextPhase: SessionPhase) => {
        setPhase(nextPhase);
    }, []);

    const clearDeadlineTimers = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        warningTimerRef.current = undefined;
        expiryTimerRef.current = undefined;
    }, []);

    const armDeadlineTimers = useCallback(() => {
        clearDeadlineTimers();

        const now = Date.now();
        const deadline = deadlineRef.current;
        const nextPhase = getSessionPhase({
            now,
            deadline,
            warningDismissedForDeadline:
                warningDismissedForDeadlineRef.current,
        });
        updatePhase(nextPhase);

        if (nextPhase === "expired") return;

        const warningDelay = deadline - SESSION_WARNING_LEAD_MS - now;
        if (warningDelay > 0) {
            warningTimerRef.current = setTimeout(() => {
                updatePhase("warning");
            }, warningDelay);
        }

        expiryTimerRef.current = setTimeout(() => {
            updatePhase("expired");
        }, Math.max(0, deadline - now));
    }, [clearDeadlineTimers, updatePhase]);

    const recordSuccessfulActivity = useCallback(() => {
        deadlineRef.current = Date.now() + timeoutMsRef.current;
        warningDismissedForDeadlineRef.current = undefined;
        setExtensionError(undefined);
        armDeadlineTimers();
    }, [armDeadlineTimers]);

    const markExpired = useCallback(() => {
        clearDeadlineTimers();
        setExtensionError(undefined);
        updatePhase("expired");
    }, [clearDeadlineTimers, updatePhase]);

    useEffect(() => {
        armDeadlineTimers();

        return clearDeadlineTimers;
    }, [armDeadlineTimers, clearDeadlineTimers]);

    useEffect(() => {
        if (phase !== "warning") {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = undefined;
            }
            return;
        }

        const updateCountdown = () => {
            setRemainingSeconds(
                getRemainingSeconds(Date.now(), deadlineRef.current),
            );
        };
        updateCountdown();
        countdownTimerRef.current = setInterval(updateCountdown, 1000);

        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = undefined;
            }
        };
    }, [phase]);

    useEffect(() => {
        const originalFetch = window.fetch.bind(window);
        const monitoredFetch: typeof window.fetch = async (input, init) => {
            const response = await originalFetch(input, init);

            if (isDhisApiRequest(input, baseUrl)) {
                if (response.status === 401) {
                    markExpired();
                } else if (response.ok) {
                    recordSuccessfulActivity();
                }
            }

            return response;
        };

        window.fetch = monitoredFetch;

        return () => {
            if (window.fetch === monitoredFetch) {
                window.fetch = originalFetch;
            }
        };
    }, [baseUrl, markExpired, recordSuccessfulActivity]);

    useEffect(() => {
        let cancelled = false;

        const loadSessionConfiguration = async () => {
            try {
                const response = await window.fetch(
                    `${baseUrl.replace(/\/$/, "")}${SESSION_CONFIG_PATH}`,
                    {
                        credentials: "include",
                        headers: {
                            Accept: "application/json",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                    },
                );

                if (!response.ok || cancelled) return;

                const config = (await response.json()) as SessionConfig;
                if (cancelled) return;

                timeoutMsRef.current = getSessionTimeoutMs(
                    config.timeoutMinutes,
                );
                recordSuccessfulActivity();
            } catch {
                // The documented default remains active when configuration
                // cannot be read. Network failures are not session expiry.
            }
        };

        void loadSessionConfiguration();

        return () => {
            cancelled = true;
        };
    }, [baseUrl, recordSuccessfulActivity]);

    const checkSession = useCallback(
        async (showFailure: boolean) => {
            if (checkingSessionRef.current) return;

            checkingSessionRef.current = true;
            setExtensionError(undefined);

            try {
                const response = await window.fetch(
                    `${baseUrl.replace(/\/$/, "")}/api/me?fields=id`,
                    {
                        credentials: "include",
                        headers: {
                            Accept: "application/json",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                    },
                );

                if (response.ok) {
                    recordSuccessfulActivity();
                } else if (response.status === 401) {
                    markExpired();
                } else if (showFailure) {
                    setExtensionError(
                        "The session could not be extended. Please try again.",
                    );
                }
            } catch {
                if (showFailure) {
                    setExtensionError(
                        "The server could not be reached. Check your connection and try again.",
                    );
                }
            } finally {
                checkingSessionRef.current = false;
            }
        },
        [baseUrl, markExpired, recordSuccessfulActivity],
    );

    useEffect(() => {
        if (phase === "expired") {
            // Keep the user on the current app and route. In local development
            // this lets the DHIS2 app shell reopen authentication; in an
            // installed app the DHIS2 server handles reauthentication for the
            // same application URL.
            window.location.reload();
        }
    }, [phase]);

    useEffect(() => {
        const handleReturnToTab = () => {
            if (document.visibilityState !== "visible") return;
            armDeadlineTimers();
        };

        document.addEventListener("visibilitychange", handleReturnToTab);
        window.addEventListener("focus", handleReturnToTab);

        return () => {
            document.removeEventListener("visibilitychange", handleReturnToTab);
            window.removeEventListener("focus", handleReturnToTab);
        };
    }, [armDeadlineTimers]);

    const dismissWarning = () => {
        warningDismissedForDeadlineRef.current = deadlineRef.current;
        setExtensionError(undefined);
        armDeadlineTimers();
    };

    return (
        <>
            {children}

            <Modal
                title="Your session is about to expire"
                open={phase === "warning"}
                closable={false}
                maskClosable={false}
                keyboard={false}
                footer={
                    <Space>
                        <Button onClick={dismissWarning}>Not now</Button>
                        <Button
                            type="primary"
                            onClick={() => void checkSession(true)}
                        >
                            Extend session
                        </Button>
                    </Space>
                }
            >
                <Typography.Paragraph>
                    Your session will expire in approximately{" "}
                    <strong>{formatRemainingTime(remainingSeconds)}</strong>.
                    Extend it to continue working without interruption.
                </Typography.Paragraph>
                {extensionError && (
                    <Typography.Text type="danger">
                        {extensionError}
                    </Typography.Text>
                )}
            </Modal>

        </>
    );
}
