import { useMemo, useState } from "react";
import { Stack, ActionIcon } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { PatternRule, clonePatternRule, useProject } from "../../ProjectData";
import { useEditor, getSelectedPatternId } from "../../EditorData";
import { PatternCard } from "./PatternCard";
import { CollapsibleSection } from "./CollapsibleSection";

type DropIndicator = {
    targetId: string;
    position: "before" | "after";
};

const getOrderedPatternIds = (
    patternOrder: string[],
    patterns: Map<string, PatternRule>,
) => {
    const orderedIds: string[] = [];
    const seen = new Set<string>();

    for (const id of patternOrder) {
        if (!patterns.has(id) || seen.has(id)) continue;
        seen.add(id);
        orderedIds.push(id);
    }

    for (const id of patterns.keys()) {
        if (seen.has(id)) continue;
        seen.add(id);
        orderedIds.push(id);
    }

    return orderedIds;
};

export const PatternRulesSection = () => {
    const { project, setProject } = useProject();
    const { editor, setEditor } = useEditor();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
        null,
    );

    const rules: Array<[string, PatternRule]> = useMemo(
        () =>
            getOrderedPatternIds(project.patternOrder, project.patterns)
                .map((id) => {
                    const rule = project.patterns.get(id);
                    return rule ? ([id, rule] as const) : null;
                })
                .filter(
                    (entry): entry is [string, PatternRule] => entry !== null,
                ),
        [project.patternOrder, project.patterns],
    );

    const handleRenameRule = (id: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === id) return;
        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            const rule = patterns.get(id);
            if (!rule) return prev;
            if (patterns.has(trimmed) && trimmed !== id) return prev;
            patterns.delete(id);
            patterns.set(trimmed, clonePatternRule(rule));
            const patternOrder = prev.patternOrder.includes(id)
                ? prev.patternOrder.map((patternId) =>
                      patternId === id ? trimmed : patternId,
                  )
                : [...prev.patternOrder, trimmed];
            return { ...prev, patterns, patternOrder };
        });
        setEditor((prev) => {
            if (getSelectedPatternId(prev.displayMode) !== id) return prev;
            return {
                ...prev,
                displayMode: { mode: "editor", selectedPatternId: trimmed },
            };
        });
    };

    const handleDeleteRule = (id: string) => {
        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            if (!patterns.has(id)) return prev;
            patterns.delete(id);
            const patternOrder = prev.patternOrder.filter(
                (patternId) => patternId !== id,
            );
            return { ...prev, patterns, patternOrder };
        });
        setEditor((prev) => {
            if (getSelectedPatternId(prev.displayMode) !== id) return prev;
            return {
                ...prev,
                enableEdit: false,
                displayMode: { mode: "welcome" },
            };
        });
    };

    const handleSelectRule = (id: string) => {
        const rule = project.patterns.get(id);
        if (!rule) return;
        setEditor((prev) => ({
            ...prev,
            editingRule: clonePatternRule(rule),
            enableEdit: true,
            displayMode: { mode: "editor", selectedPatternId: id },
        }));
    };

    const handleCreateRule = () => {
        const existingIds = new Set(project.patterns.keys());

        let index = 0;
        let newId = "_NewPattern";

        while (existingIds.has(newId)) {
            index += 1;
            newId = `_NewPattern${index}`;
        }

        const newRule: PatternRule = {
            width: 0,
            capture: [],
            replace: [],
        };

        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            patterns.set(newId, clonePatternRule(newRule));
            return {
                ...prev,
                patterns,
                patternOrder: [...prev.patternOrder, newId],
            };
        });

        setEditor((prev) => ({
            ...prev,
            editingRule: clonePatternRule(newRule),
            enableEdit: true,
            displayMode: { mode: "editor", selectedPatternId: newId },
        }));
    };

    const handleMoveRule = (
        sourceId: string,
        targetId: string,
        position: "before" | "after",
    ) => {
        if (sourceId === targetId) return;

        setProject((prev) => {
            const orderedIds = getOrderedPatternIds(
                prev.patternOrder,
                prev.patterns,
            );
            if (!orderedIds.includes(sourceId) || !orderedIds.includes(targetId)) {
                return prev;
            }

            const nextPatternOrder = orderedIds.filter((id) => id !== sourceId);
            const insertIndex = nextPatternOrder.indexOf(targetId);

            if (insertIndex < 0) return prev;

            nextPatternOrder.splice(
                position === "before" ? insertIndex : insertIndex + 1,
                0,
                sourceId,
            );

            const unchanged =
                nextPatternOrder.length === prev.patternOrder.length &&
                nextPatternOrder.every(
                    (patternId, index) => patternId === prev.patternOrder[index],
                );

            if (unchanged) return prev;

            return { ...prev, patternOrder: nextPatternOrder };
        });
    };

    return (
        <CollapsibleSection
            title="PATTERNS"
            rightAction={
                <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleCreateRule();
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
                        selected={
                            getSelectedPatternId(editor.displayMode) === id
                        }
                        dragging={draggingId === id}
                        dropIndicator={
                            dropIndicator?.targetId === id
                                ? dropIndicator.position
                                : null
                        }
                        onSelect={() => handleSelectRule(id)}
                        onRename={(newName) => handleRenameRule(id, newName)}
                        onDelete={() => handleDeleteRule(id)}
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
                            if (!draggingId || draggingId === id) return;
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

                            handleMoveRule(draggingId, id, position);
                            setDraggingId(null);
                            setDropIndicator(null);
                        }}
                    />
                ))}
            </Stack>
        </CollapsibleSection>
    );
};
