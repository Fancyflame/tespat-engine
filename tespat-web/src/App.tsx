import { useState } from "react";
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
import { GridEditResizer } from "./components/GridEditResizer/GridEditResizer";

export default function App() {
    const [activeTab, setActiveTab] = useState<string | null>("editor");
    const { editor, setEditor } = useEditor();

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

                    <Group>
                        {activeTab === "playback" ? (
                            <Button
                                size="xs"
                                variant="light"
                                color="grape"
                                leftSection={<IconUpload size={14} />}
                            >
                                上传历史数据
                            </Button>
                        ) : (
                            <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconDeviceFloppy size={14} />}
                            >
                                保存
                            </Button>
                        )}
                    </Group>
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
                            <GridEditResizer>
                                <GridDisplay2D
                                    width={editor.editingGrid.width}
                                    data={editor.editingGrid.data}
                                    enableEdit={editor.enableEdit}
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
                        </CtrlDragPannable>
                    </Box>
                    <GridDisplaySlider />
                </Box>
            </AppShell.Main>
        </AppShell>
    );
}
