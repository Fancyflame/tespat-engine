import { useMemo, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { PatternRule } from "../../ProjectData";
import {
    useWorkspace,
    useWorkspaceActions,
    useWorkspaceNamespace,
} from "../../Workspace";
import { PatternCard } from "./PatternCard";
import { SidebarPanel } from "./SidebarPanel";

type DropIndicator = {
    targetId: string;
    position: "before" | "after";
};

// PatternRulesSection 负责展示、排序与切换 pattern
export const PatternRulesSection = () => {
    const workspace = useWorkspace();
    const namespace = useWorkspaceNamespace();
    const actions = useWorkspaceActions();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
        null,
    );

    const rules: Array<[string, PatternRule]> = useMemo(
        () => Array.from(namespace.patterns.entries()),
        [namespace.patterns],
    );

    return (
        <SidebarPanel
            title="PATTERNS"
            rightAction={
                <Button
                    variant="subtle"
                    size="icon-sm"
                    className="rounded-lg"
                    onClick={(event) => {
                        event.stopPropagation();
                        actions.createPattern();
                    }}
                >
                    <IconPlus size={14} />
                </Button>
            }
        >
            <div className="w-full min-w-0 space-y-2">
                {rules.map(([id, rule]) => (
                    <PatternCard
                        key={id}
                        id={id}
                        rule={rule}
                        palette={namespace.palette}
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
            </div>
        </SidebarPanel>
    );
};
