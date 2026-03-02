import { Card, Group, Text, ActionIcon, Divider, Stack } from "@mantine/core";
import { IconTrash, IconPencil } from "@tabler/icons-react";
import { DynamicGrid, CellState } from "../DynamicGrid/DynamicGrid";
import { PatternRule } from "../../ProjectData";

interface PatternCardProps {
    rule: PatternRule;
    onRename: (newName: string) => void;
    onDelete: () => void;
}

export const PatternCard = ({ rule, onRename, onDelete }: PatternCardProps) => {
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
            <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={4}>
                    <Text
                        size="xs"
                        ff="monospace"
                        fw={700}
                        c="blue.4"
                        style={{ wordBreak: "break-all" }}
                    >
                        {rule.name}
                    </Text>
                    <Group gap={4}>
                        <ActionIcon
                            variant="subtle"
                            size="xs"
                            onClick={handleRenameClick}
                        >
                            <IconPencil size={12} />
                        </ActionIcon>
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            size="xs"
                            onClick={handleDeleteClick}
                        >
                            <IconTrash size={12} />
                        </ActionIcon>
                    </Group>
                </Stack>
                <DynamicGrid
                    width={rule.width}
                    height={rule.height}
                    data={rule.pattern as unknown as CellState[]}
                    cellSize={20}
                />
            </Group>
        </Card>
    );
};
