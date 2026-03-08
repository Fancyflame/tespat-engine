use crate::{
    PatternColor,
    layer::Layer,
    pattern::transform::{Symmetry, TransformedPattern},
};

/// 匹配结果
#[derive(Default)]
pub struct PatternMatchResult {
    /// 对应模式的左上角位置
    pub positions: Vec<Match>,
}

#[derive(Clone, Copy, Debug)]
pub struct Match {
    pub pos_x: usize,
    pub pos_y: usize,
    pub symmetry: Symmetry,
}

impl<T: PatternColor> Layer<T> {
    /// 查找出层中所有匹配该模式的位置。不保证任何顺序。
    pub fn match_pattern(&self, pattern: TransformedPattern<T>) -> PatternMatchResult {
        let (p_width, p_height) = pattern.size();

        let Some(check_positions) = self.compute_check_positions_by_color(pattern) else {
            // 模式中没有颜色：只要 layer 能容纳该模式尺寸的所有位置都是候选
            if self.row_width < p_width || self.height() < p_height {
                return PatternMatchResult::default();
            }

            let max_left = self.row_width - p_width;
            let max_top = self.height() - p_height;

            return PatternMatchResult {
                positions: (0..=max_top)
                    .flat_map(|y| {
                        (0..=max_left).map(move |x| Match {
                            pos_x: x,
                            pos_y: y,
                            symmetry: pattern.symmetry,
                        })
                    })
                    .collect(),
            };
        };

        let mut final_positions = check_positions;
        // 对所有检查点位进行逐颜色检查
        final_positions.retain(|&Match { pos_x, pos_y, .. }| {
            for ((px, py), opt_color) in pattern.iter() {
                if let Some(p_color) = opt_color.as_ref() {
                    let lx = pos_x + px;
                    let ly = pos_y + py;

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
    fn compute_check_positions_by_color(
        &self,
        pattern: TransformedPattern<T>,
    ) -> Option<Vec<Match>> {
        let mut positions = Vec::new();

        let (color, (off_x, off_y)) = self.find_fewest_color(pattern)?;

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

            positions.push(Match {
                pos_x: left,
                pos_y: top,
                symmetry: pattern.symmetry,
            });
        }

        Some(positions)
    }
}
