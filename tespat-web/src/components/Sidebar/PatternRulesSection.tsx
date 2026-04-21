import { useMemo, useState } from "react";
import { Stack, ActionIcon } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { getOrderedPatternIds, type PatternRule } from "../../ProjectData";
import { useWorkspace, useWorkspaceActions } from "../../Workspace";
import { PatternCard } from "./PatternCard";
import { SidebarPanel } from "./SidebarPanel";

type DropIndicator = {
    targetId: string;
    position: "before" | "after";
};

// PatternRulesSection 负责展示、排序与切换 pattern
export const PatternRulesSection = () => {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
        null,
    );

    const rules: Array<[string, PatternRule]> = useMemo(
        () =>
            getOrderedPatternIds(
                workspace.project.patternOrder,
                workspace.project.patterns,
            )
                .map((id) => {
                    const rule = workspace.project.patterns.get(id);
                    return rule ? ([id, rule] as const) : null;
                })
                .filter(
                    (entry): entry is [string, PatternRule] => entry !== null,
                ),
        [workspace.project.patternOrder, workspace.project.patterns],
    );

    return (
        <SidebarPanel
            title="PATTERNS"
            rightAction={
                <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        actions.createPattern();
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <Stack gap="xs">
                {rules.map(([id, rule]) => (
                    <PatternCard
                        key={id}
                        id={id}
                        rule={rule}
                        palette={workspace.project.palette}
                        selected={
                            workspace.viewMode === "editor" &&
                            workspace.selectedPatternId === id
                        }
                        dragging={draggingId === id}
                        dropIndicator={
                            dropIndicator?.targetId === id
                                ? dropIndicator.position
                                : null
                        }
                        onSelect={() => actions.selectPattern(id)}
                        onRename={(nextName) =>
                            actions.renamePattern(id, nextName)
                        }
                        onDelete={() => actions.deletePattern(id)}
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", id);
                            setDraggingId(id);
                            setDropIndicator(null);
                        }}
                        onDragEnd={() => {
                            setDraggingId(null);
                            setDropIndicator(null);
                        }}
                        onDragOver={(event) => {
                            if (!draggingId || draggingId === id) {
                                return;
                            }

                            event.preventDefault();
                            const bounds =
                                event.currentTarget.getBoundingClientRect();
                            const position =
                                event.clientY < bounds.top + bounds.height / 2
                                    ? "before"
                                    : "after";

                            setDropIndicator((prev) => {
                                if (
                                    prev?.targetId === id &&
                                    prev.position === position
                                ) {
                                    return prev;
                                }

                                return { targetId: id, position };
                            });
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (!draggingId || draggingId === id) {
                                setDropIndicator(null);
                                return;
                            }

                            const bounds =
                                event.currentTarget.getBoundingClientRect();
                            const position =
                                event.clientY < bounds.top + bounds.height / 2
                                    ? "before"
                                    : "after";

                            actions.movePattern(draggingId, id, position);
                            setDraggingId(null);
                            setDropIndicator(null);
                        }}
                    />
                ))}
            </Stack>
        </SidebarPanel>
    );
};
