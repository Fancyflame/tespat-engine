import { useEffect } from "react";
import {
    AppShell,
    Group,
    Text,
    Button,
    Tabs,
    Box,
    Slider,
    ActionIcon,
    Center,
    Flex,
    Stack,
} from "@mantine/core";
import {
    IconPlayerPlay,
    IconPlayerSkipForward,
    IconUpload,
    IconDeviceFloppy,
} from "@tabler/icons-react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import styles from "./App.module.css";
import GridDisplaySlider from "./components/GridDisplaySlider/GridDisplaySlider";
import { CtrlDragPannable } from "./components/CtrlDragPannable/CtrlDragPannable";
import { GridDisplay2D } from "./components/GridDisplay2D/GridDisplay2D";
import { useEditor } from "./EditorData";
import { useProject } from "./ProjectData";
import { GridEditResizer } from "./components/GridEditResizer/GridEditResizer";

export default function App() {
    const { editor, setEditor } = useEditor();
    const { setProject } = useProject();

    useEffect(() => {
        // 仅在选中某个 pattern 时，将主编辑区内容实时回写到该规则
        const selectedPatternId = editor.selectedPatternId;
        if (!selectedPatternId) return;

        setProject((prev) => {
            const rule = prev.patterns.get(selectedPatternId);
            if (!rule) return prev;

            // 先做一次轻量比较，避免无变化时频繁触发 patterns 的新引用
            const sameWidth = rule.width === editor.editingGrid.width;
            const samePattern =
                rule.pattern.length === editor.editingGrid.data.length &&
                rule.pattern.every(
                    (cell, index) => cell === editor.editingGrid.data[index],
                );

            if (sameWidth && samePattern) return prev;

            // 网格有变化时，复制 Map 并仅更新当前选中规则
            const patterns = new Map(prev.patterns);
            patterns.set(selectedPatternId, {
                ...rule,
                width: editor.editingGrid.width,
                pattern: editor.editingGrid.data,
            });
            return { ...prev, patterns };
        });
    }, [
        editor.selectedPatternId,
        editor.editingGrid.width,
        editor.editingGrid.data,
        setProject,
    ]);

    return (
        <AppShell
            header={{ height: 40 }}
            navbar={{ width: 320, breakpoint: "sm" }}
            padding="0"
            w="100vw"
            h="100vh"
        >
            {/* 顶部工具栏 */}
            <AppShell.Header className={styles.header} bd={0}>
                <Group h="100%" px="xl" justify="space-between">
                    <Group gap="xl">
                        <Text
                            fw={900}
                            size="xl"
                            lts={-1}
                            style={{ userSelect: "none" }}
                        >
                            {"TESPAT EDITOR"}
                        </Text>
                    </Group>
                    <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconDeviceFloppy size={14} />}
                    >
                        保存
                    </Button>
                </Group>
            </AppShell.Header>

            {/* 侧边栏 */}
            <AppShell.Navbar bg="gray.9" className={styles.navbar}>
                <Sidebar />
            </AppShell.Navbar>

            {/* 中央主舞台 */}
            <AppShell.Main className={styles.main}>
                <Box className={styles.UIStack}>
                    <Box className={styles.canvasStage}>
                        <CtrlDragPannable className={styles.canvasPlaceholder}>
                            {editor.displayMode === "editor" &&
                            editor.selectedPatternId !== null ? (
                                <GridEditResizer>
                                    <GridDisplay2D
                                        width={editor.editingGrid.width}
                                        data={editor.editingGrid.data}
                                        enableEdit={
                                            editor.enableEdit &&
                                            editor.selectedPatternId !== null
                                        }
                                        onChangeData={(nextData) =>
                                            setEditor((prev) => ({
                                                ...prev,
                                                editingGrid: {
                                                    ...prev.editingGrid,
                                                    data: nextData,
                                                },
                                            }))
                                        }
                                    />
                                </GridEditResizer>
                            ) : (
                                <GridDisplay2D
                                    width={editor.editingGrid.width}
                                    data={editor.editingGrid.data}
                                    onChangeData={(nextData) =>
                                        setEditor((prev) => ({
                                            ...prev,
                                            editingGrid: {
                                                ...prev.editingGrid,
                                                data: nextData,
                                            },
                                        }))
                                    }
                                />
                            )}
                        </CtrlDragPannable>
                    </Box>
                    {editor.displayMode === "playback" && <GridDisplaySlider />}
                </Box>
            </AppShell.Main>
        </AppShell>
    );
}
