use std::{array, cell::RefCell};

use crate::{
    Color,
    app::{history::History, matches::Matches},
    layer::Layer,
    pattern::Pattern,
};

mod history;
pub mod matches;

pub struct Tespat<T> {
    layer: Layer<T>,
    history: Option<Vec<History<T>>>,

    /// 用于重叠判定而预分配的bitset。字段内容本身没有意义。
    overlapping_bitset: RefCell<Vec<bool>>,
}

pub struct CreateTespat<I> {
    pub picture: I,
    pub width: usize,
    pub enable_history: bool,
}

impl<T: Color> Tespat<T> {
    pub fn new<I>(options: CreateTespat<I>) -> Self
    where
        I: ExactSizeIterator<Item = T>,
    {
        let mut this = Self {
            layer: Layer::new(),
            history: options.enable_history.then(Vec::new),
            overlapping_bitset: Default::default(),
        };

        this.layer.initialize(options.width, options.picture);
        this
    }

    pub fn capture(&self, pattern: &Pattern<T>) -> Matches {
        Matches(self.layer.match_pattern(pattern).positions)
    }

    pub fn replace(&mut self, positions: &Matches, replace_to: &Pattern<T>) {
        for p in positions.0.iter() {
            self.layer.pattern_replace(*p, replace_to);
        }
    }

    pub fn export(&self) -> Vec<T> {
        self.layer.export()
    }

    /// 导出到二维数组。如果形状不匹配则返回None
    pub fn export_to_2d_array<const W: usize, const H: usize>(&self) -> Option<[[T; W]; H]> {
        let export = self.export();
        if export.len() != W * H {
            return None;
        }
        let mut colors = export.into_iter();

        Some(array::from_fn(|_| {
            array::from_fn(|_| colors.next().unwrap())
        }))
    }

    pub fn width(&self) -> usize {
        self.layer.width()
    }

    pub fn height(&self) -> usize {
        self.layer.height()
    }
}
