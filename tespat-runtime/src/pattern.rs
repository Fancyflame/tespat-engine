use std::{
    collections::{HashMap, HashSet},
    fmt::Debug,
};

use crate::{PatternColor, app::CreateTespat, index_to_position};

type PatColor<T> = Option<T>;

pub struct Pattern<T> {
    width: usize,
    height: usize,
    grid: Vec<PatColor<T>>,

    /// 颜色表
    /// (表中所有包含的颜色, 该颜色在表中的一个位置)
    colors: Vec<(PatColor<T>, usize)>,
}

impl<T: PatternColor> Pattern<T> {
    pub fn new(width: usize, grid: Vec<PatColor<T>>) -> Self {
        Self {
            width,
            height: compute_height(width, grid.len()),
            colors: HashMap::<PatColor<T>, usize>::from_iter(
                grid.iter()
                    .cloned()
                    .enumerate()
                    .map(|(idx, color)| (color, idx)),
            )
            .into_iter()
            .collect(),
            grid,
        }
    }

    pub fn literal<const W: usize, const H: usize>(grid: [[PatColor<T>; W]; H]) -> Self {
        Self::new(
            W,
            grid.into_iter().flat_map(|arr| arr.into_iter()).collect(),
        )
    }
}

impl<T> Pattern<T> {
    pub fn width(&self) -> usize {
        self.width
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn grid(&self) -> &[PatColor<T>] {
        &self.grid
    }

    pub fn iter(&self) -> impl Iterator<Item = ((usize, usize), &PatColor<T>)> {
        self.grid
            .iter()
            .enumerate()
            .map(|(i, color)| (index_to_position(i, self.width), color))
    }

    pub fn color_kinds(&self) -> &[(PatColor<T>, usize)] {
        &self.colors
    }

    /// 将自身视为初始图创建一个 Tespat
    pub fn create_tespat(self) -> Option<CreateTespat<impl ExactSizeIterator<Item = T>>> {
        if self.colors.iter().any(|(color, _)| color.is_none()) {
            return None;
        }

        Some(CreateTespat::new(
            self.grid
                .into_iter()
                .map(|color| color.unwrap_or_else(|| unreachable!())),
            self.width,
        ))
    }
}

const fn compute_height(width: usize, len: usize) -> usize {
    let height = if width == 0 { 0 } else { len / width };

    if width * height != len {
        panic!("Length of grid data must be an integer multiple of width");
    }

    height
}
