use std::collections::{HashMap, hash_map::Entry};

use crate::{CaptureColor, index_to_position, pattern::transform::TransformedPattern};

use super::GraphColor;

pub mod pattern_match;
pub mod pattern_replace;

/// 颜色链表的信息
#[derive(Clone)]
struct ColorChain {
    /// 头元素下标
    head_index: usize,

    /// 总元素数量
    len: usize,
}

/// 索引表中的每个元素
#[derive(Clone, Copy)]
struct Metadata {
    /// 相同颜色的前一个元素的索引
    prev_index: Option<usize>,

    /// 相同颜色的后一个元素的索引
    next_index: Option<usize>,
}

impl Metadata {
    const PLACEHOLDER: Self = Metadata {
        prev_index: None,
        next_index: None,
    };
}

#[derive(Clone)]
pub struct Layer<T> {
    /// 所有颜色对应的链表
    color_indexes: HashMap<T, ColorChain>,

    /// 行宽
    row_width: usize,

    /// 每个颜色的元信息
    metadata_vec: Vec<Metadata>,

    /// 根据位置获取信息的表
    data_vec: Vec<T>,
}

// 写入实现
impl<T: GraphColor> Layer<T> {
    pub fn new() -> Self {
        Self {
            color_indexes: HashMap::new(),
            row_width: 0,
            metadata_vec: Vec::new(),
            data_vec: Vec::new(),
        }
    }

    /// 用数据初始化
    pub fn initialize<F>(&mut self, row_width: usize, mutate_data: F)
    where
        F: FnOnce(&mut Vec<T>),
    {
        self.color_indexes.clear();
        self.row_width = row_width;

        mutate_data(&mut self.data_vec);

        self.metadata_vec
            .resize(self.data_vec.len(), Metadata::PLACEHOLDER);

        for i in 0..self.data_vec.len() {
            self.record_color(i);
        }
    }

    /// 变更颜色
    pub fn mutate_color(&mut self, index: usize, color: T) {
        if self.data_vec[index] == color {
            return;
        }

        self.invalidate_color(index);
        self.data_vec[index] = color;
        self.record_color(index);
    }

    /// 将一个位置的颜色在索引中无效化。需要尽快为该位置写入颜色。
    fn invalidate_color(&mut self, index: usize) {
        let color = &self.data_vec[index];
        let metadata = self.metadata_vec[index];

        let chain = self.color_indexes.get_mut(color).unwrap();
        chain.len -= 1;

        match (metadata.prev_index, metadata.next_index) {
            (Some(prev_index), Some(next_index)) => {
                // 这是在链中间的元素
                self.metadata_vec[prev_index].next_index = metadata.next_index;
                self.metadata_vec[next_index].prev_index = metadata.prev_index;
            }
            (None, Some(next_index)) => {
                // 这是第一个元素
                self.metadata_vec[next_index].prev_index = None;
                chain.head_index = next_index;
            }
            (Some(prev_index), None) => {
                // 这是最后一个元素
                self.metadata_vec[prev_index].next_index = None;
            }
            (None, None) => {
                // 这是唯一的元素
                self.color_indexes.remove(&color);
            }
        }
    }

    /// 将新颜色填入一个位置。将会将旧颜色视为未初始化，直接覆写旧颜色。
    fn record_color(&mut self, index: usize) {
        let color = &self.data_vec[index];

        match self.color_indexes.entry(color.clone()) {
            Entry::Vacant(vac) => {
                vac.insert(ColorChain {
                    head_index: index,
                    len: 1,
                });
                self.metadata_vec[index] = Metadata {
                    prev_index: None,
                    next_index: None,
                };
            }
            Entry::Occupied(mut occ) => {
                let head_index = &mut occ.get_mut().head_index;
                self.metadata_vec[*head_index].prev_index = Some(index);
                self.metadata_vec[index] = Metadata {
                    prev_index: None,
                    next_index: Some(*head_index),
                };

                *head_index = index;
                occ.get_mut().len += 1;
            }
        }
    }
}

// 读取实现
impl<T: GraphColor> Layer<T> {
    /// 找出总候选量最小的索引锚点；`AnyOf` 会按并集频率参与比较。
    fn find_fewest_color<'a, P>(
        &self,
        pattern: TransformedPattern<'a, P>,
    ) -> Option<(&'a [P], (usize, usize))>
    where
        P: CaptureColor<T>,
    {
        pattern
            .color_kinds()
            .filter_map(|(color, i)| {
                let indexed_colors = color.indexed_colors()?;

                let total_count = indexed_colors
                    .iter()
                    .filter_map(|match_color| {
                        let graph_color = match_color.as_index(pattern.symmetry)?;
                        Some(self.color_count(&graph_color))
                    })
                    .sum::<usize>();

                Some((total_count, indexed_colors, i))
            })
            .min_by_key(|(total_count, _, _)| *total_count)
            .map(|(_, colors, position)| (colors, position))
    }

    /// 获得对应颜色在图像中的所有位置
    fn get_color_positions<'a>(&'a self, color: &T) -> ColorPositions<'a, T> {
        let next_index = self.color_indexes.get(color).map(|chain| chain.head_index);
        ColorPositions {
            layer: self,
            next_index,
        }
    }

    /// 读取给定位置上的颜色
    pub fn read(&self, x: usize, y: usize) -> Option<&T> {
        if x >= self.row_width {
            return None;
        }

        let index = x + y * self.row_width;
        self.data_vec.get(index)
    }

    /// 获取一种颜色在图中的数量。复杂度为O(1)。
    pub fn color_count(&self, color: &T) -> usize {
        match self.color_indexes.get(color) {
            Some(chain) => chain.len,
            None => 0,
        }
    }

    /// 用邻近算法将当前图像细化为新的层
    pub fn refine(&mut self, n: usize) {
        let src_width = self.row_width;
        let src_height = self.height();
        let src_data = self.data_vec.clone();

        if n == 0 {
            self.initialize(0, |vec| vec.clear());
            return;
        }

        self.initialize(src_width.saturating_mul(n), move |vec| {
            vec.clear();
            vec.reserve(src_data.len() * n * n);

            for src_y in 0..src_height {
                let src_row_start = src_y * src_width;
                for _ in 0..n {
                    for src_x in 0..src_width {
                        let color = &src_data[src_row_start + src_x];
                        for _ in 0..n {
                            vec.push(color.clone());
                        }
                    }
                }
            }
        });
    }
}

impl<T> Layer<T> {
    /// 导出图
    pub fn export(&self) -> &Vec<T> {
        &self.data_vec
    }

    pub fn width(&self) -> usize {
        self.row_width
    }

    pub fn height(&self) -> usize {
        if self.row_width == 0 {
            debug_assert!(self.data_vec.is_empty());
            0
        } else {
            self.data_vec.len() / self.row_width
        }
    }

    pub fn len(&self) -> usize {
        self.data_vec.len()
    }
}

pub struct ColorPositions<'a, T> {
    layer: &'a Layer<T>,
    next_index: Option<usize>,
}

impl<'a, T> Iterator for ColorPositions<'a, T> {
    type Item = (usize, usize);
    fn next(&mut self) -> Option<Self::Item> {
        let index = self.next_index?;
        self.next_index = self.layer.metadata_vec[index].next_index;
        Some(index_to_position(index, self.layer.row_width))
    }
}
