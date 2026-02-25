use rand::{RngExt, seq::SliceRandom};

use crate::{app::Tespat, pattern::Pattern};

/// 模式匹配结果
pub struct Matches(pub(super) Vec<(usize, usize)>);

impl Matches {
    /// 匹配及筛选后剩余结果的总数
    pub const fn len(&self) -> usize {
        self.0.len()
    }

    /// 保留所有坐标，仅将坐标打乱
    pub fn shuffle(&mut self) {
        self.0.shuffle(&mut rand::rng());
    }

    /// 按比率随机挑选一部分坐标。
    pub fn random_pick_by_ratio(&mut self, ratio: f32) {
        self.random_pick((self.len() as f32 * ratio) as usize);
    }

    /// 按个数随机挑选一部分坐标。如果输入值超过最大个数则为保留全部并打乱。
    pub fn random_pick(&mut self, reserve_count: usize) {
        let mut rng = rand::rng();
        for i in 0..reserve_count.min(self.len()) {
            let picked = rng.random_range(i..self.len());
            self.0.swap(i, picked);
        }

        self.0.truncate(reserve_count);
    }
}

impl Matches {
    pub fn pick_non_overlapping<T>(
        &mut self,
        tespat: &Tespat<T>,
        match_pattern: &Pattern<T>,
        replace_pattern: &Pattern<T>,
    ) {
        let mut bitset = tespat.overlapping_bitset.borrow_mut();
        bitset.fill(false);
        bitset.resize(tespat.layer.size(), false);

        let pattern_size = match_pattern.grid().len();

        assert_eq!(
            (match_pattern.width(), pattern_size),
            (replace_pattern.width(), replace_pattern.grid().len()),
            "size of match pattern must equal to replace pattern"
        );

        // 只有输入和输出中都是通配符的部分才透过
        let mask: Vec<bool> = match_pattern
            .grid()
            .iter()
            .zip(replace_pattern.grid().iter())
            .map(|(m_c, r_c)| m_c.is_some() || r_c.is_some())
            .collect();

        self.shuffle();
        self.0.retain(|&(left, top)| {
            let index_iter = iter_region_indexes(
                tespat.layer.width(),
                left,
                top,
                match_pattern.width(),
                match_pattern.height(),
            )
            .zip(mask.iter().copied());

            for (index, will_occupy) in index_iter.clone() {
                if bitset[index] && will_occupy {
                    return false;
                }
            }

            for (index, will_occupy) in index_iter {
                if will_occupy {
                    bitset[index] = true;
                }
            }

            true
        });
    }
}

#[rustfmt::skip]
fn iter_region_indexes(
    region_width: usize,
    left: usize,
    top: usize,
    width: usize,
    height: usize,
) -> impl Iterator<Item = usize> + Clone {
    (top..top + height)
        .flat_map(move |y| {
            (left..left + width)
                .map(move |x| {
                    x + y * region_width
                })
        })
}
