import { IconUpload } from "@tabler/icons-react";
import {
    canvasPlaceholderClassName,
    canvasStageClassName,
} from "@/lib/stageClasses";
import {
    useCallback,
    useRef,
    useState,
    type DragEvent,
} from "react";
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
        <div
            className={canvasStageClassName}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(event) => void handleDrop(event)}
        >
            <CtrlDragPannable className={canvasPlaceholderClassName}>
                {replayData ? (
                    <GridDisplay2D
                        width={replayData.width}
                        data={displayFrame}
                        palette={replayData.palette}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <IconUpload size={40} className="text-slate-400" />
                        <p className="text-sm font-bold text-slate-200">
                            上传回放 JSON 后查看结果
                        </p>
                        <p className="text-xs text-slate-400">
                            上传后默认定位到最后一帧
                        </p>
                    </div>
                )}
            </CtrlDragPannable>

            {isDragOver && (
                <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-[10px] border-2 border-dashed border-blue-400 bg-blue-500/8">
                    <p className="text-sm font-bold text-blue-200">
                        松手即可导入回放文件
                    </p>
                </div>
            )}
        </div>
    );
}
