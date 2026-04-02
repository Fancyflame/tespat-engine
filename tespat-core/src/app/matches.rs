use rand::{RngExt, seq::SliceRandom};

use crate::{GraphColor, app::Tespat, layer::pattern_match::Match, pattern::Pattern};

/// 模式匹配结果
#[derive(Clone, Debug)]
pub struct Matches(pub(super) Vec<Match>);

impl Matches {
    /// 匹配及筛选后剩余结果的总数
    pub const fn len(&self) -> usize {
        self.0.len()
    }

    pub const fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// 保留所有坐标，仅将坐标打乱
    pub fn all(&mut self) -> &Self {
        self.0.shuffle(&mut rand::rng());
        self
    }

    /// 按比率随机挑选一部分坐标。
    pub fn ratio_pick(&mut self, ratio: f32) -> &Self {
        self.pick((self.len() as f32 * ratio) as usize);
        self
    }

    /// 按个数随机挑选一部分坐标。如果输入值超过最大个数则为保留全部并打乱。
    pub fn pick(&mut self, reserve_count: usize) -> &Self {
        let mut rng = rand::rng();
        for i in 0..reserve_count.min(self.len()) {
            let picked = rng.random_range(i..self.len());
            self.0.swap(i, picked);
        }
        self.0.truncate(reserve_count);

        self
    }

    pub fn optioned(&self) -> Option<&Self> {
        (!self.0.is_empty()).then_some(self)
    }
}

impl Matches {
    pub fn pick_non_overlapping<T: GraphColor, M, R>(
        &mut self,
        tespat: &Tespat<T>,
        match_pattern: &Pattern<M>,
        replace_pattern: &Pattern<R>,
    ) -> &Self {
        let mut bitset = tespat.overlapping_bitset.borrow_mut();
        bitset.fill(false);
        bitset.resize(tespat.layer.len(), false);

        let pattern_size = match_pattern.grid().len();

        assert_eq!(
            (match_pattern.width(), pattern_size),
            (replace_pattern.width(), replace_pattern.grid().len()),
            "size of match pattern must equal to replace pattern"
        );

        // 只有“捕获侧 Ignore 且替换侧不会实际写入”的格子才不参与重叠判定。
        let mask: Vec<bool> = match_pattern
            .grid()
            .iter()
            .zip(replace_pattern.grid().iter())
            .map(|(m_c, r_c)| !(m_c.is_ignore() && !r_c.is_exact()))
            .collect();

        self.all();
        self.0.retain(|&match_result| {
            let index_iter = iter_region_indexes(
                tespat.layer.width(),
                match_result,
                match_pattern.width(),
                match_pattern.height(),
                &mask,
            );

            for index in index_iter.clone() {
                if bitset[index] {
                    return false;
                }
            }

            for index in index_iter {
                bitset[index] = true;
            }

            true
        });
        self
    }
}

/// 返回需要检查的元素在图中的下标
fn iter_region_indexes(
    graph_width: usize,
    match_result: Match,
    pattern_w: usize,
    pattern_h: usize,
    mask: &[bool],
) -> impl Iterator<Item = usize> + Clone {
    let Match {
        pos_x,
        pos_y,
        symmetry,
    } = match_result;

    (0..mask.len()).filter_map(move |pattern_index| {
        if !mask[pattern_index] {
            return None;
        }

        let x = pattern_index % pattern_w;
        let y = pattern_index / pattern_w;
        let (mapped_x, mapped_y) = symmetry.map(x, y, pattern_w, pattern_h);
        Some(pos_x + mapped_x + (pos_y + mapped_y) * graph_width)
    })
}
