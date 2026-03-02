import { useMemo, useState, useEffect, memo } from "react";
import {
    ActionIcon,
    Group,
    Stack,
    Text,
    UnstyledButton,
    Popover,
    ColorSwatch,
    ColorPicker,
    Box,
} from "@mantine/core";
import { CollapsibleSection } from "./CollapsibleSection";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { useProject } from "../../ProjectData";
import { useEditor } from "../../EditorData";

export function CellSection() {
    const { project, setProject } = useProject();
    const { editor, setEditor } = useEditor();

    const cells = useMemo(
        () =>
            Array.from(project.cellDisplay.entries()).sort((a, b) =>
                a[0].localeCompare(b[0]),
            ),
        [project.cellDisplay],
    );

    const cellActions = useMemo(
        () => ({
            onChangeColor: (unitName: string, nextColor: string) => {
                setProject((prev) => {
                    const cellDisplay = new Map(prev.cellDisplay);
                    cellDisplay.set(unitName, nextColor);
                    return { ...prev, cellDisplay };
                });
            },
            onDelete: (unitName: string) => {
                setProject((prev) => {
                    const cellDisplay = new Map(prev.cellDisplay);
                    cellDisplay.delete(unitName);
                    return { ...prev, cellDisplay };
                });
            },
            onRename: (oldName: string, newName: string) => {
                const trimmed = newName.trim();
                if (!trimmed || trimmed === oldName) return;

                if (
                    !project.cellDisplay.has(oldName) ||
                    project.cellDisplay.has(trimmed)
                ) {
                    return;
                }
                const color = project.cellDisplay.get(oldName);
                if (color === undefined) return;

                setProject((prev) => {
                    const cellDisplay = new Map(prev.cellDisplay);
                    cellDisplay.delete(oldName);
                    cellDisplay.set(trimmed, color);
                    return { ...prev, cellDisplay };
                });
                setEditor((prev) => ({ ...prev, selectedCell: trimmed }));
            },
            onSelect: (unitName: string) => {
                setEditor((prev) => ({ ...prev, selectedCell: unitName }));
            },
        }),
        [project.cellDisplay, setEditor, setProject],
    );

    const createNewCell = () => {
        const baseName = "_NewCell";
        let index = 0;
        let candidate = baseName;
        while (project.cellDisplay.has(candidate)) {
            index += 1;
            candidate = `${baseName}${index}`;
        }

        setProject((prev) => {
            const cellDisplay = new Map(prev.cellDisplay);
            cellDisplay.set(candidate, "#ffffff");

            return {
                ...prev,
                cellDisplay,
            };
        });
        setEditor((prev) => ({ ...prev, selectedCell: candidate }));
    };

    return (
        <CollapsibleSection
            title="CELLS"
            rightAction={
                <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        createNewCell();
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <Stack gap="xs" pt="xs">
                {cells.length === 0 ? (
                    <Text size="xs" c="dimmed">
                        暂无单位
                    </Text>
                ) : (
                    <Group gap="xs" wrap="wrap">
                        {cells.map(([unitName, color]) => (
                            <CellUnitCapsule
                                key={unitName}
                                name={unitName}
                                color={color}
                                selected={editor.selectedCell === unitName}
                                actions={cellActions}
                            />
                        ))}
                    </Group>
                )}
            </Stack>
        </CollapsibleSection>
    );
}

type CellUnitCapsuleProps = {
    name: string;
    color: string;
    selected: boolean;
    actions: {
        onChangeColor: (unitName: string, nextColor: string) => void;
        onDelete: (unitName: string) => void;
        onRename: (oldName: string, newName: string) => void;
        onSelect: (unitName: string) => void;
    };
};

const CellUnitCapsule = memo(function CellUnitCapsule({
    name,
    color,
    selected,
    actions,
}: CellUnitCapsuleProps) {
    const [tempColor, setTempColor] = useState(color);

    useEffect(() => {
        setTempColor(color);
    }, [color]);

    return (
        <Box
            onClick={() => actions.onSelect(name)}
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
                <Popover withinPortal={false} shadow="sm" trapFocus>
                    <Popover.Target>
                        <ColorSwatch
                            color={tempColor}
                            radius="sm"
                            size={16}
                            style={{ cursor: "pointer" }}
                        />
                    </Popover.Target>
                    <Popover.Dropdown
                        onClick={(event) => event.stopPropagation()}
                        style={{ width: 220 }}
                    >
                        <Stack gap="xs">
                            <ColorPicker
                                value={tempColor}
                                format="hex"
                                fullWidth
                                onChange={setTempColor}
                                onChangeEnd={(final) =>
                                    actions.onChangeColor(name, final)
                                }
                            />
                            <Group justify="flex-end" gap="xs">
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        const next = window.prompt(
                                            "重命名单位",
                                            name,
                                        );
                                        if (next != null) {
                                            actions.onRename(name, next);
                                        }
                                    }}
                                >
                                    <IconPencil size={14} />
                                </ActionIcon>
                                <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    size="sm"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        actions.onDelete(name);
                                    }}
                                >
                                    <IconTrash size={14} />
                                </ActionIcon>
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
                <Text size="xs" c={selected ? "dark" : "dimmed"} fw={600}>
                    {name}
                </Text>
            </Group>
        </Box>
    );
});
