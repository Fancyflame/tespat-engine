use rand::{RngExt, seq::SliceRandom};

use crate::{GraphColor, app::Tespat, layer::pattern_match::Match, pattern::Pattern};

/// 模式匹配结果
#[derive(Clone, Debug)]
pub struct Matches {
    pub(super) data: Vec<Match>,
    pub pick_order: PickOrder,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PickOrder {
    /// 保持Vec里的数据直接取出
    AsIs,

    /// 随机取出
    Randomized,

    /// 按顺序取出
    Sorted,
}

impl PickOrder {
    pub const fn reset(&mut self) {
        *self = Self::AsIs;
    }

    pub const fn is_as_is(&self) -> bool {
        matches!(self, Self::AsIs)
    }
}

impl Matches {
    /// 匹配及筛选后剩余结果的总数
    pub const fn len(&self) -> usize {
        self.data.len()
    }

    pub const fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// 将提取顺序塌陷为AsIs
    pub fn pick_all(&mut self) -> &mut Self {
        match self.pick_order {
            PickOrder::AsIs => {}
            PickOrder::Randomized => self.data.shuffle(&mut rand::rng()),
            PickOrder::Sorted => self.data.sort_unstable_by_key(sort_match_cmp),
        }
        self.pick_order.reset();
        self
    }

    /// 按比率随机挑选部分坐标。
    pub fn ratio_pick(&mut self, ratio: f32) -> &mut Self {
        self.pick((self.len() as f32 * ratio) as usize);
        self
    }

    /// 按个数保留部分坐标
    pub fn pick(&mut self, reserve_count: usize) -> &mut Self {
        if reserve_count >= self.len() {
            return self.pick_all();
        }

        match self.pick_order {
            PickOrder::AsIs => {}
            PickOrder::Randomized => {
                let mut rng = rand::rng();
                for i in 0..reserve_count {
                    let picked = rng.random_range(i + 1..self.len());
                    self.data.swap(i, picked);
                }
            }
            PickOrder::Sorted => {
                if reserve_count < self.data.len() / 2 {
                    self.data
                        .select_nth_unstable_by_key(reserve_count, sort_match_cmp);
                    self.data.truncate(reserve_count);
                }
                self.data.sort_unstable_by_key(sort_match_cmp);
            }
        }

        self.data.truncate(reserve_count);
        self.pick_order.reset();
        self
    }

    pub fn optioned(&self) -> Option<&Self> {
        (!self.data.is_empty()).then_some(self)
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

        self.pick_all();
        self.data.retain(|&match_result| {
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

const fn sort_match_cmp(m: &Match) -> (usize, usize) {
    (m.pos_x, m.pos_y)
}
