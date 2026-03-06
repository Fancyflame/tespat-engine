import { useEffect } from "react";
import { AppShell, Group, Text, Button, ActionIcon } from "@mantine/core";
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
import { useEditor, getSelectedPatternId } from "./EditorData";
import { useProject } from "./ProjectData";
import { useFileSync } from "./FileSyncContext";
import { projectToJson } from "./projectSerialization";

const SYNC_DEBOUNCE_MS = 1000;

export default function App() {
    const { editor, setEditor } = useEditor();
    const { setProject, project } = useProject();
    const {
        fileHandle,
        fileName,
        isSupported,
        openWithFilePicker,
        createNewFile,
        syncToFile,
    } = useFileSync();

    useEffect(() => {
        // 仅在选中某个 pattern 时，将主编辑区内容实时回写到该规则
        const selectedPatternId = getSelectedPatternId(editor.displayMode);
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
        editor.displayMode,
        editor.editingGrid.width,
        editor.editingGrid.data,
        setProject,
    ]);

    // 打开文件时，project 变化后 debounce 同步到本地
    useEffect(() => {
        if (!fileHandle) return;
        const timer = setTimeout(() => {
            syncToFile(projectToJson(project));
        }, SYNC_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [project, fileHandle, syncToFile]);

    // 点击保存下载
    const handleDownloadProject = () => {
        const content = projectToJson(project);
        const blob = new Blob([content], {
            type: "application/json;charset=utf-8",
        });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName ?? "untitled.tsp";
        document.body.appendChild(link);
        try {
            link.click();
        } finally {
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        }
    };

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
                            style={{
                                userSelect: "none",
                                cursor: "pointer",
                            }}
                            onClick={() =>
                                setEditor((prev) => ({
                                    ...prev,
                                    displayMode: { mode: "welcome" },
                                }))
                            }
                        >
                            {"TESPAT EDITOR"}
                        </Text>
                    </Group>
                    <Group gap="xs">
                        {isSupported && (
                            <>
                                <ActionIcon
                                    size="md"
                                    variant="light"
                                    onClick={createNewFile}
                                >
                                    <IconFilePlus size={16} />
                                </ActionIcon>
                                <ActionIcon
                                    size="md"
                                    variant="light"
                                    onClick={openWithFilePicker}
                                >
                                    <IconFileImport size={16} />
                                </ActionIcon>
                            </>
                        )}
                        <ActionIcon
                            size="md"
                            variant="light"
                            onClick={handleDownloadProject}
                        >
                            <IconDeviceFloppy size={16} />
                        </ActionIcon>
                    </Group>
                </Group>
            </AppShell.Header>

            {/* 侧边栏 */}
            <AppShell.Navbar bg="gray.9" className={styles.navbar}>
                <Sidebar />
            </AppShell.Navbar>

            {/* 中央主舞台 */}
            <AppShell.Main className={styles.main}>
                {editor.displayMode.mode === "editor" && <EditorStage />}
                {editor.displayMode.mode === "playback" && <PlaybackStage />}
                {editor.displayMode.mode === "welcome" && <WelcomeStage />}
            </AppShell.Main>
        </AppShell>
    );
}
