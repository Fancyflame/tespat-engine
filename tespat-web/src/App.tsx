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

export default function App() {
    const [activeTab, setActiveTab] = useState<string | null>("editor");

    return (
        <AppShell
            header={{ height: 40 }}
            navbar={{ width: 320, breakpoint: "sm" }}
            padding="0"
        >
            {/* 顶部工具栏 */}
            <AppShell.Header className={styles.header} bd={0}>
                <Group h="100%" px="xl" justify="space-between">
                    <Group gap="xl">
                        <Text fw={900} size="xl" lts={-1}>
                            {"TESPAT IDE"}
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
                {/* 这个包装器用于确定一个div大小供内容寻找100%长宽 */}
                <Stack pos="relative" flex={1} align="center">
                    <Box className={styles.canvasStage} p="md">
                        {/* 这里是未来的 Canvas 组件 */}
                        <div className={styles.canvasPlaceholder}>
                            <Text
                                c="dimmed"
                                ff="monospace"
                                size="sm"
                                lts="0.5em"
                            >
                                {activeTab === "editor"
                                    ? "SEED_INITIALIZATION"
                                    : "HISTORY_PLAYBACK_VIEW"}
                            </Text>
                        </div>
                    </Box>

                    {/* <Box className={styles.gridDisplaySliderWrapper}> */}
                    <GridDisplaySlider />
                    {/* </Box> */}
                </Stack>
            </AppShell.Main>
        </AppShell>
    );
}
