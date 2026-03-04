import { ResizeDirection } from "./ResizeBar";

export type ResizeGridParams = {
    direction: ResizeDirection;
    deltaUnits: number;
    fillColor: string;
    width: number;
    data: string[];
};

export type ResizeGridResult = {
    width: number;
    data: string[];
};

/** 纯函数：根据方向和单元格增量，返回新的网格宽度与数据
 * 这部分是AI生成，如果需要改动直接删除重新生成。
 */
export function applyResizeGrid({
    direction,
    deltaUnits,
    fillColor,
    width,
    data,
}: ResizeGridParams): ResizeGridResult {
    if (deltaUnits === 0) {
        return { width, data };
    }

    const height = width > 0 ? Math.ceil(data.length / width) : 0;
    const isZeroSized = width <= 0 || height <= 0;
    const normalizedWidth = isZeroSized ? 0 : width;

    let newWidth = width;
    let newHeight = height;
    let newData = [...data];

    // 零面积网格的启动逻辑：
    // 从 0 开始正向拖拽时，先把“另一边”设为 1，再沿拖拽方向扩展。
    if (isZeroSized) {
        if (direction === "left" || direction === "right") {
            if (deltaUnits <= 0) {
                return { width: 0, data: [] };
            }

            const bootstrapHeight = 1;
            const bootstrapWidth = normalizedWidth + deltaUnits;
            if (bootstrapWidth <= 0) {
                return { width: 0, data: [] };
            }

            return {
                width: bootstrapWidth,
                data: new Array<string>(bootstrapWidth * bootstrapHeight).fill(
                    fillColor,
                ),
            };
        }

        if (deltaUnits <= 0) {
            return { width: 0, data: [] };
        }

        const bootstrapWidth = normalizedWidth > 0 ? normalizedWidth : 1;
        const bootstrapHeight = Math.max(0, height) + deltaUnits;
        if (bootstrapHeight <= 0) {
            return { width: 0, data: [] };
        }

        return {
            width: bootstrapWidth,
            data: new Array<string>(bootstrapWidth * bootstrapHeight).fill(
                fillColor,
            ),
        };
    }

    // 统一成完整的 width * height 网格
    if (width > 0 && height > 0 && newData.length !== width * height) {
        const fixed = new Array<string>(width * height);
        for (let i = 0; i < fixed.length; i++) {
            fixed[i] = newData[i] ?? "Empty";
        }
        newData = fixed;
    } else if (width <= 0 || height <= 0) {
        newData = [];
    }

    if (direction === "left" || direction === "right") {
        // 水平方向调整宽度
        const change = deltaUnits;
        if (change === 0) {
            return { width, data };
        }

        if (change > 0) {
            // 扩展宽度
            newWidth = width + change;
            if (height <= 0) {
                return { width: newWidth, data: [] };
            }

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                const padding = new Array<string>(change).fill(fillColor);
                if (direction === "right") {
                    rows.push([...row, ...padding]);
                } else {
                    rows.push([...padding, ...row]);
                }
            }
            newData = rows.flat();
        } else {
            // 收缩宽度
            const shrink = Math.min(-change, width);
            if (shrink <= 0) {
                return { width, data };
            }
            newWidth = Math.max(0, width - shrink);
            if (newWidth === 0 || height <= 0) {
                return { width: newWidth, data: [] };
            }

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }

                let sliced: string[];
                if (direction === "right") {
                    sliced = row.slice(0, newWidth);
                } else {
                    // 从左侧裁掉 shrink 列
                    sliced = row.slice(shrink, shrink + newWidth);
                }
                rows.push(sliced);
            }
            newData = rows.flat();
        }
    } else {
        // 垂直方向调整高度
        const change = deltaUnits;
        if (change === 0) {
            return { width, data };
        }

        if (change > 0) {
            // 扩展高度
            newHeight = height + change;
            if (width <= 0) {
                return { width, data: [] };
            }

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                rows.push(row);
            }

            const paddingRow = new Array<string>(width).fill(fillColor);
            const paddingRows: string[][] = new Array(change)
                .fill(null)
                .map(() => [...paddingRow]);

            if (direction === "bottom") {
                newData = [...rows.flat(), ...paddingRows.flat()];
            } else {
                newData = [...paddingRows.flat(), ...rows.flat()];
            }
        } else {
            // 收缩高度
            const shrink = Math.min(-change, height);
            if (shrink <= 0) {
                return { width, data };
            }
            newHeight = Math.max(0, height - shrink);
            if (newHeight === 0 || width <= 0) {
                return { width: 0, data: [] };
            }

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                rows.push(row);
            }

            let slicedRows: string[][];
            if (direction === "bottom") {
                slicedRows = rows.slice(0, newHeight);
            } else {
                // 从顶部裁掉 shrink 行
                slicedRows = rows.slice(shrink, shrink + newHeight);
            }
            newData = slicedRows.flat();
        }
    }

    return {
        width: newWidth,
        data: newData,
    };
}
