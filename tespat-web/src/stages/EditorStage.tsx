import { Box, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowRight, IconInfoSmall } from "@tabler/icons-react";
import { useRef, useState, type ReactNode } from "react";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridEditResizer } from "../components/GridEditResizer/GridEditResizer";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import styles from "../App.module.css";
import { useWorkspace, useWorkspaceActions } from "../Workspace";

// 主舞台的编辑模式
export function EditorStage() {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const [isResizing, setIsResizing] = useState(false);
    const noPaletteWarnedRef = useRef(false);
    const selectedRule = workspace.selectedPatternId
        ? workspace.project.patterns.get(workspace.selectedPatternId) ?? null
        : null;

    if (!selectedRule || !workspace.selectedPatternId) {
        return (
            <Box className={styles.UIStack}>
                <Box className={styles.canvasStage}>
                    <Box className={styles.canvasPlaceholder}>
                        <Text c="dimmed" fw={700}>
                            请选择一个 pattern 开始编辑
                        </Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box className={styles.UIStack}>
            <Box className={styles.canvasStage}>
                <CtrlDragPannable className={styles.canvasPlaceholder}>
                    <GridEditResizer
                        onResizeStart={() => {
                            setIsResizing(true);
                            noPaletteWarnedRef.current = false;
                        }}
                        onResizeEnd={() => {
                            setIsResizing(false);
                            noPaletteWarnedRef.current = false;
                        }}
                        onResize={(direction, deltaUnits) => {
                            if (deltaUnits === 0) {
                                return;
                            }

                            if (!workspace.selectedPaletteId) {
                                if (!noPaletteWarnedRef.current) {
                                    notifications.show({
                                        title: "无法调整尺寸",
                                        message:
                                            "请先在左侧选择一个 palette，新增区域会使用它进行填充。",
                                        icon: <IconInfoSmall size={18} />,
                                        color: "blue",
                                    });
                                    noPaletteWarnedRef.current = true;
                                }
                                return;
                            }

                            actions.resizePattern(
                                workspace.selectedPatternId!,
                                direction,
                                deltaUnits,
                                workspace.selectedPaletteId,
                            );
                        }}
                    >
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
                                        width={selectedRule.width}
                                        data={selectedRule.capture}
                                        palette={workspace.project.palette}
                                        editable={!isResizing}
                                        paintPaletteId={
                                            workspace.selectedPaletteId
                                        }
                                        onChangeData={(nextData) =>
                                            actions.updatePatternCapture(
                                                workspace.selectedPatternId!,
                                                nextData,
                                            )
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
                                        width={selectedRule.width}
                                        data={selectedRule.replace}
                                        palette={workspace.project.palette}
                                        editable={!isResizing}
                                        paintPaletteId={
                                            workspace.selectedPaletteId
                                        }
                                        onChangeData={(nextData) =>
                                            actions.updatePatternReplace(
                                                workspace.selectedPatternId!,
                                                nextData,
                                            )
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

// PatternPanel 负责包装单侧网格面板
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
