import { IconArrowRight, IconInfoSmall } from "@tabler/icons-react";
import {
    canvasPlaceholderClassName,
    canvasStageClassName,
    uiStackClassName,
} from "@/lib/stageClasses";
import { notifications } from "@/lib/notifications";
import { useRef, useState, type ReactNode } from "react";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridEditResizer } from "../components/GridEditResizer/GridEditResizer";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import {
    useWorkspace,
    useWorkspaceActions,
    useWorkspaceNamespace,
    useWorkspaceResolvedPalette,
} from "../Workspace";

// 主舞台的编辑模式
export function EditorStage() {
    const workspace = useWorkspace();
    const namespace = useWorkspaceNamespace();
    const resolvedPalette = useWorkspaceResolvedPalette();
    const actions = useWorkspaceActions();
    const [isResizing, setIsResizing] = useState(false);
    const noPaletteWarnedRef = useRef(false);
    const selectedRule = workspace.selectedPatternId
        ? namespace.patterns.get(workspace.selectedPatternId) ?? null
        : null;

    if (!selectedRule || !workspace.selectedPatternId) {
        return (
            <div className={uiStackClassName}>
                <div className={canvasStageClassName}>
                    <div className={canvasPlaceholderClassName}>
                        <p className="text-sm font-bold text-slate-400">
                            请选择一个 pattern 开始编辑
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={uiStackClassName}>
            <div className={canvasStageClassName}>
                <CtrlDragPannable className={canvasPlaceholderClassName}>
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
                                workspace.selectedPatternId,
                                direction,
                                deltaUnits,
                                workspace.selectedPaletteId,
                            );
                        }}
                    >
                        <div
                            className="flex h-full w-full items-center justify-center px-8 py-6"
                            style={{
                                width: "100%",
                            }}
                        >
                            <div
                                className="flex h-full min-h-0 w-full min-w-0 items-stretch gap-8"
                                style={{
                                    width: "min(1100px, 100%)",
                                    height: "min(720px, 100%)",
                                }}
                            >
                                <PatternPanel title="CAPTURE">
                                    <GridDisplay2D
                                        width={selectedRule.width}
                                        data={selectedRule.capture}
                                        palette={resolvedPalette}
                                        editable={!isResizing}
                                        paintPaletteId={
                                            workspace.selectedPaletteId
                                        }
                                        onChangeData={(nextData) =>
                                            actions.updatePatternCapture(
                                                workspace.selectedPatternId,
                                                nextData,
                                            )
                                        }
                                    />
                                </PatternPanel>
                                <div className="flex shrink-0 items-center justify-center text-slate-400">
                                    <IconArrowRight size={28} />
                                </div>
                                <PatternPanel title="REPLACE">
                                    <GridDisplay2D
                                        width={selectedRule.width}
                                        data={selectedRule.replace}
                                        palette={resolvedPalette}
                                        editable={!isResizing}
                                        paintPaletteId={
                                            workspace.selectedPaletteId
                                        }
                                        onChangeData={(nextData) =>
                                            actions.updatePatternReplace(
                                                workspace.selectedPatternId,
                                                nextData,
                                            )
                                        }
                                    />
                                </PatternPanel>
                            </div>
                        </div>
                    </GridEditResizer>
                </CtrlDragPannable>
            </div>
        </div>
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            <p className="text-center font-mono text-xs font-extrabold tracking-[0.16em] text-slate-400">
                {title}
            </p>
            <div className="min-h-0 flex-1">
                {children}
            </div>
        </div>
    );
}
