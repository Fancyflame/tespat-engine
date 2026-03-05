use crate::{PatternColor, index_to_position, layer::Layer, pattern::Pattern};

/// 匹配结果
#[derive(Default)]
pub struct PatternMatchResult {
    /// 对应模式的左上角位置
    pub positions: Vec<(usize, usize)>,
}

impl<T: PatternColor> Layer<T> {
    /// 查找出层中所有匹配该模式的位置。不保证任何顺序。
    pub fn match_pattern(&self, pattern: &Pattern<T>) -> PatternMatchResult {
        let Some(check_positions) = self.compute_check_positions(pattern) else {
            // 模式中没有颜色：只要 layer 能容纳该模式尺寸的所有位置都是候选
            if self.row_width < pattern.width() || self.height() < pattern.height() {
                return PatternMatchResult::default();
            }

            let max_left = self.row_width - pattern.width();
            let max_top = self.height() - pattern.height();

            return PatternMatchResult {
                positions: (0..=max_top)
                    .flat_map(|y| (0..=max_left).map(move |x| (x, y)))
                    .collect(),
            };
        };

        let mut final_positions = check_positions;
        final_positions.retain(|(left, top)| {
            for (i, opt_color) in pattern.grid().iter().enumerate() {
                if let Some(p_color) = opt_color.as_ref() {
                    let (px, py) = index_to_position(i, pattern.width());
                    let lx = left + px;
                    let ly = top + py;

                    if !matches!(self.read(lx, ly), Some(c) if c == p_color) {
                        return false;
                    }
                } // 如果是None则代表匹配任意
            }
            true
        });

        PatternMatchResult {
            positions: final_positions,
        }
    }

    /// 以模式中的最罕见颜色快速筛选出模式可能在层中匹配的位置。如果模式中没有颜色，则返回None
    fn compute_check_positions(&self, pattern: &Pattern<T>) -> Option<Vec<(usize, usize)>> {
        let mut positions = Vec::new();

        let (color, index) = self.find_fewest_color(pattern)?;

        let (off_x, off_y) = index_to_position(index, pattern.width());

        // 对于 layer 中每个该颜色的位置，计算对应的模式左上角坐标
        for (x, y) in self.get_color_positions(color) {
            // 如果该位置在左上偏移之前，则会发生 underflow，跳过
            if x < off_x || y < off_y {
                continue;
            }

            let left = x - off_x;
            let top = y - off_y;

            // 如果模式放在 (left, top) 会超出 layer 边界，则丢弃
            if left + pattern.width() > self.row_width || top + pattern.height() > self.height() {
                continue;
            }

            positions.push((left, top));
        }

        Some(positions)
    }
}
