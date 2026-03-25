import { AppShell, Group, Text, ActionIcon } from "@mantine/core";
import {
    IconDeviceFloppy,
    IconFileImport,
    IconFilePlus,
} from "@tabler/icons-react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import styles from "./App.module.css";
import { EditorStage } from "./stages/EditorStage";
import { PlaybackStage } from "./stages/PlaybackStage";
import { WelcomeStage } from "./stages/WelcomeStage";
import { useWorkspace, useWorkspaceActions } from "./Workspace";

// 应用壳层负责切换主舞台与顶部工具栏动作
export default function App() {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();

    return (
        <AppShell
            header={{ height: 40 }}
            navbar={{ width: 320, breakpoint: "sm" }}
            padding="0"
            w="100vw"
            h="100vh"
        >
            <AppShell.Header className={styles.header} bd={0}>
                <Group h="100%" px="xl" justify="space-between">
                    <Group gap="xl">
                        <Text
                            fw={900}
                            size="xl"
                            lts={-1}
                            style={{
                                userSelect: "none",
                                cursor: "pointer",
                            }}
                            onClick={actions.goToWelcome}
                        >
                            {"TESPAT EDITOR"}
                        </Text>
                    </Group>
                    <Group gap="xs">
                        {actions.isFileSystemAccessSupported && (
                            <>
                                <ActionIcon
                                    size="md"
                                    variant="light"
                                    onClick={actions.createNewFile}
                                >
                                    <IconFilePlus size={16} />
                                </ActionIcon>
                                <ActionIcon
                                    size="md"
                                    variant="light"
                                    onClick={actions.openWithFilePicker}
                                >
                                    <IconFileImport size={16} />
                                </ActionIcon>
                            </>
                        )}
                        <ActionIcon
                            size="md"
                            variant="light"
                            onClick={actions.downloadProject}
                        >
                            <IconDeviceFloppy size={16} />
                        </ActionIcon>
                    </Group>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar bg="gray.9" className={styles.navbar}>
                <Sidebar />
            </AppShell.Navbar>

            <AppShell.Main className={styles.main}>
                {workspace.viewMode === "editor" && <EditorStage />}
                {workspace.viewMode === "playback" && <PlaybackStage />}
                {workspace.viewMode === "welcome" && <WelcomeStage />}
            </AppShell.Main>
        </AppShell>
    );
}
