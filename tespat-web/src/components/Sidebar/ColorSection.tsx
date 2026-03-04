import { useMemo, useState, useEffect, memo } from "react";
import {
    ActionIcon,
    Group,
    Stack,
    Text,
    Popover,
    ColorSwatch,
    ColorPicker,
    Box,
} from "@mantine/core";
import { CollapsibleSection } from "./CollapsibleSection";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { useProject } from "../../ProjectData";
import { useEditor } from "../../EditorData";

export function ColorSection() {
    const { project, setProject } = useProject();
    const { editor, setEditor } = useEditor();

    const colors = useMemo(
        () =>
            Array.from(project.colorDisplay.entries()).sort((a, b) =>
                a[0].localeCompare(b[0]),
            ),
        [project.colorDisplay],
    );

    const colorActions = useMemo(
        () => ({
            onChangeColor: (colorName: string, nextColor: string) => {
                setProject((prev) => {
                    const colorDisplay = new Map(prev.colorDisplay);
                    colorDisplay.set(colorName, nextColor);
                    return { ...prev, colorDisplay };
                });
            },
            onDelete: (colorName: string) => {
                setProject((prev) => {
                    const colorDisplay = new Map(prev.colorDisplay);
                    colorDisplay.delete(colorName);
                    return { ...prev, colorDisplay };
                });
            },
            onRename: (oldName: string, newName: string) => {
                const trimmed = newName.trim();
                if (!trimmed || trimmed === oldName) return;

                const color = project.colorDisplay.get(oldName);
                if (color === undefined) {
                    return;
                }

                if (project.colorDisplay.has(trimmed)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "相同名字的颜色已存在",
                        icon: <IconX />,
                        color: "red",
                    });
                    return;
                }

                setProject((prev) => {
                    const colorDisplay = new Map(prev.colorDisplay);
                    colorDisplay.delete(oldName);
                    colorDisplay.set(trimmed, color);
                    return { ...prev, colorDisplay };
                });
                setEditor((prev) => ({ ...prev, selectedColor: trimmed }));
            },
            onSelect: (colorName: string) => {
                setEditor((prev) => ({ ...prev, selectedColor: colorName }));
            },
        }),
        [project.colorDisplay, setEditor, setProject],
    );

    const createNewColor = () => {
        const baseName = "_NewColor";
        let index = 0;
        let candidate = baseName;
        while (project.colorDisplay.has(candidate)) {
            index += 1;
            candidate = `${baseName}${index}`;
        }

        setProject((prev) => {
            const colorDisplay = new Map(prev.colorDisplay);
            colorDisplay.set(candidate, "#ffffff");

            return {
                ...prev,
                colorDisplay,
            };
        });
        setEditor((prev) => ({ ...prev, selectedColor: candidate }));
    };

    return (
        <CollapsibleSection
            title="COLORS"
            rightAction={
                <ActionIcon
                    variant="light"
                    size="sm"
                    onClick={(event) => {
                        event.stopPropagation();
                        createNewColor();
                    }}
                >
                    <IconPlus size={14} />
                </ActionIcon>
            }
        >
            <Stack gap="xs" pt="xs">
                {colors.length === 0 ? (
                    <Text size="xs" c="dimmed">
                        暂无颜色
                    </Text>
                ) : (
                    <Group gap="xs" wrap="wrap">
                        {colors.map(([colorName, color]) => (
                            <ColorCapsule
                                key={colorName}
                                name={colorName}
                                color={color}
                                selected={editor.selectedColor === colorName}
                                actions={colorActions}
                            />
                        ))}
                    </Group>
                )}
            </Stack>
        </CollapsibleSection>
    );
}

type ColorCapsuleProps = {
    name: string;
    color: string;
    selected: boolean;
    actions: {
        onChangeColor: (colorName: string, nextColor: string) => void;
        onDelete: (colorName: string) => void;
        onRename: (oldName: string, newName: string) => void;
        onSelect: (colorName: string) => void;
    };
};

const ColorCapsule = memo(function ColorCapsule({
    name,
    color,
    selected,
    actions,
}: ColorCapsuleProps) {
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
                            <Group gap="xs">
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        const next = window.prompt(
                                            "重命名颜色",
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
                                <ColorPicker
                                    value={tempColor}
                                    format="hex"
                                    fullWidth
                                    onChange={setTempColor}
                                    onChangeEnd={(final) =>
                                        actions.onChangeColor(name, final)
                                    }
                                />
                            </Group>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
                <Text
                    size="xs"
                    c={selected ? "dark" : "dimmed"}
                    fw={600}
                    style={{ userSelect: "none" }}
                >
                    {name}
                </Text>
            </Group>
        </Box>
    );
});
