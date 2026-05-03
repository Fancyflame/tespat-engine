import { ActionIcon, Box, Group, Stack } from "@mantine/core";
import { IconBinaryTree2, IconEdit, IconVideo } from "@tabler/icons-react";
import { useState } from "react";
import { useWorkspaceActions } from "../../Workspace";
import { SidebarEditorTab } from "./SidebarEditorTab";
import { SidebarNamespacesTab } from "./SidebarNamespacesTab";
import styles from "./SidebarLayout.module.css";

// SidebarTab 约束侧边栏工具区可切换的页签
type SidebarTab = "tree" | "editor";

export const Sidebar = () => {
    const actions = useWorkspaceActions();
    const [activeSidebarTab, setActiveSidebarTab] =
        useState<SidebarTab>("editor");

    return (
        <Stack p="md" h="100%" gap="xs" className={styles.sidebarRoot}>
            <Group
                justify="space-between"
                wrap="nowrap"
                gap="xs"
                className={styles.sidebarToolbar}
            >
                <Group
                    gap="xs"
                    wrap="nowrap"
                    className={styles.sidebarTabGroup}
                >
                    <ActionIcon
                        variant={
                            activeSidebarTab === "tree" ? "light" : "subtle"
                        }
                        size="md"
                        aria-label="结构树"
                        title="结构树"
                        className={[
                            styles.sidebarTabButton,
                            activeSidebarTab === "tree"
                                ? styles.sidebarTabButtonActive
                                : "",
                        ].join(" ")}
                        onClick={() => setActiveSidebarTab("tree")}
                    >
                        <IconBinaryTree2 size={14} />
                    </ActionIcon>
                    <ActionIcon
                        variant={
                            activeSidebarTab === "editor" ? "light" : "subtle"
                        }
                        size="md"
                        aria-label="编辑器"
                        title="编辑器"
                        className={[
                            styles.sidebarTabButton,
                            activeSidebarTab === "editor"
                                ? styles.sidebarTabButtonActive
                                : "",
                        ].join(" ")}
                        onClick={() => setActiveSidebarTab("editor")}
                    >
                        <IconEdit size={14} />
                    </ActionIcon>
                </Group>

                <ActionIcon
                    variant="light"
                    size="md"
                    aria-label="回放录制"
                    title="回放录制"
                    onClick={actions.openPlayback}
                >
                    <IconVideo size={14} />
                </ActionIcon>
            </Group>
            <Box className={styles.sidebarContent}>
                {activeSidebarTab === "editor" ? (
                    <SidebarEditorTab />
                ) : (
                    <SidebarNamespacesTab />
                )}
            </Box>
        </Stack>
    );
};
