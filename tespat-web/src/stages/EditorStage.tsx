import { Box, Group, Stack, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridEditResizer } from "../components/GridEditResizer/GridEditResizer";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import { useEditor } from "../EditorData";
import styles from "../App.module.css";

/** 主舞台 - 编辑模式：可拖拽、可调整尺寸的网格编辑器 */
export function EditorStage() {
    const { editor, setEditor } = useEditor();

    return (
        <Box className={styles.UIStack}>
            <Box className={styles.canvasStage}>
                <CtrlDragPannable className={styles.canvasPlaceholder}>
                    <GridEditResizer>
                        <Box
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "24px 32px",
                            }}
                        >
                            <Group
                                wrap="nowrap"
                                align="stretch"
                                gap="xl"
                                style={{
                                    width: "min(1100px, 100%)",
                                    height: "min(720px, 100%)",
                                    minHeight: 0,
                                }}
                            >
                                <PatternPanel title="CAPTURE">
                                    <GridDisplay2D
                                        width={editor.editingRule.width}
                                        data={editor.editingRule.capture}
                                        enableEdit={editor.enableEdit}
                                        onChangeData={(nextData) =>
                                            setEditor((prev) => ({
                                                ...prev,
                                                editingRule: {
                                                    ...prev.editingRule,
                                                    capture: nextData,
                                                },
                                            }))
                                        }
                                    />
                                </PatternPanel>
                                <Box
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--mantine-color-gray-4)",
                                        flex: "0 0 auto",
                                    }}
                                >
                                    <IconArrowRight size={28} />
                                </Box>
                                <PatternPanel title="REPLACE">
                                    <GridDisplay2D
                                        width={editor.editingRule.width}
                                        data={editor.editingRule.replace}
                                        enableEdit={editor.enableEdit}
                                        onChangeData={(nextData) =>
                                            setEditor((prev) => ({
                                                ...prev,
                                                editingRule: {
                                                    ...prev.editingRule,
                                                    replace: nextData,
                                                },
                                            }))
                                        }
                                    />
                                </PatternPanel>
                            </Group>
                        </Box>
                    </GridEditResizer>
                </CtrlDragPannable>
            </Box>
        </Box>
    );
}

function PatternPanel({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Stack
            gap="xs"
            style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
            }}
        >
            <Text
                size="xs"
                fw={800}
                ff="monospace"
                c="gray.4"
                ta="center"
                lts="0.1em"
            >
                {title}
            </Text>
            <Box
                style={{
                    flex: 1,
                    minHeight: 0,
                }}
            >
                {children}
            </Box>
        </Stack>
    );
}
