use std::{collections::HashMap, ops::Deref};

use crate::{
    GraphColor,
    app::TespatBuilder,
    index_to_position,
    pattern::transform::{Symmetry, TransformedPattern},
};

type PatColor<T> = Option<T>;

pub mod transform;

#[derive(Clone)]
pub struct Pattern<T: 'static> {
    width: usize,
    height: usize,
    grid: ReadSlice<PatColor<T>>,

    /// 颜色表
    /// (表中所有包含的颜色, 该颜色在表中的一个位置)
    colors: ReadSlice<(PatColor<T>, usize)>,
}

impl<T: GraphColor> Pattern<T> {
    pub fn new(width: usize, grid: Vec<PatColor<T>>) -> Self {
        Self {
            width,
            height: compute_height(width, grid.len()),
            colors: ReadSlice::Own(
                HashMap::<PatColor<T>, usize>::from_iter(
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

    pub const fn from_static(
        width: usize,
        grid: &'static [PatColor<T>],
        colors: &'static [(PatColor<T>, usize)],
    ) -> Self {
        Self {
            width,
            height: compute_height(width, grid.len()),
            grid: ReadSlice::Ref(grid),
            colors: ReadSlice::Ref(colors),
        }
    }

    pub fn literal<const W: usize, const H: usize>(grid: [[PatColor<T>; W]; H]) -> Self {
        Self::new(
            W,
            grid.into_iter().flat_map(|arr| arr.into_iter()).collect(),
        )
    }

    /// 将自身视为初始图创建一个 Tespat
    pub fn create_tespat(&self) -> Option<TespatBuilder<impl ExactSizeIterator<Item = T> + '_>> {
        if self.colors.iter().any(|(color, _)| color.is_none()) {
            return None;
        }

        Some(TespatBuilder::new(
            self.grid
                .iter()
                .map(|color| color.clone().unwrap_or_else(|| unreachable!())),
            self.width,
        ))
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
        self.grid.as_ref()
    }

    pub fn iter(&self) -> impl Iterator<Item = ((usize, usize), &PatColor<T>)> {
        self.grid()
            .iter()
            .enumerate()
            .map(|(i, color)| (index_to_position(i, self.width), color))
    }

    pub fn color_kinds(&self) -> &[(PatColor<T>, usize)] {
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

#[derive(Clone, Debug)]
enum ReadSlice<T: 'static> {
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
