import { useMemo } from "react";
import { Stack, ActionIcon, ScrollArea } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { PatternRule, useProject } from "../../ProjectData";
import { useEditor } from "../../EditorData";
import { PatternCard } from "./PatternCard";
import { CollapsibleSection } from "./CollapsibleSection";

export const PatternRulesSection = () => {
    const { project, setProject } = useProject();
    const { editor, setEditor } = useEditor();

    const rules: Array<[string, PatternRule]> = useMemo(
        () => Array.from(project.patterns.entries()),
        [project.patterns],
    );

    const handleRenameRule = (id: string, newName: string) => {
        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            const rule = patterns.get(id);
            if (!rule) return prev;
            patterns.set(id, { ...rule, name: newName });
            return { ...prev, patterns };
        });
    };

    const handleDeleteRule = (id: string) => {
        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            if (!patterns.has(id)) return prev;
            patterns.delete(id);
            return { ...prev, patterns };
        });
        setEditor((prev) => {
            if (prev.selectedPatternId !== id) return prev;
            return {
                ...prev,
                selectedPatternId: null,
                enableEdit: false,
            };
        });
    };

    const handleSelectRule = (id: string) => {
        const rule = project.patterns.get(id);
        if (!rule) return;
        setEditor((prev) => ({
            ...prev,
            selectedPatternId: id,
            editingGrid: {
                width: rule.width,
                data: rule.pattern,
            },
            enableEdit: true,
            displayMode: "editor",
        }));
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
                        // TODO: 新增规则逻辑
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <ScrollArea offsetScrollbars flex={1}>
                <Stack gap="md">
                    {rules.map(([id, rule]) => (
                        <PatternCard
                            key={id}
                            rule={rule}
                            selected={editor.selectedPatternId === id}
                            onSelect={() => handleSelectRule(id)}
                            onRename={(newName) =>
                                handleRenameRule(id, newName)
                            }
                            onDelete={() => handleDeleteRule(id)}
                        />
                    ))}
                </Stack>
            </ScrollArea>
        </CollapsibleSection>
    );
};
