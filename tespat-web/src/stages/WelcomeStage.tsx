import { IconGridPattern } from "@tabler/icons-react";
import {
    canvasPlaceholderClassName,
    canvasStageClassName,
    uiStackClassName,
} from "@/lib/stageClasses";

/** 主舞台 - 欢迎模式：无可拖拽的欢迎页 */
export function WelcomeStage() {
    return (
        <div className={uiStackClassName}>
            <div className={canvasStageClassName}>
                <div className={canvasPlaceholderClassName}>
                    <Welcome />
                </div>
            </div>
        </div>
    );
}

function Welcome() {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
                <IconGridPattern
                    size={64}
                    stroke={1.5}
                    className="text-slate-500"
                />
                <h2 className="text-2xl font-medium text-slate-300">
                    欢迎使用 TESPAT 编辑器
                </h2>
                <p className="max-w-80 text-sm text-slate-400">
                    从左侧选择一个规则，选择一个颜色，即刻开始编辑捕获与替换
                </p>
            </div>
        </div>
    );
}
