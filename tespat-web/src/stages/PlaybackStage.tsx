import { Box } from "@mantine/core";
import { useCallback } from "react";
import GridDisplaySlider from "../components/GridDisplaySlider/GridDisplaySlider";
import styles from "../App.module.css";
import { ReplayToolbar } from "../replay/ReplayToolbar";
import { ReplayViewport } from "../replay/ReplayViewport";
import { useReplayFileImport } from "../replay/useReplayFileImport";
import { useWorkspace, useWorkspaceActions } from "../Workspace";

/** 主舞台 - 回放模式：可拖拽的中央网格显示 + 演化时间轴 */
export function PlaybackStage() {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const {
        replayData,
        canRefresh,
        fileInputRef,
        fileStatusText,
        importDroppedFile,
        isFilePickerSupported,
        isRefreshingFile,
        openReplayFile,
        refreshReplayFile,
        uploadReplayFile,
    } = useReplayFileImport();

    const totalSteps = replayData?.frames.length ?? 0;
    const clampedStep =
        totalSteps > 0
            ? Math.min(workspace.replayCurrentStep, totalSteps - 1)
            : 0;

    const handleStepChange = useCallback(
        (step: number) => {
            if (totalSteps === 0) return;
            actions.setReplayCurrentStep(
                Math.min(Math.max(step, 0), totalSteps - 1),
            );
        },
        [actions, totalSteps],
    );

    const handlePrevStep = useCallback(() => {
        if (totalSteps === 0) return;
        actions.setReplayCurrentStep(Math.max(clampedStep - 1, 0));
    }, [actions, clampedStep, totalSteps]);

    const handleNextStep = useCallback(() => {
        if (totalSteps === 0) return;
        actions.setReplayCurrentStep(Math.min(clampedStep + 1, totalSteps - 1));
    }, [actions, clampedStep, totalSteps]);

    return (
        <Box className={styles.UIStack}>
            <ReplayToolbar
                canRefresh={canRefresh}
                fileInputRef={fileInputRef}
                fileStatusText={fileStatusText}
                isFilePickerSupported={isFilePickerSupported}
                isRefreshingFile={isRefreshingFile}
                onOpenReplayFile={openReplayFile}
                onRefreshFile={refreshReplayFile}
                onUploadReplayFile={uploadReplayFile}
            />

            <ReplayViewport
                replayData={replayData}
                currentStep={clampedStep}
                onImportFile={importDroppedFile}
            />

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
