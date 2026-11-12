import { useQueryClient } from "@tanstack/react-query";
import type { TreeSelectProps } from "antd";
import { Form, TreeSelect } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { orderBy } from "lodash";
import React, { useMemo, useState } from "react";
import { db } from "../db";
import {
    orgUnitHierarchyQueryOptions,
    orgUnitQueryOptions,
} from "../query-options";
import type { OrgUnit } from "../types";
import { RootRoute } from "../routes/__root";

export function OrgUnitSelect({
    disabled,
    onChange,
    value,
    isMulti,
    showFormItem = true,
    label = "Vote",
}: {
    value: string | string[] | undefined;
    onChange: (newValue: string | string[] | undefined) => void;
    isMulti?: boolean;
    disabled?: boolean;
    showFormItem?: boolean;
    label?: string;
}) {
    const [searchValue, setSearchValue] = useState<string>("");

    const { engine } = RootRoute.useRouteContext();
    const { ou: defaultOrgUnit } = RootRoute.useLoaderData();
    const queryClient = useQueryClient();
    const organisationUnits = useLiveQuery(() => db.dataViewOrgUnits.toArray());
    const [expandedKeys, setExpandedKeys] = useState<Array<string | number>>([]);
    const [isHydratingTree, setIsHydratingTree] = useState(false);
    const hydratedRootsRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        if (!defaultOrgUnit) return;
        void queryClient.ensureQueryData(
            orgUnitQueryOptions(defaultOrgUnit, engine),
        );
    }, [defaultOrgUnit, engine, queryClient]);

    React.useEffect(() => {
        const selectedIds = Array.isArray(value)
            ? value.filter((id): id is string => Boolean(id))
            : value
              ? [value]
              : [];
        const knownIds = new Set(
            (organisationUnits ?? []).map((orgUnit) => orgUnit.id),
        );
        const missingIds = selectedIds.filter((id) => !knownIds.has(id));

        if (missingIds.length === 0) return;

        let cancelled = false;
        const flattenTree = (nodes: OrgUnit[]): OrgUnit[] =>
            nodes.flatMap(({ children, ...node }) => [
                node as OrgUnit,
                ...flattenTree(children ?? []),
            ]);

        void (async () => {
            setIsHydratingTree(true);
            try {
                for (const selectedId of missingIds) {
                    const hierarchy = await queryClient.ensureQueryData(
                        orgUnitHierarchyQueryOptions(engine, selectedId),
                    );
                    if (!cancelled && hierarchy.length > 0) {
                        await db.dataViewOrgUnits.bulkPut(flattenTree(hierarchy));
                    }
                }
            } catch {
                // Keep the filter usable when metadata cannot be refreshed.
                // The report error boundary handles broader network failures.
            } finally {
                if (!cancelled) setIsHydratingTree(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [engine, organisationUnits, queryClient, value]);

    React.useEffect(() => {
        const rootOrgUnits =
            organisationUnits?.filter((orgUnit) => !orgUnit.pId) ?? [];
        const pendingRoots = rootOrgUnits.filter(
            ({ id }) => !hydratedRootsRef.current.has(id),
        );

        if (pendingRoots.length === 0) {
            return;
        }

        let isCancelled = false;
        setIsHydratingTree(true);

        const hydrateBranch = async (orgUnitId: string): Promise<void> => {
            if (isCancelled) {
                return;
            }

            await queryClient.ensureQueryData(orgUnitQueryOptions(orgUnitId, engine));
            const children =
                (await db.dataViewOrgUnits.where("pId").equals(orgUnitId).toArray()) ??
                [];

            for (const child of children) {
                if (isCancelled || child.isLeaf) {
                    continue;
                }
                await hydrateBranch(child.id);
            }
        };

        void (async () => {
            try {
                for (const rootOrgUnit of pendingRoots) {
                    await hydrateBranch(rootOrgUnit.id);
                    hydratedRootsRef.current.add(rootOrgUnit.id);
                }
            } finally {
                if (!isCancelled) {
                    setIsHydratingTree(false);
                }
            }
        })();

        return () => {
            isCancelled = true;
        };
    }, [engine, organisationUnits, queryClient]);

    const onLoadData: TreeSelectProps["loadData"] = async ({ value }) => {
        if (value) {
            await queryClient.ensureQueryData(
                orgUnitQueryOptions(value.toString(), engine),
            );
        }
    };

    const filteredTreeData = useMemo(() => {
        if (!organisationUnits) {
            return organisationUnits;
        }

        const selectedIds = new Set(
            Array.isArray(value)
                ? value.filter(
                      (currentValue): currentValue is string =>
                          typeof currentValue === "string" &&
                          currentValue.trim().length > 0,
                  )
                : typeof value === "string" && value.trim().length > 0
                  ? [value]
                  : [],
        );

        if (!searchValue.trim()) {
            return organisationUnits;
        }

        const searchLower = searchValue.toLowerCase();
        const matchingIds = new Set<string>();
        const orgUnitMap = new Map(
            organisationUnits.map((orgUnit) => [orgUnit.id, orgUnit]),
        );
        const matchingNodes = organisationUnits.filter((node) =>
            node.title.toLowerCase().includes(searchLower),
        );

        const addAncestors = (orgUnitId: string) => {
            let currentParentId = orgUnitMap.get(orgUnitId)?.pId;
            while (currentParentId) {
                matchingIds.add(currentParentId);
                currentParentId = orgUnitMap.get(currentParentId)?.pId;
            }
        };

        const addDescendants = (parentId: string) => {
            const children = organisationUnits.filter((node) => node.pId === parentId);
            children.forEach((child) => {
                matchingIds.add(child.id);
                addDescendants(child.id);
            });
        };

        matchingNodes.forEach((node) => {
            matchingIds.add(node.id);
            addAncestors(node.id);
            addDescendants(node.id);
        });

        selectedIds.forEach((selectedId) => {
            if (orgUnitMap.has(selectedId)) {
                matchingIds.add(selectedId);
                addAncestors(selectedId);
            }
        });

        return organisationUnits.filter((node) => matchingIds.has(node.id));
    }, [organisationUnits, searchValue, value]);

    const handleSearch = (value: string): void => {
        setSearchValue(value);
    };

    const handleChange = (newValue: string | string[] | undefined) => {
        setSearchValue("");
        onChange(newValue);
    };

    const autoExpandedKeys = useMemo(() => {
        if (!searchValue.trim()) {
            return expandedKeys;
        }

        return Array.from(
            new Set(
                (filteredTreeData ?? [])
                    .map((orgUnit) => orgUnit.pId)
                    .filter((key): key is string => Boolean(key)),
            ),
        );
    }, [expandedKeys, filteredTreeData, searchValue]);

    const selectedIds = Array.isArray(value)
        ? value.filter((id): id is string => Boolean(id))
        : value
          ? [value]
          : [];
    const knownIds = new Set(
        (organisationUnits ?? []).map((orgUnit) => orgUnit.id),
    );
    const selectedLabelsReady = selectedIds.every((id) => knownIds.has(id));

    const select = (
        <TreeSelect
            disabled={disabled}
            treeDataSimpleMode
            showSearch
            allowClear
            style={{ width: "100%", flex: 1 }}
            value={selectedLabelsReady ? value : undefined}
            placeholder={
                selectedLabelsReady
                    ? "Please select"
                    : "Loading organisation unit..."
            }
            onChange={handleChange}
            loadData={onLoadData}
            treeData={orderBy(filteredTreeData, "title", "asc")}
            treeExpandedKeys={autoExpandedKeys}
            onTreeExpand={(keys) => setExpandedKeys(keys)}
            multiple={isMulti}
            filterTreeNode={false}
            onSearch={handleSearch}
            treeNodeLabelProp="title"
            treeDefaultExpandAll={Boolean(searchValue.trim())}
            loading={isHydratingTree}
        />
    );

    if (!showFormItem) {
        return select;
    }

    return (
        <Form.Item
            label={label}
            layout="horizontal"
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 20 }}
            labelAlign="left"
            style={{ width: "100%" }}
        >
            {select}
        </Form.Item>
    );
}
