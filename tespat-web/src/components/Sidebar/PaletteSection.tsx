import { memo, useEffect, useMemo, useState } from "react";
import {
    ActionIcon,
    Box,
    Button,
    ColorPicker,
    ColorSwatch,
    Group,
    Popover,
    Stack,
    Text,
    TextInput,
} from "@mantine/core";
import {
    IconPhoto,
    IconPencil,
    IconPlus,
    IconTrash,
} from "@tabler/icons-react";
import type { PaletteEntry } from "../../ProjectData";
import { useWorkspace, useWorkspaceActions } from "../../Workspace";
import { CollapsibleSection } from "./CollapsibleSection";

type PaletteChipProps = {
    id: string;
    entry: PaletteEntry;
    selected: boolean;
    onSelect: (paletteId: string) => void;
    onRename: (paletteId: string, nextName: string) => boolean;
    onDelete: (paletteId: string) => boolean;
    onChangeColor: (paletteId: string, nextColor: string) => void;
    onChangeIcon: (paletteId: string, nextIcon: string | null) => void;
};

// PaletteSection 负责管理 palette 条目
export function PaletteSection() {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();

    const paletteItems = useMemo(
        () =>
            Array.from(workspace.project.palette.entries()).sort((left, right) =>
                left[0].localeCompare(right[0]),
            ),
        [workspace.project.palette],
    );

    return (
        <CollapsibleSection
            title="PALETTE"
            rightAction={
                <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        actions.createPalette();
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <Stack gap="xs" pt="xs">
                {paletteItems.length === 0 ? (
                    <Text size="xs" c="dimmed">
                        暂无 palette
                    </Text>
                ) : (
                    <Group gap="xs" wrap="wrap">
                        {paletteItems.map(([id, entry]) => (
                            <PaletteChip
                                key={id}
                                id={id}
                                entry={entry}
                                selected={workspace.selectedPaletteId === id}
                                onSelect={actions.setSelectedPaletteId}
                                onRename={actions.renamePalette}
                                onDelete={actions.deletePalette}
                                onChangeColor={actions.updatePaletteColor}
                                onChangeIcon={actions.updatePaletteIcon}
                            />
                        ))}
                    </Group>
                )}
            </Stack>
        </CollapsibleSection>
    );
}

// PaletteChip 负责展示并编辑单条 palette
const PaletteChip = memo(function PaletteChip({
    id,
    entry,
    selected,
    onSelect,
    onRename,
    onDelete,
    onChangeColor,
    onChangeIcon,
}: PaletteChipProps) {
    const [draftName, setDraftName] = useState(id);
    const [draftColor, setDraftColor] = useState(entry.color);
    const [draftIcon, setDraftIcon] = useState(entry.icon ?? "");

    useEffect(() => {
        setDraftName(id);
    }, [id]);

    useEffect(() => {
        setDraftColor(entry.color);
    }, [entry.color]);

    useEffect(() => {
        setDraftIcon(entry.icon ?? "");
    }, [entry.icon]);

    const commitName = () => {
        const succeeded = onRename(id, draftName);
        if (!succeeded) {
            setDraftName(id);
        }
    };

    const commitIcon = () => {
        onChangeIcon(id, draftIcon.trim() || null);
    };

    return (
        <Box
            onClick={() => onSelect(id)}
            style={{
                borderRadius: 999,
                border: selected
                    ? "1px solid rgba(15, 23, 42, 0.3)"
                    : "1px solid var(--mantine-color-gray-3)",
                backgroundColor: selected
                    ? "rgba(255, 255, 255, 0.9)"
                    : "transparent",
                padding: "6px 10px",
            }}
        >
            <Group gap={8} wrap="nowrap">
                <ColorSwatch color={entry.color} radius="sm" size={16} />
                <Text
                    size="xs"
                    c={selected ? "dark" : "dimmed"}
                    fw={600}
                    style={{ userSelect: "none" }}
                >
                    {id}
                </Text>
                {entry.icon && (
                    <Group gap={4} wrap="nowrap">
                        <IconPhoto size={12} />
                        <Text size="10px" c={selected ? "dark" : "dimmed"}>
                            ICON
                        </Text>
                    </Group>
                )}
                <Popover withinPortal={false} shadow="sm" trapFocus>
                    <Popover.Target>
                        <ActionIcon
                            variant="subtle"
                            size="xs"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <IconPencil size={12} />
                        </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown
                        onClick={(event) => event.stopPropagation()}
                        style={{ width: 260 }}
                    >
                        <Stack gap="sm">
                            <TextInput
                                label="名称"
                                size="xs"
                                value={draftName}
                                onChange={(event) =>
                                    setDraftName(event.currentTarget.value)
                                }
                                onBlur={commitName}
                            />
                            <Stack gap={6}>
                                <Text size="xs" fw={600}>
                                    颜色
                                </Text>
                                <ColorPicker
                                    value={draftColor}
                                    format="hex"
                                    fullWidth
                                    onChange={setDraftColor}
                                    onChangeEnd={(finalColor) =>
                                        onChangeColor(id, finalColor)
                                    }
                                />
                            </Stack>
                            <TextInput
                                label="Icon"
                                size="xs"
                                placeholder="image url or asset path"
                                value={draftIcon}
                                onChange={(event) =>
                                    setDraftIcon(event.currentTarget.value)
                                }
                                onBlur={commitIcon}
                            />
                            <Button
                                color="red"
                                variant="light"
                                size="xs"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => {
                                    if (onDelete(id)) {
                                        setDraftName(id);
                                    }
                                }}
                            >
                                删除 palette
                            </Button>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
            </Group>
        </Box>
    );
});
