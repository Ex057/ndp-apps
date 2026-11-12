import { useDataEngine } from "@dhis2/app-runtime";
import { createFixedPeriodFromPeriodId } from "@dhis2/multi-calendar-dates";
import {
    Alert,
    Button,
    Card,
    Checkbox,
    DatePicker,
    Flex,
    Radio,
    Select,
    Switch,
    Tag,
    Typography,
    message,
} from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import React, { useState } from "react";
import { Option } from "../../types";

export type DataEntrySection = "results" | "actions";

type LockColumn =
    | "baseline"
    | "target"
    | "budgetPlanned"
    | "budgetApproved";
type LockMode = "open" | "locked" | "scheduled";
type VoteScope = "all" | "selected";

type DataEntryLockRule = {
    id: string;
    reportingPeriod: string;
    organisationUnitIds: string[];
    dataSetIds: string[];
    section: DataEntrySection;
    columns: LockColumn[];
    mode: LockMode;
    lockAt?: string;
    enabled: boolean;
    updatedAt: string;
};

type DataEntryLocks = {
    version: number;
    rules: DataEntryLockRule[];
};

type NDPConfiguration = {
    baseline?: string;
    activeQuarters?: string[];
    activeFinancialYears?: string[];
    financialYears?: string[];
    dataEntryLocks?: DataEntryLocks;
    [key: string]: unknown;
};

type ConfigurationResponse = {
    data?: NDPConfiguration;
    [key: string]: unknown;
};

type Vote = {
    id: string;
    name: string;
    code?: string;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const KAMPALA_TIME_ZONE = "Africa/Kampala";

function formatPeriodLabel(periodId: string) {
    try {
        return createFixedPeriodFromPeriodId({
            periodId,
            calendar: "iso8601",
        }).name;
    } catch (error) {
        return periodId;
    }
}

const sectionOptions: Record<
    DataEntrySection,
    {
        title: string;
        ruleId: string;
        columnsLabel: string;
        defaultColumns: LockColumn[];
        columns: Array<{ label: string; value: LockColumn }>;
        datasetDescription: string;
    }
> = {
    results: {
        title: "Results column access",
        ruleId: "results-default",
        columnsLabel: "Results columns",
        defaultColumns: ["baseline", "target"],
        columns: [
            { label: "Baseline", value: "baseline" },
            { label: "Target", value: "target" },
        ],
        datasetDescription:
            "Outcome, Intermediate Outcome, and Output datasets",
    },
    actions: {
        title: "Actions column access",
        ruleId: "actions-default",
        columnsLabel: "Actions columns",
        defaultColumns: ["budgetPlanned", "budgetApproved"],
        columns: [
            { label: "Budget Planned", value: "budgetPlanned" },
            { label: "Budget Approved", value: "budgetApproved" },
        ],
        datasetDescription: "Actions datasets",
    },
};

export default function DataEntryLockConfiguration({
    section,
    ndpVersions,
    configurations,
    votes,
    engine,
}: {
    section: DataEntrySection;
    ndpVersions: Option[];
    configurations: Record<string, ConfigurationResponse>;
    votes: Vote[];
    engine: ReturnType<typeof useDataEngine>;
}) {
    const options = sectionOptions[section];
    const [selectedVersion, setSelectedVersion] = useState<string>();
    const [reportingPeriod, setReportingPeriod] = useState<string>();
    const [columns, setColumns] = useState<LockColumn[]>(
        options.defaultColumns,
    );
    const [voteScope, setVoteScope] = useState<VoteScope>("all");
    const [selectedVoteIds, setSelectedVoteIds] = useState<string[]>([]);
    const [lockMode, setLockMode] = useState<LockMode>("locked");
    const [lockAt, setLockAt] = useState<dayjs.Dayjs | null>(null);
    const [ruleEnabled, setRuleEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedRule, setSavedRule] = useState<DataEntryLockRule>();
    const [messageApi, messageContextHolder] = message.useMessage();

    const loadRule = (versionCode: string) => {
        const rule = configurations[versionCode]?.data?.dataEntryLocks?.rules?.find(
            (candidate) =>
                candidate.id === options.ruleId &&
                candidate.section === section,
        );

        setSelectedVersion(versionCode);
        setReportingPeriod(rule?.reportingPeriod);
        setColumns(rule?.columns ?? options.defaultColumns);
        setVoteScope(
            rule?.organisationUnitIds?.length ? "selected" : "all",
        );
        setSelectedVoteIds(rule?.organisationUnitIds ?? []);
        setLockMode(rule?.mode ?? "locked");
        setLockAt(
            rule?.lockAt
                ? dayjs(rule.lockAt).tz(KAMPALA_TIME_ZONE)
                : null,
        );
        setRuleEnabled(rule?.enabled ?? true);
        setSavedRule(rule);
    };

    const saveRule = async () => {
        if (!selectedVersion) {
            messageApi.warning("Select an NDP version");
            return;
        }
        if (!reportingPeriod) {
            messageApi.warning("Select a reporting period");
            return;
        }
        if (voteScope === "selected" && selectedVoteIds.length === 0) {
            messageApi.warning("Select at least one Vote");
            return;
        }
        if (columns.length === 0) {
            messageApi.warning(`Select at least one ${options.columnsLabel}`);
            return;
        }
        if (lockMode === "scheduled" && !lockAt) {
            messageApi.warning("Select the scheduled lock date and time");
            return;
        }

        const configuration = configurations[selectedVersion]?.data ?? {};
        const existingRules = configuration.dataEntryLocks?.rules ?? [];
        const nextRule: DataEntryLockRule = {
            id: options.ruleId,
            reportingPeriod,
            organisationUnitIds:
                voteScope === "selected" ? selectedVoteIds : [],
            dataSetIds: [],
            section,
            columns,
            mode: lockMode,
            ...(lockMode === "scheduled" && lockAt
                ? {
                      lockAt: dayjs.tz(
                          lockAt.format("YYYY-MM-DD HH:mm:ss"),
                          KAMPALA_TIME_ZONE,
                      ).toISOString(),
                  }
                : {}),
            enabled: ruleEnabled,
            updatedAt: new Date().toISOString(),
        };
        const nextConfiguration: NDPConfiguration = {
            ...configuration,
            dataEntryLocks: {
                version: 1,
                rules: [
                    ...existingRules.filter(
                        (rule) => rule.id !== options.ruleId,
                    ),
                    nextRule,
                ],
            },
        };

        setSaving(true);
        try {
            await engine.mutate({
                resource: "dataStore/ndp-configurations",
                data: nextConfiguration,
                type: "update",
                id: selectedVersion,
            });
            configurations[selectedVersion] = {
                ...configurations[selectedVersion],
                data: nextConfiguration,
            };
            setSavedRule(nextRule);
            messageApi.success(`${options.title} configuration saved`);
        } catch (error) {
            messageApi.error(`Could not save the ${options.title} configuration`);
        } finally {
            setSaving(false);
        }
    };

    const selectedConfiguration = selectedVersion
        ? configurations[selectedVersion]?.data
        : undefined;
    const annualPeriods = Array.from(
        new Set([
            ...(selectedConfiguration?.baseline
                ? [selectedConfiguration.baseline]
                : []),
            ...(selectedConfiguration?.financialYears ?? []),
            ...(selectedConfiguration?.activeFinancialYears ?? []),
        ]),
    );
    const quarterlyPeriods = Array.from(
        new Set(selectedConfiguration?.activeQuarters ?? []),
    );
    const reportingPeriodOptions = [
        ...(annualPeriods.length > 0
            ? [
                  {
                      label: "Financial years",
                      options: annualPeriods.map((period) => ({
                          label: `${formatPeriodLabel(period)} (${period})`,
                          value: period,
                      })),
                  },
              ]
            : []),
        ...(quarterlyPeriods.length > 0
            ? [
                  {
                      label: "Quarters",
                      options: quarterlyPeriods.map((period) => ({
                          label: `${formatPeriodLabel(period)} (${period})`,
                          value: period,
                      })),
                  },
              ]
            : []),
    ];
    const selectedPeriodLabel = reportingPeriod
        ? formatPeriodLabel(reportingPeriod)
        : undefined;
    const lockDeadline = lockAt?.valueOf();
    const isScheduledClosed =
        lockMode === "scheduled" &&
        lockDeadline !== undefined &&
        Date.now() >= lockDeadline;
    const status = !ruleEnabled
        ? {
              label: "RULE DISABLED",
              color: "default",
              alertType: "warning" as const,
              description:
                  "This rule is disabled. Performance Data Entry will use its existing fallback locking behavior.",
          }
        : lockMode === "open"
          ? {
                label: "OPEN",
                color: "success",
                alertType: "success" as const,
                description:
                    "The selected columns are open for the matching period and Vote scope.",
            }
          : lockMode === "locked" || isScheduledClosed
            ? {
                  label: "CLOSED",
                  color: "error",
                  alertType: "error" as const,
                  description:
                      lockMode === "scheduled" && lockAt
                          ? `The selected columns closed on ${lockAt.format("DD MMM YYYY, HH:mm")} Africa/Kampala time.`
                          : "The selected columns are closed for the matching period and Vote scope.",
              }
            : lockAt
              ? {
                    label: "OPEN — CLOSURE SCHEDULED",
                    color: "processing",
                    alertType: "info" as const,
                    description: `The selected columns are open and will close on ${lockAt.format("DD MMM YYYY, HH:mm")} Africa/Kampala time.`,
                }
              : {
                    label: "SCHEDULE INCOMPLETE",
                    color: "warning",
                    alertType: "warning" as const,
                    description:
                        "Choose a lock date and time before saving this scheduled rule.",
                };
    const draftSignature = JSON.stringify({
        reportingPeriod,
        organisationUnitIds:
            voteScope === "selected" ? selectedVoteIds : [],
        columns,
        mode: lockMode,
        lockAt:
            lockMode === "scheduled" && lockAt
                ? dayjs
                      .tz(
                          lockAt.format("YYYY-MM-DD HH:mm:ss"),
                          KAMPALA_TIME_ZONE,
                      )
                      .toISOString()
                : undefined,
        enabled: ruleEnabled,
    });
    const savedSignature = savedRule
        ? JSON.stringify({
              reportingPeriod: savedRule.reportingPeriod,
              organisationUnitIds: savedRule.organisationUnitIds ?? [],
              columns: savedRule.columns,
              mode: savedRule.mode,
              lockAt: savedRule.lockAt,
              enabled: savedRule.enabled,
          })
        : undefined;
    const hasUnsavedChanges = draftSignature !== savedSignature;

    return (
        <Card size="small" title={options.title}>
            {messageContextHolder}
            <Flex vertical gap={16}>
                <Alert
                    type="info"
                    showIcon
                    message="Applied in Performance Data Entry"
                    description="A matching saved rule controls these columns for the selected period and Vote scope. Where no rule matches, the existing greyed-out column behavior remains in place."
                />
                <Flex gap={16} wrap>
                    <Flex vertical gap={6} style={{ minWidth: 260, flex: 1 }}>
                        <Typography.Text strong>NDP version</Typography.Text>
                        <Select
                            placeholder="Select NDP version"
                            value={selectedVersion}
                            onChange={loadRule}
                            options={ndpVersions.map((version) => ({
                                label: version.name,
                                value: version.code,
                            }))}
                        />
                    </Flex>
                    <Flex vertical gap={6} style={{ minWidth: 260, flex: 1 }}>
                        <Typography.Text strong>
                            Reporting period
                        </Typography.Text>
                        <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="Select a financial year or quarter"
                            value={reportingPeriod}
                            disabled={!selectedVersion}
                            onChange={setReportingPeriod}
                            options={reportingPeriodOptions}
                            notFoundContent="No configured periods"
                        />
                        {reportingPeriod && (
                            <Typography.Text type="secondary">
                                Selected: {selectedPeriodLabel} — {reportingPeriod}
                            </Typography.Text>
                        )}
                    </Flex>
                </Flex>
                <Flex vertical gap={8}>
                    <Typography.Text strong>Vote scope</Typography.Text>
                    <Radio.Group
                        value={voteScope}
                        onChange={(event) => {
                            const nextScope = event.target.value as VoteScope;
                            setVoteScope(nextScope);
                            if (nextScope === "all") {
                                setSelectedVoteIds([]);
                            }
                        }}
                        options={[
                            { label: "All Votes", value: "all" },
                            { label: "Selected Votes", value: "selected" },
                        ]}
                    />
                    {voteScope === "selected" && (
                        <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder="Select one or more Votes"
                            value={selectedVoteIds}
                            onChange={setSelectedVoteIds}
                            options={votes.map((vote) => ({
                                label: vote.code
                                    ? `${vote.code} - ${vote.name}`
                                    : vote.name,
                                value: vote.id,
                            }))}
                            style={{ width: "100%", maxWidth: 720 }}
                        />
                    )}
                </Flex>
                <Flex vertical gap={8}>
                    <Typography.Text strong>
                        {options.columnsLabel}
                    </Typography.Text>
                    <Checkbox.Group
                        value={columns}
                        onChange={(values) =>
                            setColumns(values as LockColumn[])
                        }
                        options={options.columns}
                    />
                </Flex>
                <Flex vertical gap={8}>
                    <Typography.Text strong>Column access</Typography.Text>
                    <Radio.Group
                        value={lockMode}
                        onChange={(event) => setLockMode(event.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        options={[
                            { label: "Open", value: "open" },
                            { label: "Lock now", value: "locked" },
                            { label: "Schedule lock", value: "scheduled" },
                        ]}
                    />
                </Flex>
                {lockMode === "scheduled" && (
                    <Flex vertical gap={6}>
                        <Typography.Text strong>
                            Lock date and time (Africa/Kampala)
                        </Typography.Text>
                        <DatePicker
                            showTime
                            value={lockAt}
                            onChange={setLockAt}
                            format="DD MMM YYYY, HH:mm"
                            style={{ maxWidth: 320 }}
                        />
                    </Flex>
                )}
                <Flex align="center" gap={8}>
                    <Switch checked={ruleEnabled} onChange={setRuleEnabled} />
                    <Typography.Text>Configuration enabled</Typography.Text>
                </Flex>
                {selectedVersion && reportingPeriod && (
                    <Alert
                        type={status.alertType}
                        showIcon
                        message={
                            <Flex gap={8} align="center" wrap>
                                <span>Current field status</span>
                                <Tag color={status.color}>{status.label}</Tag>
                                {hasUnsavedChanges && (
                                    <Tag color="warning">UNSAVED CHANGES</Tag>
                                )}
                            </Flex>
                        }
                        description={status.description}
                    />
                )}
                <Typography.Text type="secondary">
                    Current scope: {voteScope === "all" ? "all Votes" : `${selectedVoteIds.length} selected Vote(s)`} and all {options.datasetDescription} for the selected version and period.
                </Typography.Text>
                <Flex>
                    <Button type="primary" loading={saving} onClick={saveRule}>
                        Save {section === "results" ? "Results" : "Actions"}{" "}
                        configuration
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
}
