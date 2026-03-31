use std::{
    collections::{HashMap, hash_map::Entry},
    iter::FusedIterator,
};

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
struct Element<T> {
    /// 该元素的颜色
    color: T,

    /// 相同颜色的前一个元素的索引
    prev_index: Option<usize>,

    /// 相同颜色的后一个元素的索引
    next_index: Option<usize>,
}

#[derive(Clone)]
pub struct Layer<T> {
    /// 所有颜色对应的链表
    colors: HashMap<T, ColorChain>,

    /// 行宽
    row_width: usize,

    /// 根据位置获取信息的表
    pixel_info_table: Vec<Element<T>>,
}

// 写入实现
impl<T: GraphColor> Layer<T> {
    pub fn new() -> Self {
        Self {
            colors: HashMap::new(),
            row_width: 0,
            pixel_info_table: Vec::new(),
        }
    }

    /// 用数据初始化
    pub fn initialize<I>(&mut self, row_width: usize, grid: I)
    where
        I: Iterator<Item = T>,
    {
        self.colors.clear();
        self.pixel_info_table.clear();
        self.row_width = row_width;

        let mut count = 0usize;

        for (i, data) in grid.enumerate() {
            count += 1;
            self.write_color(i, data, true);
        }

        if let Some(additional) = count.checked_sub(self.pixel_info_table.len()) {
            self.pixel_info_table.reserve_exact(additional);
        }
    }

    /// 变更颜色
    pub fn mutate_color(&mut self, index: usize, color: T) {
        if self.pixel_info_table[index].color == color {
            return;
        }

        self.invalidate_color(index);
        self.write_color(index, color, false);
    }

    /// 将一个位置的颜色在索引中无效化。需要尽快为该位置写入颜色。
    fn invalidate_color(&mut self, index: usize) {
        let element = self.pixel_info_table[index].clone();

        let chain = self.colors.get_mut(&element.color).unwrap();
        chain.len -= 1;

        match (element.prev_index, element.next_index) {
            (Some(prev_index), Some(next_index)) => {
                // 这是在链中间的元素
                self.pixel_info_table[prev_index].next_index = element.next_index;
                self.pixel_info_table[next_index].prev_index = element.prev_index;
            }
            (None, Some(next_index)) => {
                // 这是第一个元素
                self.pixel_info_table[next_index].prev_index = None;
                chain.head_index = next_index;
            }
            (Some(prev_index), None) => {
                // 这是最后一个元素
                self.pixel_info_table[prev_index].next_index = None;
            }
            (None, None) => {
                // 这是唯一的元素
                self.colors.remove(&element.color);
            }
        }
    }

    /// 将新颜色填入一个位置。将会将旧颜色视为未初始化，直接覆写旧颜色。
    fn write_color(&mut self, index: usize, data: T, push_mode: bool) {
        let new_el;

        match self.colors.entry(data.clone()) {
            Entry::Vacant(vac) => {
                vac.insert(ColorChain {
                    head_index: index,
                    len: 1,
                });
                new_el = Element {
                    color: data,
                    prev_index: None,
                    next_index: None,
                };
            }
            Entry::Occupied(mut occ) => {
                let head_index = &mut occ.get_mut().head_index;
                self.pixel_info_table[*head_index].prev_index = Some(index);
                new_el = Element {
                    color: data,
                    prev_index: None,
                    next_index: Some(*head_index),
                };

                *head_index = index;
                occ.get_mut().len += 1;
            }
        };

        if push_mode {
            self.pixel_info_table.push(new_el);
        } else {
            self.pixel_info_table[index] = new_el;
        }
    }
}

// 读取实现
impl<T: GraphColor> Layer<T> {
    /// 找出出现频率最低的颜色。如果迭代器中没有颜色，则返回None。
    fn find_fewest_color<'a, P>(
        &self,
        pattern: TransformedPattern<'a, P>,
    ) -> Option<(T, (usize, usize))>
    where
        P: CaptureColor<T>,
    {
        pattern
            .color_kinds()
            .filter_map(|(color, i)| {
                color.as_ref().and_then(|color| {
                    color
                        .as_index(pattern.symmetry)
                        .map(|graph_color| (graph_color, i))
                })
            })
            .min_by_key(|(color, _)| self.color_count(color))
    }

    /// 获得对应颜色在图像中的所有位置
    fn get_color_positions<'a>(&'a self, color: &T) -> ColorPositions<'a, T> {
        let next_index = self.colors.get(color).map(|chain| chain.head_index);
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
        self.pixel_info_table.get(index).map(|el| &el.color)
    }

    /// 获取一种颜色在图中的数量。复杂度为O(1)。
    pub fn color_count(&self, color: &T) -> usize {
        match self.colors.get(color) {
            Some(chain) => chain.len,
            None => 0,
        }
    }

    /// 用邻近算法将当前图像细化为新的层
    pub fn refine(&self, n: usize) -> Self {
        if n == 0 || self.row_width == 0 || self.pixel_info_table.is_empty() {
            return Self::new();
        }

        let src_width = self.row_width;
        let src_height = self.height();
        let mut refined = Self {
            colors: HashMap::new(),
            row_width: src_width * n,
            pixel_info_table: Vec::with_capacity(self.pixel_info_table.len() * n * n),
        };

        for src_y in 0..src_height {
            let row_start = src_y * src_width;

            for _ in 0..n {
                for src_x in 0..src_width {
                    let color = self.pixel_info_table[row_start + src_x].color.clone();

                    for _ in 0..n {
                        let index = refined.pixel_info_table.len();
                        refined.write_color(index, color.clone(), true);
                    }
                }
            }
        }

        refined
    }
}

impl<T> Layer<T> {
    /// 导出图
    pub fn export(&self) -> ExportLayerIter<'_, T> {
        ExportLayerIter {
            table: self.pixel_info_table.as_slice(),
        }
    }

    pub fn width(&self) -> usize {
        self.row_width
    }

    pub fn height(&self) -> usize {
        if self.row_width == 0 {
            debug_assert!(self.pixel_info_table.is_empty());
            0
        } else {
            self.pixel_info_table.len() / self.row_width
        }
    }

    pub fn len(&self) -> usize {
        self.pixel_info_table.len()
    }
}

/// 导出层颜色的自定义迭代器
#[derive(Clone, Copy)]
pub struct ExportLayerIter<'a, T> {
    table: &'a [Element<T>],
}

/// 导出迭代器的便捷操作
impl<'a, T> ExportLayerIter<'a, T> {
    pub fn skip_n(&mut self, n: usize) -> &mut Self {
        let (_, rest) = self.table.split_at_checked(n).unwrap_or_default();
        self.table = rest;
        self
    }
}

/// 导出迭代器的标准迭代实现
impl<'a, T> Iterator for ExportLayerIter<'a, T> {
    type Item = &'a T;

    fn next(&mut self) -> Option<Self::Item> {
        let (first, rest) = self.table.split_first()?;
        self.table = rest;
        Some(&first.color)
    }

    fn nth(&mut self, n: usize) -> Option<Self::Item> {
        self.skip_n(n);
        self.next()
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let len = self.len();
        (len, Some(len))
    }
}

/// 导出迭代器的精确长度实现
impl<'a, T> ExactSizeIterator for ExportLayerIter<'a, T> {
    fn len(&self) -> usize {
        self.table.len()
    }
}

/// 导出迭代器的融合迭代特性
impl<'a, T> FusedIterator for ExportLayerIter<'a, T> {}

pub struct ColorPositions<'a, T> {
    layer: &'a Layer<T>,
    next_index: Option<usize>,
}

impl<'a, T> Iterator for ColorPositions<'a, T> {
    type Item = (usize, usize);
    fn next(&mut self) -> Option<Self::Item> {
        let index = self.next_index?;
        self.next_index = self.layer.pixel_info_table[index].next_index;
        Some(index_to_position(index, self.layer.row_width))
    }
}
