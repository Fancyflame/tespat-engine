import { Card, Group, Text, ActionIcon } from "@mantine/core";
import { IconTrash, IconPencil } from "@tabler/icons-react";
import { DynamicGrid, CellState } from "../DynamicGrid/DynamicGrid";
import { PatternRule } from "../../ProjectData";

interface RuleCardProps {
    rule: PatternRule;
    onRename: (newName: string) => void;
    onDelete: () => void;
}

export const RuleCard = ({ rule, onRename, onDelete }: RuleCardProps) => {
    const handleRenameClick = () => {
        const newName = window.prompt("输入新的规则名称", rule.name);
        if (!newName) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === rule.name) return;
        onRename(trimmed);
    };

    const handleDeleteClick = () => {
        const confirmed = window.confirm(`确认删除规则「${rule.name}」吗？`);
        if (!confirmed) return;
        onDelete();
    };

    return (
        <Card withBorder padding="sm" radius="md" bg="gray.9">
            <Group justify="space-between" mb="xs">
                <Group gap={4}>
                    <Text size="xs" ff="monospace" fw={700} c="blue.4">
                        {rule.name}
                    </Text>
                    <ActionIcon
                        variant="subtle"
                        size="xs"
                        onClick={handleRenameClick}
                    >
                        <IconPencil size={12} />
                    </ActionIcon>
                </Group>
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={handleDeleteClick}
                >
                    <IconTrash size={12} />
                </ActionIcon>
            </Group>
            <DynamicGrid
                width={rule.width}
                height={rule.height}
                data={rule.pattern as unknown as CellState[]}
                cellSize={20}
            />
        </Card>
    );
};

