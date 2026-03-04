import {
    Card,
    Group,
    Text,
    ActionIcon,
    Center,
    Stack,
    Box,
} from "@mantine/core";
import { IconTrash, IconPencil } from "@tabler/icons-react";
import { PatternRule } from "../../ProjectData";
import { GridDisplay2D } from "../GridDisplay2D/GridDisplay2D";

interface PatternCardProps {
    rule: PatternRule;
    selected?: boolean;
    onSelect?: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
}

export const PatternCard = ({
    rule,
    selected = false,
    onSelect,
    onRename,
    onDelete,
}: PatternCardProps) => {
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
        <Card
            withBorder
            padding="sm"
            radius="md"
            bg={selected ? "blue.9" : "gray.9"}
            onClick={onSelect}
            style={{
                cursor: "pointer",
                borderColor: selected
                    ? "var(--mantine-color-blue-4)"
                    : undefined,
            }}
        >
            <Group justify="space-between" align="stretch" wrap="nowrap">
                <Stack gap={4} justify="space-between">
                    <Text
                        size="sm"
                        ff="monospace"
                        fw={700}
                        c={selected ? "blue.1" : "blue.4"}
                        style={{ wordBreak: "break-all" }}
                    >
                        {rule.name}
                    </Text>
                    <Group gap={4}>
                        <ActionIcon
                            variant="subtle"
                            size="xs"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleRenameClick();
                            }}
                        >
                            <IconPencil size={12} />
                        </ActionIcon>
                        <ActionIcon
                            variant="subtle"
                            color="red"
                            size="xs"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteClick();
                            }}
                        >
                            <IconTrash size={12} />
                        </ActionIcon>
                    </Group>
                </Stack>
                <Center w={100} h={70}>
                    <GridDisplay2D width={rule.width} data={rule.pattern} />
                </Center>
            </Group>
        </Card>
    );
};
