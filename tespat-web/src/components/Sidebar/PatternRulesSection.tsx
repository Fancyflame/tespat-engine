import { useMemo } from "react";
import { Stack, ActionIcon } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { PatternRule, useProject } from "../../ProjectData";
import { useEditor, getSelectedPatternId } from "../../EditorData";
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
            editingGrid: {
                width: rule.width,
                data: rule.pattern,
            },
            enableEdit: true,
            displayMode: { mode: "editor", selectedPatternId: id },
        }));
    };

    const handleCreateRule = () => {
        const existingNames = new Set(
            Array.from(project.patterns.values()).map((rule) => rule.name),
        );
        const existingIds = new Set(project.patterns.keys());

        let index = 0;
        let newName = "_NewPattern";
        let newId = "_NewPattern";

        while (existingNames.has(newName) || existingIds.has(newId)) {
            index += 1;
            newName = `_NewPattern${index}`;
            newId = `_NewPattern${index}`;
        }

        const newRule: PatternRule = {
            name: newName,
            width: 0,
            pattern: [],
        };

        setProject((prev) => {
            const patterns = new Map(prev.patterns);
            patterns.set(newId, newRule);
            return { ...prev, patterns };
        });

        setEditor((prev) => ({
            ...prev,
            editingGrid: {
                width: 0,
                data: [],
            },
            enableEdit: true,
            displayMode: { mode: "editor", selectedPatternId: newId },
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
                        handleCreateRule();
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <Stack gap="md">
                {rules.map(([id, rule]) => (
                    <PatternCard
                        key={id}
                        rule={rule}
                        selected={getSelectedPatternId(editor.displayMode) === id}
                        onSelect={() => handleSelectRule(id)}
                        onRename={(newName) => handleRenameRule(id, newName)}
                        onDelete={() => handleDeleteRule(id)}
                    />
                ))}
            </Stack>
        </CollapsibleSection>
    );
};
