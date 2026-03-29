import { Box, Stack, Text } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import {
    useCallback,
    useRef,
    useState,
    type DragEvent,
} from "react";
import styles from "../App.module.css";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import type { ReplayData } from "./parseReplayJson";

// 回放视口的显式输入
interface ReplayViewportProps {
    currentStep: number;
    onImportFile: (file: File) => Promise<void>;
    replayData: ReplayData | null;
}

// 回放视口负责拖拽导入、空状态与网格展示
export function ReplayViewport({
    currentStep,
    onImportFile,
    replayData,
}: ReplayViewportProps) {
    const dragDepthRef = useRef(0);
    const [isDragOver, setIsDragOver] = useState(false);

    const totalSteps = replayData?.frames.length ?? 0;
    const clampedStep =
        totalSteps > 0 ? Math.min(currentStep, totalSteps - 1) : 0;
    const displayFrame = totalSteps > 0 ? replayData!.frames[clampedStep] : [];

    // 处理拖拽进入时的高亮状态
    const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragOver(true);
    }, []);

    // 保持拖拽经过时的可投放状态
    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isDragOver) {
            setIsDragOver(true);
        }
    }, [isDragOver]);

    // 处理拖拽离开时的高亮复位
    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    // 接收拖拽投放的回放文件
    const handleDrop = useCallback(
        async (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            dragDepthRef.current = 0;
            setIsDragOver(false);

            const file = event.dataTransfer.files?.[0];
            if (!file) {
                return;
            }

            await onImportFile(file);
        },
        [onImportFile],
    );

    return (
        <Box
            className={styles.canvasStage}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(event) => void handleDrop(event)}
        >
            <CtrlDragPannable className={styles.canvasPlaceholder}>
                {replayData ? (
                    <GridDisplay2D
                        width={replayData.width}
                        data={displayFrame}
                        palette={replayData.palette}
                    />
                ) : (
                    <Stack align="center" gap="xs">
                        <IconUpload
                            size={40}
                            color="var(--mantine-color-gray-4)"
                        />
                        <Text fw={700} c="gray.3">
                            上传回放 JSON 后查看结果
                        </Text>
                        <Text size="xs" c="dimmed">
                            上传后默认定位到最后一帧
                        </Text>
                    </Stack>
                )}
            </CtrlDragPannable>

            {isDragOver && (
                <Box
                    style={{
                        position: "absolute",
                        inset: 16,
                        borderRadius: 10,
                        border: "2px dashed var(--mantine-color-blue-4)",
                        background: "rgba(59, 130, 246, 0.08)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text fw={700} c="blue.3">
                        松手即可导入回放文件
                    </Text>
                </Box>
            )}
        </Box>
    );
}
