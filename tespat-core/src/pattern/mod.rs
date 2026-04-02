use std::{collections::HashMap, hash::Hash, ops::Deref};

use crate::{
    CaptureColor, GraphColor, StaticColor,
    app::TespatBuilder,
    index_to_position,
    pattern::transform::{Symmetry, TransformedPattern},
};

/// 捕获侧使用的颜色规则。只有 `Exact` 在替换路径中会真正落盘。
#[derive(Clone, Hash, PartialEq, Eq)]
pub enum MatchColor<T: 'static> {
    /// 精确匹配一个具体颜色。
    Exact(T),
    /// 匹配列表中的任意一个颜色。
    AnyOf(ReadSlice<T>),
    /// 匹配所有“不在列表中”的颜色。
    NotIn(ReadSlice<T>),
    /// 不对该格施加任何捕获约束。
    Ignore,
}

impl<T: 'static> MatchColor<T> {
    pub fn any_of(colors: Vec<T>) -> Self {
        Self::AnyOf(ReadSlice::Own(colors))
    }

    pub const fn any_of_ref(colors: &'static [T]) -> Self {
        Self::AnyOf(ReadSlice::Ref(colors))
    }

    pub fn not_in(colors: Vec<T>) -> Self {
        Self::NotIn(ReadSlice::Own(colors))
    }

    pub const fn not_in_ref(colors: &'static [T]) -> Self {
        Self::NotIn(ReadSlice::Ref(colors))
    }

    pub const fn is_ignore(&self) -> bool {
        matches!(self, Self::Ignore)
    }

    pub const fn is_exact(&self) -> bool {
        matches!(self, Self::Exact(_))
    }

    /// 提取可直接写入 layer 的颜色；特殊捕获规则在替换侧一律视为跳过。
    pub fn to_exact(&self) -> Option<&T> {
        match self {
            Self::Exact(color) => Some(color),
            Self::AnyOf(_) | Self::NotIn(_) | Self::Ignore => None,
        }
    }

    /// 按捕获语义判断当前 pattern 格是否接受 layer 中的颜色。
    pub fn matches_graph_color<C>(&self, graph_color: &C, symmetry: Symmetry) -> bool
    where
        T: CaptureColor<C>,
        C: GraphColor,
    {
        match self {
            Self::Exact(color) => color.matches(graph_color, symmetry),
            Self::AnyOf(colors) => colors
                .iter()
                .any(|color| color.matches(graph_color, symmetry)),
            Self::NotIn(colors) => colors
                .iter()
                .all(|color| !color.matches(graph_color, symmetry)),
            Self::Ignore => true,
        }
    }

    /// 提取可用于 layer 颜色索引的候选颜色
    ///
    /// 返回值为None时代表该颜色无法用于缩小候选集
    /// 返回值为Some(&[])理想情况不应该出现，代表该颜色确定无法匹配任何东西
    pub fn indexed_colors(&self) -> Option<&[T]> {
        match self {
            Self::Exact(color) => Some(std::slice::from_ref(color)),
            Self::AnyOf(colors) => Some(&**colors),
            Self::NotIn(_) | Self::Ignore => None,
        }
    }
}

pub mod transform;

#[derive(Clone)]
pub struct Pattern<T: 'static> {
    width: usize,
    height: usize,
    grid: ReadSlice<MatchColor<T>>,

    /// 颜色表
    /// (表中所有包含的颜色, 该颜色在表中的一个位置)
    colors: ReadSlice<(MatchColor<T>, usize)>,
}

impl<T> Pattern<T>
where
    T: GraphColor,
{
    pub fn new(width: usize, grid: Vec<MatchColor<T>>) -> Self {
        Self {
            width,
            height: compute_height(width, grid.len()),
            colors: ReadSlice::Own(
                HashMap::<MatchColor<T>, usize>::from_iter(
                    grid.iter()
                        .cloned()
                        .enumerate()
                        .map(|(idx, color)| (color, idx)),
                )
                .into_iter()
                .collect(),
            ),
            grid: ReadSlice::Own(grid),
        }
    }

    pub fn literal<const W: usize, const H: usize>(grid: [[MatchColor<T>; W]; H]) -> Self {
        Self::new(
            W,
            grid.into_iter().flat_map(|arr| arr.into_iter()).collect(),
        )
    }
}

impl<T> Pattern<T> {
    #[doc(hidden)]
    pub const fn from_static(
        width: usize,
        grid: &'static [MatchColor<T>],
        colors: &'static [(MatchColor<T>, usize)],
    ) -> Self {
        Self {
            width,
            height: compute_height(width, grid.len()),
            grid: ReadSlice::Ref(grid),
            colors: ReadSlice::Ref(colors),
        }
    }

    /// 将自身视为初始图创建一个 Tespat。只接受全 `Exact` 的 pattern。
    pub fn create_tespat<C>(&self) -> Option<TespatBuilder<C>>
    where
        T: StaticColor<C>,
        C: GraphColor,
    {
        let mut data: Vec<C> = Vec::with_capacity(self.grid.len());

        for color in self.grid.iter() {
            if let Some(color) = color.to_exact() {
                data.push(color.get_color_with_symmetry(Symmetry::Id))
            } else {
                return None;
            }
        }

        Some(TespatBuilder::new().graph(self.width, data))
    }
}

impl<T> Pattern<T> {
    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn grid(&self) -> &[MatchColor<T>] {
        self.grid.as_ref()
    }

    pub fn iter(&self) -> impl Iterator<Item = ((usize, usize), &MatchColor<T>)> {
        self.grid()
            .iter()
            .enumerate()
            .map(|(i, color)| (index_to_position(i, self.width), color))
    }

    pub fn color_kinds(&self) -> &[(MatchColor<T>, usize)] {
        self.colors.as_ref()
    }

    pub fn transform(&self, symmetry: Symmetry) -> TransformedPattern<'_, T> {
        TransformedPattern {
            symmetry,
            pattern: self,
        }
    }
}

const fn compute_height(width: usize, len: usize) -> usize {
    let height = if width == 0 { 0 } else { len / width };

    if width * height != len {
        panic!("Length of grid data must be an integer multiple of width");
    }

    height
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
pub enum ReadSlice<T: 'static> {
    Own(Vec<T>),
    Ref(&'static [T]),
}

impl<T> Deref for ReadSlice<T> {
    type Target = [T];
    fn deref(&self) -> &Self::Target {
        match self {
            Self::Own(o) => o.as_slice(),
            Self::Ref(r) => r,
        }
    }
}
