import { Card, Group, Text, ActionIcon, Center, Stack } from "@mantine/core";
import { IconTrash, IconPencil, IconGripVertical } from "@tabler/icons-react";
import type { DragEventHandler } from "react";
import { PatternRule } from "../../ProjectData";
import { GridDisplay2D } from "../GridDisplay2D/GridDisplay2D";

interface PatternCardProps {
    id: string;
    rule: PatternRule;
    selected?: boolean;
    dragging?: boolean;
    dropIndicator?: "before" | "after" | null;
    onSelect?: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onDragStart?: DragEventHandler<HTMLButtonElement>;
    onDragEnd?: DragEventHandler<HTMLButtonElement>;
    onDragOver?: DragEventHandler<HTMLDivElement>;
    onDrop?: DragEventHandler<HTMLDivElement>;
}

export const PatternCard = ({
    id,
    rule,
    selected = false,
    dragging = false,
    dropIndicator = null,
    onSelect,
    onRename,
    onDelete,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
}: PatternCardProps) => {
    const handleRenameClick = () => {
        const newName = window.prompt("输入新的规则名称", id);
        if (!newName) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === id) return;
        onRename(trimmed);
    };

    const handleDeleteClick = () => {
        const confirmed = window.confirm(`确认删除规则「${id}」吗？`);
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
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
                cursor: "pointer",
                opacity: dragging ? 0.55 : 1,
                borderColor: selected
                    ? "var(--mantine-color-blue-4)"
                    : undefined,
                borderTopColor:
                    dropIndicator === "before"
                        ? "var(--mantine-color-blue-4)"
                        : undefined,
                borderBottomColor:
                    dropIndicator === "after"
                        ? "var(--mantine-color-blue-4)"
                        : undefined,
                borderTopWidth: dropIndicator === "before" ? 2 : undefined,
                borderBottomWidth: dropIndicator === "after" ? 2 : undefined,
                transition: "opacity 120ms ease, border-color 120ms ease",
            }}
        >
            <Group justify="space-between" align="stretch" wrap="nowrap">
                <Group gap="xs" align="flex-start" wrap="nowrap">
                    <ActionIcon
                        variant="subtle"
                        size="xs"
                        color="gray"
                        draggable={true}
                        title="拖拽调整顺序"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    >
                        <IconGripVertical size={14} />
                    </ActionIcon>
                    <Stack gap={4}>
                        <Text
                            size="sm"
                            ff="monospace"
                            fw={700}
                            c={selected ? "blue.1" : "blue.4"}
                            style={{ wordBreak: "break-all" }}
                        >
                            {id}
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
                </Group>
                <Center w={50} h={50} flex="0 0 auto">
                    <GridDisplay2D width={rule.width} data={rule.pattern} />
                </Center>
            </Group>
        </Card>
    );
};
