import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileImport, IconUpload } from "@tabler/icons-react";
import {
    useCallback,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from "react";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import GridDisplaySlider from "../components/GridDisplaySlider/GridDisplaySlider";
import styles from "../App.module.css";
import { parseReplayJson, type ReplayData } from "../replay/parseReplayJson";

/** 主舞台 - 回放模式：可拖拽的中央网格显示 + 演化时间轴 */
export function PlaybackStage() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const dragDepthRef = useRef(0);

    const [replayData, setReplayData] = useState<ReplayData | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);

    const totalSteps = replayData?.frames.length ?? 0;
    const clampedStep = totalSteps > 0 ? Math.min(currentStep, totalSteps - 1) : 0;
    const displayWidth = replayData?.width ?? 0;
    const displayFrame = totalSteps > 0 ? replayData!.frames[clampedStep] : [];

    const applyReplayText = useCallback((text: string) => {
        const result = parseReplayJson(text);
        if (!result.ok) {
            notifications.show({
                title: "导入失败",
                message: result.message,
                color: "red",
            });
            return;
        }

        setReplayData(result.data);
        setCurrentStep(
            result.data.frames.length > 0 ? result.data.frames.length - 1 : 0,
        );
    }, []);

    const importReplayFile = useCallback(
        async (file: File) => {
            try {
                const text = await file.text();
                applyReplayText(text);
            } catch {
                notifications.show({
                    title: "导入失败",
                    message: "读取文件失败，请重试",
                    color: "red",
                });
            }
        },
        [applyReplayText],
    );

    const handleUploadInput = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;

            await importReplayFile(file);
            event.currentTarget.value = "";
        },
        [importReplayFile],
    );

    const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragOver(true);
    }, []);

    const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isDragOver) {
            setIsDragOver(true);
        }
    }, [isDragOver]);

    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback(
        async (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            dragDepthRef.current = 0;
            setIsDragOver(false);

            const file = event.dataTransfer.files?.[0];
            if (!file) return;

            await importReplayFile(file);
        },
        [importReplayFile],
    );

    const handleStepChange = useCallback(
        (step: number) => {
            if (totalSteps === 0) return;
            setCurrentStep(Math.min(Math.max(step, 0), totalSteps - 1));
        },
        [totalSteps],
    );

    const handlePrevStep = useCallback(() => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleNextStep = useCallback(() => {
        if (totalSteps === 0) return;
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }, [totalSteps]);

    return (
        <Box className={styles.UIStack}>
            <Group gap="xs" py="sm">
                <Button
                    leftSection={<IconFileImport size={16} />}
                    onClick={() => fileInputRef.current?.click()}
                >
                    上传回放 JSON
                </Button>
                <Text size="xs" c="dimmed">
                    支持拖拽到画布
                </Text>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={handleUploadInput}
                />
            </Group>

            <Box
                className={styles.canvasStage}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <CtrlDragPannable className={styles.canvasPlaceholder}>
                    {replayData ? (
                        <GridDisplay2D
                            width={displayWidth}
                            data={displayFrame}
                            enableEdit={false}
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

            <GridDisplaySlider
                currentStep={clampedStep}
                totalSteps={totalSteps}
                onStepChange={handleStepChange}
                onPrev={handlePrevStep}
                onNext={handleNextStep}
                disabled={totalSteps === 0}
            />
        </Box>
    );
}
