import { memo, useEffect, useMemo, useState } from "react";
import {
    ActionIcon,
    Box,
    ColorPicker,
    Divider,
    Group,
    Popover,
    Stack,
    Text,
    TextInput,
} from "@mantine/core";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import type { PaletteEntry } from "../../ProjectData";
import { useWorkspace, useWorkspaceActions } from "../../Workspace";
import { PalettePreview } from "../GridDisplay2D/GridDisplay2D";
import { SidebarPanel } from "./SidebarPanel";
import styles from "./SidebarLayout.module.css";

const PALETTE_POPOVER_Z_INDEX = 500;

type PaletteListItemProps = {
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
            Array.from(workspace.project.palette.entries()).sort(
                (left, right) =>
                    left[0].localeCompare(right[0], undefined, {
                        sensitivity: "accent",
                    }),
            ),
        [workspace.project.palette],
    );

    return (
        <SidebarPanel
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
            <Stack gap="xs">
                {paletteItems.length === 0 ? (
                    <Text size="xs" c="dimmed">
                        暂无 palette
                    </Text>
                ) : (
                    <Stack gap={0} className={styles.paletteList}>
                        {paletteItems.map(([id, entry], index) => (
                            <Box key={id}>
                                <PaletteListItem
                                    id={id}
                                    entry={entry}
                                    selected={
                                        workspace.selectedPaletteId === id
                                    }
                                    onSelect={actions.setSelectedPaletteId}
                                    onRename={actions.renamePalette}
                                    onDelete={actions.deletePalette}
                                    onChangeColor={actions.updatePaletteColor}
                                    onChangeIcon={actions.updatePaletteIcon}
                                />
                                {index < paletteItems.length - 1 ? (
                                    <Divider />
                                ) : null}
                            </Box>
                        ))}
                    </Stack>
                )}
            </Stack>
        </SidebarPanel>
    );
}

// PaletteListItem 负责展示并编辑单条 palette
const PaletteListItem = memo(function PaletteListItem({
    id,
    entry,
    selected,
    onSelect,
    onRename,
    onDelete,
    onChangeColor,
    onChangeIcon,
}: PaletteListItemProps) {
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

    const handleDelete = () => {
        const confirmed = window.confirm(`确认删除 palette「${id}」吗？`);
        if (!confirmed) {
            return;
        }

        onDelete(id);
    };

    const rowClassName = [
        styles.paletteRow,
        selected && styles.paletteRowSelected,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Box
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                    return;
                }

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(id);
                }
            }}
            className={rowClassName}
        >
            <Box className={styles.paletteRowPreview}>
                <PalettePreview entry={entry} size={18} borderRadius={4} />
            </Box>
            <Text size="xs" fw={600} className={styles.paletteRowName}>
                {id}
            </Text>
            <Group gap={4}>
                <Popover
                    withinPortal={true}
                    zIndex={PALETTE_POPOVER_Z_INDEX}
                    shadow="sm"
                    trapFocus
                >
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
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        commitName();
                                    }
                                }}
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
                                description="使用 Tabler icon 的 kebab-case 名称"
                                placeholder="e.g. door, tree, arrow-right"
                                value={draftIcon}
                                onChange={(event) =>
                                    setDraftIcon(event.currentTarget.value)
                                }
                                onBlur={commitIcon}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        commitIcon();
                                    }
                                }}
                            />
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleDelete();
                    }}
                >
                    <IconTrash size={12} />
                </ActionIcon>
            </Group>
        </Box>
    );
});
