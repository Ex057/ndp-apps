import { Button, Modal, Space, Typography } from "antd";
import React, {
    PropsWithChildren,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    getRemainingSeconds,
    getSessionPhase,
    isDhisApiRequest,
    SESSION_TIMEOUT_MS,
    SESSION_WARNING_LEAD_MS,
    type SessionPhase,
} from "./session-utils";

export default function SessionExpiryManager({
    baseUrl,
    children,
}: PropsWithChildren<{ baseUrl: string }>) {
    const [phase, setPhase] = useState<SessionPhase>("active");
    const [remainingSeconds, setRemainingSeconds] = useState(
        SESSION_TIMEOUT_MS / 1000,
    );
    const [extensionError, setExtensionError] = useState<string>();
    const redirectingRef = useRef(false);
    const deadlineRef = useRef(Date.now() + SESSION_TIMEOUT_MS);
    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );
    const checkingSessionRef = useRef(false);

    const restartAuthentication = useCallback(() => {
        if (redirectingRef.current) return;
        redirectingRef.current = true;
        // Reload the protected app route and let DHIS2 open its canonical
        // sign-in flow, matching Performance Data Entry's expiry behaviour.
        window.location.reload();
    }, []);

    const clearTimers = useCallback(() => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    }, []);

    const armTimers = useCallback(() => {
        clearTimers();
        const now = Date.now();
        const nextPhase = getSessionPhase(now, deadlineRef.current);
        setPhase(nextPhase);
        if (nextPhase === "expired") {
            restartAuthentication();
            return;
        }

        const warningDelay =
            deadlineRef.current - SESSION_WARNING_LEAD_MS - now;
        if (warningDelay > 0) {
            warningTimerRef.current = setTimeout(
                () => setPhase("warning"),
                warningDelay,
            );
        }
        expiryTimerRef.current = setTimeout(() => {
            setPhase("expired");
            restartAuthentication();
        }, Math.max(0, deadlineRef.current - now));
    }, [clearTimers, restartAuthentication]);

    const recordActivity = useCallback(() => {
        deadlineRef.current = Date.now() + SESSION_TIMEOUT_MS;
        setExtensionError(undefined);
        armTimers();
    }, [armTimers]);

    useEffect(() => {
        armTimers();
        return clearTimers;
    }, [armTimers, clearTimers]);

    useEffect(() => {
        if (phase !== "warning") return;
        const update = () =>
            setRemainingSeconds(
                getRemainingSeconds(Date.now(), deadlineRef.current),
            );
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [phase]);

    useEffect(() => {
        const originalFetch = window.fetch.bind(window);
        const monitoredFetch: typeof window.fetch = async (input, init) => {
            const response = await originalFetch(input, init);
            if (isDhisApiRequest(input, baseUrl)) {
                if (response.status === 401) {
                    setPhase("expired");
                    restartAuthentication();
                } else if (response.ok) {
                    recordActivity();
                }
            }
            return response;
        };

        window.fetch = monitoredFetch;
        return () => {
            if (window.fetch === monitoredFetch) window.fetch = originalFetch;
        };
    }, [baseUrl, recordActivity, restartAuthentication]);

    useEffect(() => {
        const recheckDeadline = () => {
            if (document.visibilityState === "visible") armTimers();
        };
        document.addEventListener("visibilitychange", recheckDeadline);
        window.addEventListener("focus", recheckDeadline);
        return () => {
            document.removeEventListener("visibilitychange", recheckDeadline);
            window.removeEventListener("focus", recheckDeadline);
        };
    }, [armTimers]);

    const extendSession = useCallback(async () => {
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
            if (response.ok) recordActivity();
            else if (response.status === 401) restartAuthentication();
            else setExtensionError("The session could not be extended. Try again.");
        } catch {
            setExtensionError(
                "The server could not be reached. Check your connection and try again.",
            );
        } finally {
            checkingSessionRef.current = false;
        }
    }, [baseUrl, recordActivity, restartAuthentication]);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = String(remainingSeconds % 60).padStart(2, "0");

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
                        <Button onClick={restartAuthentication}>
                            Sign in again
                        </Button>
                        <Button type="primary" onClick={() => void extendSession()}>
                            Extend session
                        </Button>
                    </Space>
                }
            >
                <Typography.Paragraph>
                    Your session will expire in approximately {minutes}:{seconds}.
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
