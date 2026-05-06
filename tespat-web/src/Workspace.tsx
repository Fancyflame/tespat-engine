import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type MutableRefObject,
    type ReactNode,
} from "react";
import { IconX } from "@tabler/icons-react";
import { notifications } from "@/lib/notifications";
import {
    DEFAULT_PROJECT,
    ROOT_NAMESPACE_ID,
    type NamespaceData,
    type PaletteEntry,
    clonePaletteEntry,
    clonePatternRule,
    cloneProject,
    countPaletteReferences,
    createEmptyNamespaceData,
    createNamespaceId,
    createEmptyPatternRule,
    getNamespaceDescendantIds,
    getNamespaceParentId,
    getOrderedPatternIds,
    isNamespaceDescendant,
    isNamespaceSegmentValid,
    replacePaletteNameInCells,
    type ProjectData,
} from "./ProjectData";
import { projectToJson, jsonToProject } from "./projectSerialization";
import { applyResizeGrid } from "./components/GridEditResizer/applyResizeGrid";
import type { ResizeDirection } from "./components/GridEditResizer/ResizeBar";
import type { ReplayData } from "./replay/parseReplayJson";

const SYNC_DEBOUNCE_MS = 1000;

// 当前主工作区可处于的页面模式
export type ViewMode = "welcome" | "editor" | "playback";

// 工作区的核心状态定义
export interface WorkspaceState {
    project: ProjectData;
    selectedNamespaceId: string;
    viewMode: ViewMode;
    selectedPatternId: string | null;
    selectedPaletteId: string | null;
    fileHandle: FileSystemFileHandle | null;
    fileName: string | null;
    replayData: ReplayData | null;
    replayFileHandle: FileSystemFileHandle | null;
    replayFileName: string | null;
    replayCurrentStep: number;
}

// 工作区 reducer 的更新动作
interface WorkspaceReducerAction {
    type: "update";
    updater: (state: WorkspaceState) => WorkspaceState;
}

// 工作区对外暴露的动作集合
interface WorkspaceActions {
    isFileSystemAccessSupported: boolean;
    goToWelcome: () => void;
    openPlayback: () => void;
    setReplayImportResult: (payload: {
        replayData: ReplayData;
        fileHandle: FileSystemFileHandle | null;
        fileName: string | null;
    }) => void;
    setReplayCurrentStep: (step: number) => void;
    clearReplayState: () => void;
    selectNamespace: (namespaceId: string) => void;
    createNamespace: (
        parentNamespaceId: string,
        segment: string,
    ) => boolean;
    renameNamespace: (namespaceId: string, segment: string) => boolean;
    deleteNamespace: (namespaceId: string) => boolean;
    selectPattern: (patternId: string) => void;
    setSelectedPaletteId: (paletteId: string | null) => void;
    createPattern: () => void;
    renamePattern: (patternId: string, nextName: string) => boolean;
    deletePattern: (patternId: string) => void;
    movePattern: (
        sourceId: string,
        targetId: string,
        position: "before" | "after",
    ) => void;
    updatePatternCapture: (patternId: string, nextCapture: string[]) => void;
    updatePatternReplace: (patternId: string, nextReplace: string[]) => void;
    resizePattern: (
        patternId: string,
        direction: ResizeDirection,
        deltaUnits: number,
        fillPaletteId: string,
    ) => void;
    createPalette: () => void;
    renamePalette: (paletteId: string, nextName: string) => boolean;
    updatePaletteColor: (paletteId: string, nextColor: string) => void;
    updatePalettePublic: (paletteId: string, nextPublic: boolean) => void;
    updatePaletteIcon: (paletteId: string, nextIcon: string | null) => void;
    deletePalette: (paletteId: string) => boolean;
    openWithFilePicker: () => Promise<void>;
    createNewFile: () => Promise<void>;
    downloadProject: () => void;
    closeFile: () => void;
}

// 工作区状态 Context
const WorkspaceStateContext = createContext<WorkspaceState | undefined>(
    undefined,
);

// 工作区动作 Context
const WorkspaceActionsContext = createContext<WorkspaceActions | undefined>(
    undefined,
);

// 生成回放模式的初始状态
function createInitialReplayState() {
    return {
        replayData: null,
        replayFileHandle: null,
        replayFileName: null,
        replayCurrentStep: 0,
    };
}

// 创建工作区的初始状态
function createInitialWorkspaceState(): WorkspaceState {
    return {
        project: cloneProject(DEFAULT_PROJECT),
        selectedNamespaceId: ROOT_NAMESPACE_ID,
        viewMode: "welcome",
        selectedPatternId: null,
        selectedPaletteId: null,
        fileHandle: null,
        fileName: null,
        ...createInitialReplayState(),
    };
}

// reducer 负责应用纯状态更新
function workspaceReducer(
    state: WorkspaceState,
    action: WorkspaceReducerAction,
) {
    switch (action.type) {
        case "update":
            return action.updater(state);
        default:
            return state;
    }
}

// 获取有效的当前命名空间 ID
function getActiveNamespaceId(state: WorkspaceState) {
    if (state.project.namespaces.has(state.selectedNamespaceId)) {
        return state.selectedNamespaceId;
    }

    return ROOT_NAMESPACE_ID;
}

// 获取当前命名空间数据
function getActiveNamespace(state: WorkspaceState): NamespaceData {
    const activeNamespaceId = getActiveNamespaceId(state);
    const activeNamespace = state.project.namespaces.get(activeNamespaceId);
    if (activeNamespace) {
        return activeNamespace;
    }

    return createEmptyNamespaceData();
}

// 生成新的 pattern 默认名称
function createNextPatternId(namespace: NamespaceData) {
    let index = 0;
    let newId = "_NewPattern";

    while (namespace.patterns.has(newId)) {
        index += 1;
        newId = `_NewPattern${index}`;
    }

    return newId;
}

// 生成新的 palette 默认名称
function createNextPaletteId(namespace: NamespaceData) {
    let index = 0;
    let newId = "_NewPalette";

    while (namespace.palette.has(newId)) {
        index += 1;
        newId = `_NewPalette${index}`;
    }

    return newId;
}

// 判断两份单元格数组是否完全一致
function areCellsEqual(left: string[], right: string[]) {
    return (
        left.length === right.length &&
        left.every((cell, index) => cell === right[index])
    );
}

// 将文本内容下载为本地文件
function downloadTextFile(content: string, fileName: string) {
    const blob = new Blob([content], {
        type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);

    try {
        link.click();
    } finally {
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    }
}

// 将错误对象转换为适合展示的消息
function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "操作失败，请重试";
}

// 执行一次文件同步，并保留“首次打开跳过回写”的语义
async function syncProjectToFile(
    fileHandle: FileSystemFileHandle,
    project: ProjectData,
    skipNextSyncContentRef: MutableRefObject<string | null>,
) {
    const content = projectToJson(project);
    const loadedContent = skipNextSyncContentRef.current;

    if (loadedContent !== null) {
        skipNextSyncContentRef.current = null;
        if (content === loadedContent) {
            return;
        }
    }

    try {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (error) {
        console.error("同步到文件失败:", error);
        notifications.show({
            title: "同步失败",
            message: "写入本地文件失败，请重新打开文件或下载导出",
            color: "red",
        });
    }
}

// WorkspaceProvider 负责聚合状态、动作与文件同步副作用
export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(
        workspaceReducer,
        createInitialWorkspaceState(),
    );
    const stateRef = useRef(state);
    const skipNextSyncContentRef = useRef<string | null>(null);
    const isFileSystemAccessSupported =
        typeof window !== "undefined" &&
        "showOpenFilePicker" in window &&
        "showSaveFilePicker" in window;

    stateRef.current = state;

    const updateState = useCallback(
        (updater: (prev: WorkspaceState) => WorkspaceState) => {
            dispatch({ type: "update", updater });
        },
        [],
    );

    const actions = useMemo<WorkspaceActions>(
        () => ({
            isFileSystemAccessSupported,
            goToWelcome() {
                updateState((prev) => ({
                    ...prev,
                    viewMode: "welcome",
                }));
            },
            openPlayback() {
                updateState((prev) => ({
                    ...prev,
                    viewMode: "playback",
                }));
            },
            setReplayImportResult({ replayData, fileHandle, fileName }) {
                updateState((prev) => ({
                    ...prev,
                    replayData,
                    replayFileHandle: fileHandle,
                    replayFileName: fileName,
                    replayCurrentStep:
                        replayData.frames.length > 0
                            ? replayData.frames.length - 1
                            : 0,
                }));
            },
            setReplayCurrentStep(step) {
                updateState((prev) => ({
                    ...prev,
                    replayCurrentStep: step,
                }));
            },
            clearReplayState() {
                updateState((prev) => ({
                    ...prev,
                    ...createInitialReplayState(),
                }));
            },
            selectNamespace(namespaceId) {
                updateState((prev) => {
                    if (!prev.project.namespaces.has(namespaceId)) {
                        return prev;
                    }

                    if (prev.selectedNamespaceId === namespaceId) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: namespaceId,
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        viewMode: "welcome",
                    };
                });
            },
            createNamespace(parentNamespaceId, segment) {
                const trimmedSegment = segment.trim();
                if (!isNamespaceSegmentValid(trimmedSegment)) {
                    notifications.show({
                        title: "命名空间名称无效",
                        message: "名称段仅允许字母、数字和下划线",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(parentNamespaceId)) {
                    return false;
                }

                const newNamespaceId = createNamespaceId(
                    parentNamespaceId,
                    trimmedSegment,
                );
                if (currentState.project.namespaces.has(newNamespaceId)) {
                    notifications.show({
                        title: "创建失败",
                        message: "同名命名空间已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    if (
                        !prev.project.namespaces.has(parentNamespaceId) ||
                        prev.project.namespaces.has(newNamespaceId)
                    ) {
                        return prev;
                    }

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(newNamespaceId, createEmptyNamespaceData());

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: newNamespaceId,
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        viewMode: "welcome",
                    };
                });

                return true;
            },
            renameNamespace(namespaceId, segment) {
                const trimmedSegment = segment.trim();
                if (namespaceId === ROOT_NAMESPACE_ID) {
                    notifications.show({
                        title: "无法重命名",
                        message: "根命名空间不可重命名",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                if (!isNamespaceSegmentValid(trimmedSegment)) {
                    notifications.show({
                        title: "命名空间名称无效",
                        message: "名称段仅允许字母、数字和下划线",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(namespaceId)) {
                    return false;
                }

                const parentId = getNamespaceParentId(namespaceId);
                if (parentId === null) {
                    return false;
                }

                const nextNamespaceId = createNamespaceId(
                    parentId,
                    trimmedSegment,
                );
                if (nextNamespaceId === namespaceId) {
                    return true;
                }

                if (currentState.project.namespaces.has(nextNamespaceId)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "目标命名空间已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                const namespacesToMove = getNamespaceDescendantIds(
                    currentState.project.namespaces,
                    namespaceId,
                    true,
                );
                const movingSet = new Set(namespacesToMove);
                const nextIds = namespacesToMove.map((id) => {
                    if (id === namespaceId) {
                        return nextNamespaceId;
                    }

                    return `${nextNamespaceId}${id.slice(namespaceId.length)}`;
                });
                const duplicateCheck = new Set<string>();
                for (const id of nextIds) {
                    if (duplicateCheck.has(id)) {
                        return false;
                    }
                    duplicateCheck.add(id);
                }

                for (const id of nextIds) {
                    if (
                        currentState.project.namespaces.has(id) &&
                        !movingSet.has(id)
                    ) {
                        notifications.show({
                            title: "无法重命名",
                            message: "重命名结果与现有命名空间冲突",
                            icon: <IconX size={16} />,
                            color: "red",
                        });
                        return false;
                    }
                }

                updateState((prev) => {
                    if (!prev.project.namespaces.has(namespaceId)) {
                        return prev;
                    }

                    const descendantIds = getNamespaceDescendantIds(
                        prev.project.namespaces,
                        namespaceId,
                        true,
                    );
                    const descendantSet = new Set(descendantIds);
                    const remappedIds = descendantIds.map((id) => {
                        if (id === namespaceId) {
                            return nextNamespaceId;
                        }
                        return `${nextNamespaceId}${id.slice(namespaceId.length)}`;
                    });
                    const remappedSet = new Set(remappedIds);
                    if (remappedSet.size !== remappedIds.length) {
                        return prev;
                    }

                    for (const id of remappedIds) {
                        if (prev.project.namespaces.has(id) && !descendantSet.has(id)) {
                            return prev;
                        }
                    }

                    const nextNamespaces = new Map<string, NamespaceData>();
                    for (const [id, namespace] of prev.project.namespaces.entries()) {
                        if (descendantSet.has(id)) {
                            continue;
                        }

                        nextNamespaces.set(id, namespace);
                    }

                    for (const id of descendantIds) {
                        const namespace = prev.project.namespaces.get(id);
                        if (!namespace) {
                            return prev;
                        }

                        const mappedId =
                            id === namespaceId
                                ? nextNamespaceId
                                : `${nextNamespaceId}${id.slice(namespaceId.length)}`;
                        nextNamespaces.set(mappedId, namespace);
                    }

                    const remapSelectedNamespace = (id: string) => {
                        if (id === namespaceId) {
                            return nextNamespaceId;
                        }

                        if (isNamespaceDescendant(id, namespaceId)) {
                            return `${nextNamespaceId}${id.slice(namespaceId.length)}`;
                        }

                        return id;
                    };

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces: nextNamespaces,
                        },
                        selectedNamespaceId: remapSelectedNamespace(
                            prev.selectedNamespaceId,
                        ),
                    };
                });

                return true;
            },
            deleteNamespace(namespaceId) {
                if (namespaceId === ROOT_NAMESPACE_ID) {
                    notifications.show({
                        title: "无法删除",
                        message: "根命名空间不可删除",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(namespaceId)) {
                    return false;
                }

                updateState((prev) => {
                    if (!prev.project.namespaces.has(namespaceId)) {
                        return prev;
                    }

                    const toDelete = getNamespaceDescendantIds(
                        prev.project.namespaces,
                        namespaceId,
                        true,
                    );
                    const deleteSet = new Set(toDelete);
                    const namespaces = new Map<string, NamespaceData>();

                    for (const [id, namespace] of prev.project.namespaces.entries()) {
                        if (deleteSet.has(id)) {
                            continue;
                        }

                        namespaces.set(id, namespace);
                    }

                    const selectedNamespaceDeleted = deleteSet.has(
                        prev.selectedNamespaceId,
                    );
                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: selectedNamespaceDeleted
                            ? ROOT_NAMESPACE_ID
                            : prev.selectedNamespaceId,
                        selectedPatternId: selectedNamespaceDeleted
                            ? null
                            : prev.selectedPatternId,
                        selectedPaletteId: selectedNamespaceDeleted
                            ? null
                            : prev.selectedPaletteId,
                        viewMode:
                            selectedNamespaceDeleted &&
                            prev.viewMode === "editor"
                                ? "welcome"
                                : prev.viewMode,
                    };
                });

                return true;
            },
            selectPattern(patternId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace?.patterns.has(patternId)) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: patternId,
                        viewMode: "editor",
                    };
                });
            },
            setSelectedPaletteId(paletteId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    if (
                        paletteId !== null &&
                        !activeNamespace.palette.has(paletteId)
                    ) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId: paletteId,
                    };
                });
            },
            createPattern() {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const newId = createNextPatternId(activeNamespace);
                    const patterns = new Map(activeNamespace.patterns);
                    const patternOrder = [...activeNamespace.patternOrder];

                    patterns.set(newId, createEmptyPatternRule());
                    patternOrder.push(newId);

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                        patternOrder,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: newId,
                        viewMode: "editor",
                    };
                });
            },
            renamePattern(patternId, nextName) {
                const trimmed = nextName.trim();
                if (!trimmed || trimmed === patternId) {
                    return true;
                }

                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.patterns.has(patternId)) {
                    return false;
                }

                if (currentNamespace.patterns.has(trimmed)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "相同名字的规则已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    const rule = patterns.get(patternId);
                    if (!rule) {
                        return prev;
                    }

                    patterns.delete(patternId);
                    patterns.set(trimmed, clonePatternRule(rule));

                    const patternOrder = activeNamespace.patternOrder.includes(
                        patternId,
                    )
                        ? activeNamespace.patternOrder.map((id) =>
                              id === patternId ? trimmed : id,
                          )
                        : [...activeNamespace.patternOrder, trimmed];

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                        patternOrder,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId:
                            prev.selectedPatternId === patternId
                                ? trimmed
                                : prev.selectedPatternId,
                    };
                });

                return true;
            },
            deletePattern(patternId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    if (!patterns.has(patternId)) {
                        return prev;
                    }

                    patterns.delete(patternId);
                    const patternOrder = activeNamespace.patternOrder.filter(
                        (id) => id !== patternId,
                    );
                    const wasSelected = prev.selectedPatternId === patternId;
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                        patternOrder,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: wasSelected
                            ? null
                            : prev.selectedPatternId,
                        viewMode:
                            wasSelected && prev.viewMode === "editor"
                                ? "welcome"
                                : prev.viewMode,
                    };
                });
            },
            movePattern(sourceId, targetId, position) {
                if (sourceId === targetId) {
                    return;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const orderedIds = getOrderedPatternIds(
                        activeNamespace.patternOrder,
                        activeNamespace.patterns,
                    );
                    if (
                        !orderedIds.includes(sourceId) ||
                        !orderedIds.includes(targetId)
                    ) {
                        return prev;
                    }

                    const nextPatternOrder = orderedIds.filter(
                        (id) => id !== sourceId,
                    );
                    const insertIndex = nextPatternOrder.indexOf(targetId);

                    if (insertIndex < 0) {
                        return prev;
                    }

                    nextPatternOrder.splice(
                        position === "before" ? insertIndex : insertIndex + 1,
                        0,
                        sourceId,
                    );

                    const unchanged =
                        nextPatternOrder.length ===
                            activeNamespace.patternOrder.length &&
                        nextPatternOrder.every(
                            (id, index) =>
                                id === activeNamespace.patternOrder[index],
                        );

                    if (unchanged) {
                        return prev;
                    }

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patternOrder: nextPatternOrder,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePatternCapture(patternId, nextCapture) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || areCellsEqual(rule.capture, nextCapture)) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        capture: [...nextCapture],
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePatternReplace(patternId, nextReplace) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || areCellsEqual(rule.replace, nextReplace)) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        replace: [...nextReplace],
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            resizePattern(patternId, direction, deltaUnits, fillPaletteId) {
                if (deltaUnits === 0) {
                    return;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || !activeNamespace.palette.has(fillPaletteId)) {
                        return prev;
                    }

                    const nextCapture = applyResizeGrid({
                        direction,
                        deltaUnits,
                        fillColor: fillPaletteId,
                        width: rule.width,
                        data: rule.capture,
                    });
                    const nextReplace = applyResizeGrid({
                        direction,
                        deltaUnits,
                        fillColor: fillPaletteId,
                        width: rule.width,
                        data: rule.replace,
                    });

                    if (
                        nextCapture.width === rule.width &&
                        nextCapture.data === rule.capture &&
                        nextReplace.data === rule.replace
                    ) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        width: nextCapture.width,
                        capture: nextCapture.data,
                        replace: nextReplace.data,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            createPalette() {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const newId = createNextPaletteId(activeNamespace);
                    const palette = new Map(activeNamespace.palette);

                    palette.set(newId, {
                        color: "#ffffff",
                        icon: null,
                        public: false,
                    });

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId: newId,
                    };
                });
            },
            renamePalette(paletteId, nextName) {
                const trimmed = nextName.trim();
                if (!trimmed || trimmed === paletteId) {
                    return true;
                }

                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.palette.has(paletteId)) {
                    return false;
                }

                if (currentNamespace.palette.has(trimmed)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "相同名字的 palette 已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace?.palette.has(paletteId)) {
                        return prev;
                    }

                    const palette = new Map<string, PaletteEntry>();
                    for (const [id, entry] of activeNamespace.palette.entries()) {
                        if (id === paletteId) {
                            palette.set(trimmed, clonePaletteEntry(entry));
                            continue;
                        }

                        palette.set(id, clonePaletteEntry(entry));
                    }

                    const patterns = new Map(
                        Array.from(activeNamespace.patterns.entries()).map(
                            ([id, rule]) => {
                                const nextCapture = replacePaletteNameInCells(
                                    rule.capture,
                                    paletteId,
                                    trimmed,
                                );
                                const nextReplace = replacePaletteNameInCells(
                                    rule.replace,
                                    paletteId,
                                    trimmed,
                                );

                                if (
                                    nextCapture === rule.capture &&
                                    nextReplace === rule.replace
                                ) {
                                    return [id, rule] as const;
                                }

                                return [
                                    id,
                                    {
                                        ...rule,
                                        capture: nextCapture,
                                        replace: nextReplace,
                                    },
                                ] as const;
                            },
                        ),
                    );
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId:
                            prev.selectedPaletteId === paletteId
                                ? trimmed
                                : prev.selectedPaletteId,
                    };
                });

                return true;
            },
            updatePaletteColor(paletteId, nextColor) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.color === nextColor) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        color: nextColor,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePalettePublic(paletteId, nextPublic) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.public === nextPublic) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        public: nextPublic,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePaletteIcon(paletteId, nextIcon) {
                const normalizedIcon = nextIcon?.trim() || null;

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.icon === normalizedIcon) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        icon: normalizedIcon,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            deletePalette(paletteId) {
                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.palette.has(paletteId)) {
                    return false;
                }

                if (countPaletteReferences(currentNamespace, paletteId) > 0) {
                    notifications.show({
                        title: "无法删除",
                        message:
                            "该 palette 仍被 pattern 引用，请先替换相关单元格后再删除",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.delete(paletteId);
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId:
                            prev.selectedPaletteId === paletteId
                                ? null
                                : prev.selectedPaletteId,
                    };
                });

                return true;
            },
            async openWithFilePicker() {
                if (!isFileSystemAccessSupported) {
                    return;
                }

                try {
                    const [handle] = await window.showOpenFilePicker({
                        types: [
                            {
                                description: "TESPAT 项目文件",
                                accept: {
                                    "application/json": [".tsp", ".json"],
                                },
                            },
                        ],
                    });
                    const file = await handle.getFile();
                    const text = await file.text();
                    const project = jsonToProject(text);
                    const normalizedContent = projectToJson(project);
                    const permission = await handle.requestPermission({
                        mode: "readwrite",
                    });

                    if (permission !== "granted") {
                        return;
                    }

                    skipNextSyncContentRef.current = normalizedContent;
                    updateState((prev) => ({
                        ...prev,
                        project,
                        selectedNamespaceId: ROOT_NAMESPACE_ID,
                        viewMode: "welcome",
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        fileHandle: handle,
                        fileName: handle.name,
                        ...createInitialReplayState(),
                    }));
                } catch (error) {
                    if ((error as Error).name !== "AbortError") {
                        console.error("打开文件失败:", error);
                        notifications.show({
                            title: "打开失败",
                            message: getErrorMessage(error),
                            color: "red",
                        });
                    }
                }
            },
            async createNewFile() {
                if (!isFileSystemAccessSupported) {
                    return;
                }

                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: "untitled.tsp",
                        types: [
                            {
                                description: "TESPAT 项目文件",
                                accept: {
                                    "application/json": [".json", ".tsp"],
                                },
                            },
                        ],
                    });
                    const defaultProject = cloneProject(DEFAULT_PROJECT);
                    const content = projectToJson(defaultProject);
                    const writable = await handle.createWritable();
                    await writable.write(content);
                    await writable.close();

                    skipNextSyncContentRef.current = null;
                    updateState((prev) => ({
                        ...prev,
                        project: defaultProject,
                        selectedNamespaceId: ROOT_NAMESPACE_ID,
                        viewMode: "welcome",
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        fileHandle: handle,
                        fileName: handle.name,
                        ...createInitialReplayState(),
                    }));
                } catch (error) {
                    if ((error as Error).name !== "AbortError") {
                        console.error("新建文件失败:", error);
                        notifications.show({
                            title: "新建失败",
                            message: getErrorMessage(error),
                            color: "red",
                        });
                    }
                }
            },
            downloadProject() {
                const currentState = stateRef.current;
                const content = projectToJson(currentState.project);
                downloadTextFile(
                    content,
                    currentState.fileName ?? "untitled.tsp",
                );
            },
            closeFile() {
                skipNextSyncContentRef.current = null;
                updateState((prev) => ({
                    ...prev,
                    fileHandle: null,
                    fileName: null,
                }));
            },
        }),
        [isFileSystemAccessSupported, updateState],
    );

    useEffect(() => {
        const fileHandle = state.fileHandle;
        if (!fileHandle) {
            return;
        }

        const timer = window.setTimeout(() => {
            void syncProjectToFile(
                fileHandle,
                state.project,
                skipNextSyncContentRef,
            );
        }, SYNC_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [state.fileHandle, state.project]);

    return (
        <WorkspaceStateContext.Provider value={state}>
            <WorkspaceActionsContext.Provider value={actions}>
                {children}
            </WorkspaceActionsContext.Provider>
        </WorkspaceStateContext.Provider>
    );
}

// 读取工作区状态
export function useWorkspace() {
    const context = useContext(WorkspaceStateContext);
    if (!context) {
        throw new Error("useWorkspace must be used within WorkspaceProvider");
    }
    return context;
}

// 读取当前选中命名空间数据
export function useWorkspaceNamespace() {
    const workspace = useWorkspace();
    return getActiveNamespace(workspace);
}

// 读取工作区动作
export function useWorkspaceActions() {
    const context = useContext(WorkspaceActionsContext);
    if (!context) {
        throw new Error(
            "useWorkspaceActions must be used within WorkspaceProvider",
        );
    }
    return context;
}
