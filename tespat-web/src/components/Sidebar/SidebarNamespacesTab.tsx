import { useState, type DragEvent } from "react";
import {
    IconGripVertical,
    IconPencil,
    IconPlus,
    IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ROOT_NAMESPACE_ID,
    getNamespaceDepth,
    getNamespaceDescendantIds,
    getNamespaceLastSegment,
    getSortedNamespaceIds,
    isNamespaceDescendant,
} from "../../ProjectData";
import {
    type NamespaceDropPlacement,
    useWorkspace,
    useWorkspaceActions,
} from "../../Workspace";
import { SidebarPanel } from "./SidebarPanel";

// 当前拖拽悬停的命名空间落点
type NamespaceDropTarget = {
    targetId: string;
    placement: NamespaceDropPlacement;
};

// 根据横向位置解析当前落点语义
function resolveDropPlacement(
    event: DragEvent<HTMLDivElement>,
    namespaceId: string,
): NamespaceDropPlacement | null {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;

    if (offsetX < bounds.width / 3) {
        return namespaceId === ROOT_NAMESPACE_ID ? null : "after-sibling";
    }

    return "first-child";
}

// SidebarNamespacesTab 承载命名空间结构树页
export const SidebarNamespacesTab = () => {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<NamespaceDropTarget | null>(
        null,
    );
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
                    const dragEnabled = namespaceId !== ROOT_NAMESPACE_ID;
                    const isDropAfter =
                        dropTarget?.targetId === namespaceId &&
                        dropTarget.placement === "after-sibling";
                    const isDropChild =
                        dropTarget?.targetId === namespaceId &&
                        dropTarget.placement === "first-child";

                    return (
                        <div
                            key={namespaceId}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            className={cn(
                                "relative flex min-h-7 min-w-full w-max cursor-pointer items-center rounded-md pr-2 text-xs font-semibold transition-colors outline-none select-none hover:bg-blue-400/24 focus-visible:ring-2 focus-visible:ring-blue-400/55",
                                selected
                                    ? "bg-app-accent-soft text-white"
                                    : "text-slate-300",
                                draggingId === namespaceId && "opacity-55",
                                isDropChild && "bg-blue-500/10",
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
                            onDragOver={(event) => {
                                if (
                                    !draggingId ||
                                    draggingId === namespaceId ||
                                    isNamespaceDescendant(namespaceId, draggingId)
                                ) {
                                    if (dropTarget?.targetId === namespaceId) {
                                        setDropTarget(null);
                                    }
                                    return;
                                }

                                const placement = resolveDropPlacement(
                                    event,
                                    namespaceId,
                                );
                                if (!placement) {
                                    if (dropTarget?.targetId === namespaceId) {
                                        setDropTarget(null);
                                    }
                                    return;
                                }

                                event.preventDefault();
                                setDropTarget((prev) => {
                                    if (
                                        prev?.targetId === namespaceId &&
                                        prev.placement === placement
                                    ) {
                                        return prev;
                                    }

                                    return {
                                        targetId: namespaceId,
                                        placement,
                                    };
                                });
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (
                                    !draggingId ||
                                    draggingId === namespaceId ||
                                    isNamespaceDescendant(namespaceId, draggingId)
                                ) {
                                    setDropTarget(null);
                                    return;
                                }

                                const placement = resolveDropPlacement(
                                    event,
                                    namespaceId,
                                );
                                if (!placement) {
                                    setDropTarget(null);
                                    return;
                                }

                                actions.moveNamespace(
                                    draggingId,
                                    namespaceId,
                                    placement,
                                );
                                setDraggingId(null);
                                setDropTarget(null);
                            }}
                        >
                            {isDropAfter ? (
                                <div
                                    className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-blue-400"
                                    style={{
                                        left: `${8 + depth * 16}px`,
                                        right: "8px",
                                    }}
                                />
                            ) : null}
                            {isDropChild ? (
                                <>
                                    <div
                                        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-sky-300"
                                        style={{
                                            left: `${8 + (depth + 1) * 16}px`,
                                            right: "8px",
                                        }}
                                    />
                                    <div
                                        className="pointer-events-none absolute bottom-[-3px] size-2 rounded-full bg-sky-300"
                                        style={{
                                            left: `${4 + (depth + 1) * 16}px`,
                                        }}
                                    />
                                </>
                            ) : null}
                            <div className="flex min-w-0 items-center gap-1">
                                {dragEnabled ? (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="size-5 rounded-md text-slate-500 hover:text-blue-200"
                                        draggable={true}
                                        title="拖拽调整命名空间"
                                        onMouseDown={(event) =>
                                            event.stopPropagation()
                                        }
                                        onClick={(event) => event.stopPropagation()}
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed = "move";
                                            event.dataTransfer.setData(
                                                "text/plain",
                                                namespaceId,
                                            );
                                            setDraggingId(namespaceId);
                                            setDropTarget(null);
                                        }}
                                        onDragEnd={() => {
                                            setDraggingId(null);
                                            setDropTarget(null);
                                        }}
                                    >
                                        <IconGripVertical size={12} />
                                    </Button>
                                ) : null}
                                <span className="whitespace-nowrap">
                                    {label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </SidebarPanel>
    );
};
