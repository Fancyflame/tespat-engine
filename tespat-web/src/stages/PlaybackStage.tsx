import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileImport, IconRefresh, IconUpload } from "@tabler/icons-react";
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
    const isFilePickerSupported =
        typeof window !== "undefined" && "showOpenFilePicker" in window;

    const [replayData, setReplayData] = useState<ReplayData | null>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [openedFileHandle, setOpenedFileHandle] =
        useState<FileSystemFileHandle | null>(null);
    const [openedFileName, setOpenedFileName] = useState<string | null>(null);
    const [isRefreshingFile, setIsRefreshingFile] = useState(false);

    const totalSteps = replayData?.frames.length ?? 0;
    const clampedStep = totalSteps > 0 ? Math.min(currentStep, totalSteps - 1) : 0;
    const displayWidth = replayData?.width ?? 0;
    const displayFrame = totalSteps > 0 ? replayData!.frames[clampedStep] : [];
    const fileStatusText = openedFileHandle
        ? `当前已打开：${openedFileName}`
        : openedFileName
          ? `当前文件：${openedFileName}（刷新不可用）`
          : "支持拖拽到画布";

    const applyReplayText = useCallback((text: string) => {
        const result = parseReplayJson(text);
        if (!result.ok) {
            notifications.show({
                title: "导入失败",
                message: result.message,
                color: "red",
            });
            return false;
        }

        setReplayData(result.data);
        setCurrentStep(
            result.data.frames.length > 0 ? result.data.frames.length - 1 : 0,
        );
        return true;
    }, []);

    const importReplayFile = useCallback(
        async (
            file: File,
            options?: {
                fileHandle?: FileSystemFileHandle | null;
                fileName?: string | null;
            },
        ) => {
            try {
                const text = await file.text();
                const isImported = applyReplayText(text);
                if (!isImported) {
                    return false;
                }

                setOpenedFileHandle(options?.fileHandle ?? null);
                setOpenedFileName(options?.fileName ?? file.name);
                return true;
            } catch {
                notifications.show({
                    title: "导入失败",
                    message: "读取文件失败，请重试",
                    color: "red",
                });
                return false;
            }
        },
        [applyReplayText],
    );

    const handleOpenReplayFile = useCallback(async () => {
        if (!isFilePickerSupported) {
            fileInputRef.current?.click();
            return;
        }

        try {
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: "回放 JSON",
                        accept: {
                            "application/json": [".json"],
                        },
                    },
                ],
            });
            const file = await handle.getFile();
            await importReplayFile(file, {
                fileHandle: handle,
                fileName: handle.name,
            });
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                notifications.show({
                    title: "打开失败",
                    message: "打开本地文件失败，请重试",
                    color: "red",
                });
            }
        }
    }, [importReplayFile, isFilePickerSupported]);

    const handleRefreshFile = useCallback(async () => {
        if (!openedFileHandle) return;

        setIsRefreshingFile(true);
        try {
            const file = await openedFileHandle.getFile();
            await importReplayFile(file, {
                fileHandle: openedFileHandle,
                fileName: openedFileHandle.name,
            });
        } catch {
            notifications.show({
                title: "刷新失败",
                message: "重新读取本地文件失败，请重新打开文件",
                color: "red",
            });
        } finally {
            setIsRefreshingFile(false);
        }
    }, [importReplayFile, openedFileHandle]);

    const handleUploadInput = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;

            await importReplayFile(file, {
                fileHandle: null,
                fileName: file.name,
            });
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

            await importReplayFile(file, {
                fileHandle: null,
                fileName: file.name,
            });
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
                    onClick={handleOpenReplayFile}
                >
                    {isFilePickerSupported ? "打开回放 JSON" : "上传回放 JSON"}
                </Button>
                <Button
                    variant="light"
                    leftSection={<IconRefresh size={16} />}
                    onClick={handleRefreshFile}
                    disabled={!openedFileHandle}
                    loading={isRefreshingFile}
                >
                    刷新
                </Button>
                <Text size="xs" c="dimmed">
                    {fileStatusText}
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
