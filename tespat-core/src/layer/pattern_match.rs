use std::collections::HashSet;

use crate::{
    CaptureColor, GraphColor,
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

/// 预筛候选位的三种路径
enum CheckPositions {
    /// 不进行检查全量点位放行
    Unconstrained,
    /// 将全量点位进行检查
    FullScan,
    /// 需要根据缩小的候选集进行检查
    Indexed(Vec<Match>),
}

impl<T: GraphColor> Layer<T> {
    /// 查找出层中所有匹配该模式的位置。不保证任何顺序。
    /// 先决定候选生成策略，再对候选做统一的逐格验证。
    pub fn match_pattern<P>(&self, pattern: TransformedPattern<P>) -> PatternMatchResult
    where
        P: CaptureColor<T>,
    {
        let (p_width, p_height) = pattern.size();
        if self.row_width < p_width || self.height() < p_height {
            return PatternMatchResult::default();
        }

        let positions = match self.compute_check_positions(pattern) {
            CheckPositions::Unconstrained => self.all_positions(pattern),
            CheckPositions::FullScan => {
                self.filter_matching_positions(self.all_positions(pattern), pattern)
            }
            CheckPositions::Indexed(check_positions) => {
                self.filter_matching_positions(check_positions, pattern)
            }
        };

        PatternMatchResult { positions }
    }

    fn filter_matching_positions<P>(
        &self,
        mut positions: Vec<Match>,
        pattern: TransformedPattern<P>,
    ) -> Vec<Match>
    where
        P: CaptureColor<T>,
    {
        // 所有路径最终都汇总到这里，确保 `Exact/AnyOf/NotIn/Ignore` 的判定一致。
        positions.retain(|&Match { pos_x, pos_y, .. }| {
            for ((px, py), pattern_color) in pattern.iter() {
                let lx = pos_x + px;
                let ly = pos_y + py;

                if !matches!(
                    self.read(lx, ly),
                    Some(color) if pattern_color.matches_graph_color(color, pattern.symmetry)
                ) {
                    return false;
                }
            }

            true
        });

        positions
    }

    /// 枚举模式尺寸可落下的所有左上角位置。
    fn all_positions<P>(&self, pattern: TransformedPattern<P>) -> Vec<Match> {
        let max_left = self.row_width - pattern.width();
        let max_top = self.height() - pattern.height();

        (0..=max_top)
            .flat_map(|y| {
                (0..=max_left).map(move |x| Match {
                    pos_x: x,
                    pos_y: y,
                    symmetry: pattern.symmetry,
                })
            })
            .collect()
    }

    fn compute_check_positions<P>(&self, pattern: TransformedPattern<P>) -> CheckPositions
    where
        P: CaptureColor<T>,
    {
        // 全 Ignore 的 pattern 不需要逐格验证，所有合法位置都成立。
        if pattern
            .color_kinds()
            .all(|(pattern_color, _)| pattern_color.is_ignore())
        {
            return CheckPositions::Unconstrained;
        }

        match self.compute_check_positions_by_color(pattern) {
            Some(positions) => CheckPositions::Indexed(positions),
            None => CheckPositions::FullScan,
        }
    }

    /// 用出现次数最少的索引锚点生成候选位置；`AnyOf` 会合并多个颜色来源并去重。
    fn compute_check_positions_by_color<P>(
        &self,
        pattern: TransformedPattern<P>,
    ) -> Option<Vec<Match>>
    where
        P: CaptureColor<T>,
    {
        let mut positions = Vec::new();
        let mut seen_positions = HashSet::new();

        let (colors, (off_x, off_y)) = self.find_fewest_color(pattern)?;

        for match_color in colors.iter() {
            let graph_color = match_color.as_index(pattern.symmetry).unwrap();

            // 对于 layer 中每个该颜色的位置，计算对应的模式左上角坐标
            for (x, y) in self.get_color_positions(&graph_color) {
                // 如果该位置在左上偏移之前，则会发生 underflow，跳过
                if x < off_x || y < off_y {
                    continue;
                }

                let left = x - off_x;
                let top = y - off_y;

                // 如果模式放在 (left, top) 会超出 layer 边界，则丢弃
                if left + pattern.width() > self.row_width || top + pattern.height() > self.height()
                {
                    continue;
                }

                // `AnyOf` 可能从多个颜色命中同一个左上角，这里只保留一次。
                if !seen_positions.insert((left, top)) {
                    continue;
                }

                positions.push(Match {
                    pos_x: left,
                    pos_y: top,
                    symmetry: pattern.symmetry,
                });
            }
        }

        Some(positions)
    }
}
