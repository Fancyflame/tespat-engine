import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ROOT_NAMESPACE_ID,
    getNamespaceDepth,
    getNamespaceDescendantIds,
    getNamespaceLastSegment,
    getSortedNamespaceIds,
} from "../../ProjectData";
import { useWorkspace, useWorkspaceActions } from "../../Workspace";
import { SidebarPanel } from "./SidebarPanel";

// SidebarNamespacesTab 承载命名空间结构树页
export const SidebarNamespacesTab = () => {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const selectedNamespaceId = workspace.project.namespaces.has(
        workspace.selectedNamespaceId,
    )
        ? workspace.selectedNamespaceId
        : ROOT_NAMESPACE_ID;
    const namespaceIds = getSortedNamespaceIds(workspace.project.namespaces);

    const handleCreateNamespace = () => {
        const parentLabel =
            selectedNamespaceId === ROOT_NAMESPACE_ID
                ? "."
                : selectedNamespaceId;
        const input = window.prompt(
            `在命名空间 ${parentLabel} 下创建子命名空间，请输入名称段（字母/数字/下划线）`,
            "",
        );
        if (!input) {
            return;
        }

        actions.createNamespace(selectedNamespaceId, input);
    };

    const handleRenameNamespace = () => {
        if (selectedNamespaceId === ROOT_NAMESPACE_ID) {
            window.alert('根命名空间 "." 不可重命名');
            return;
        }

        const currentSegment = getNamespaceLastSegment(selectedNamespaceId);
        const input = window.prompt(
            `重命名命名空间 ${selectedNamespaceId}，请输入新名称段`,
            currentSegment,
        );
        if (!input) {
            return;
        }

        actions.renameNamespace(selectedNamespaceId, input);
    };

    const handleDeleteNamespace = () => {
        if (selectedNamespaceId === ROOT_NAMESPACE_ID) {
            window.alert('根命名空间 "." 不可删除');
            return;
        }

        const childNamespaces = getNamespaceDescendantIds(
            workspace.project.namespaces,
            selectedNamespaceId,
            false,
        );
        const hasChildren = childNamespaces.length > 0;
        const confirmMessage = hasChildren
            ? `确认删除命名空间「${selectedNamespaceId}」吗？\n该操作会级联删除 ${childNamespaces.length} 个子命名空间，且不可恢复。`
            : `确认删除命名空间「${selectedNamespaceId}」吗？该操作不可恢复。`;

        if (!window.confirm(confirmMessage)) {
            return;
        }

        actions.deleteNamespace(selectedNamespaceId);
    };

    return (
        <SidebarPanel
            title="NAMESPACES"
            withHorizontalScrollbar
            rightAction={
                <div className="flex items-center gap-1">
                    <Button
                        variant="subtle"
                        size="icon-sm"
                        className="rounded-lg"
                        aria-label="新建命名空间"
                        title="新建命名空间"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleCreateNamespace();
                        }}
                    >
                        <IconPlus size={14} />
                    </Button>
                    <Button
                        variant="subtle"
                        size="icon-sm"
                        className="rounded-lg"
                        aria-label="重命名命名空间"
                        title="重命名命名空间"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleRenameNamespace();
                        }}
                    >
                        <IconPencil size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-lg text-red-200 hover:bg-red-500/16"
                        aria-label="删除命名空间"
                        title="删除命名空间"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteNamespace();
                        }}
                    >
                        <IconTrash size={14} />
                    </Button>
                </div>
            }
        >
            <div className="min-w-full w-max space-y-1">
                {namespaceIds.map((namespaceId) => {
                    const selected = namespaceId === selectedNamespaceId;
                    const depth = getNamespaceDepth(namespaceId);
                    const label =
                        namespaceId === ROOT_NAMESPACE_ID
                            ? "."
                            : getNamespaceLastSegment(namespaceId);

                    return (
                        <div
                            key={namespaceId}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            className={cn(
                                "flex min-h-7 min-w-full w-max cursor-pointer items-center rounded-md pr-2 text-xs font-semibold transition-colors outline-none select-none hover:bg-blue-400/24 focus-visible:ring-2 focus-visible:ring-blue-400/55",
                                selected
                                    ? "bg-app-accent-soft text-white"
                                    : "text-slate-300",
                            )}
                            style={{
                                paddingLeft: `${8 + depth * 16}px`,
                            }}
                            onClick={() =>
                                actions.selectNamespace(namespaceId)
                            }
                            onKeyDown={(event) => {
                                if (event.target !== event.currentTarget) {
                                    return;
                                }

                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    actions.selectNamespace(namespaceId);
                                }
                            }}
                        >
                            <span className="whitespace-nowrap">
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </SidebarPanel>
    );
};
