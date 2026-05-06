// 统一主舞台布局类，避免多个 stage 重复硬编码
export const uiStackClassName =
    "relative flex h-full w-full flex-col items-center";

export const canvasStageClassName =
    "relative flex min-h-0 flex-1 w-full bg-app-bg bg-[radial-gradient(circle_at_1px_1px,var(--color-app-grid-dot)_1px,transparent_0)] [background-size:40px_40px]";

export const canvasPlaceholderClassName =
    "flex h-full w-full items-center justify-center rounded-xl border border-white/6 bg-slate-950/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
