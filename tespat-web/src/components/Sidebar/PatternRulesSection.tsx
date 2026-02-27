import { useMemo } from "react";
import { Stack, ActionIcon, ScrollArea } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { PatternRule, useProject } from "../../ProjectData";
import { RuleCard } from "./RuleCard";
import { CollapsibleSection } from "./CollapsibleSection";

export const PatternRulesSection = () => {
    const { project, setProject } = useProject();

    const rules: Array<[string, PatternRule]> = useMemo(
        () => Array.from(project.patterns.entries()),
        [project.patterns]
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
    };

    return (
        <CollapsibleSection
            title="PATTERN RULES"
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
                        <RuleCard
                            key={id}
                            rule={rule}
                            onRename={(newName) => handleRenameRule(id, newName)}
                            onDelete={() => handleDeleteRule(id)}
                        />
                    ))}
                </Stack>
            </ScrollArea>
        </CollapsibleSection>
    );
}

