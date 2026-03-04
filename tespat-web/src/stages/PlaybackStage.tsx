import { Box } from "@mantine/core";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import GridDisplaySlider from "../components/GridDisplaySlider/GridDisplaySlider";
import { useEditor } from "../EditorData";
import styles from "../App.module.css";

/** 主舞台 - 回放模式：可拖拽的中央网格显示 + 演化时间轴 */
export function PlaybackStage() {
    const { editor } = useEditor();

    return (
        <Box className={styles.UIStack}>
            <Box className={styles.canvasStage}>
                <CtrlDragPannable className={styles.canvasPlaceholder}>
                    <GridDisplay2D
                        width={editor.editingGrid.width}
                        data={editor.editingGrid.data}
                        enableEdit={false}
                    />
                </CtrlDragPannable>
            </Box>
            <GridDisplaySlider />
        </Box>
    );
}
