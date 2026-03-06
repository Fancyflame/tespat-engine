use std::{array, cell::RefCell};

use crate::{PatternColor, app::history::HistoryData, layer::Layer, pattern::Pattern};

mod history;
pub mod matches;

use matches::Matches;

pub struct Tespat<T> {
    layer: Layer<T>,
    history: Option<Vec<Vec<T>>>,

    /// 用于重叠判定而预分配的bitset。字段内容本身没有意义。
    overlapping_bitset: RefCell<Vec<bool>>,
}

impl<T: PatternColor> Tespat<T> {
    pub fn new<I>(options: CreateTespat<I>) -> Self
    where
        I: ExactSizeIterator<Item = T>,
    {
        let mut this = Self {
            layer: Layer::new(),
            history: options.enable_history.then(Vec::new),
            overlapping_bitset: Default::default(),
        };

        this.layer.initialize(options.width, options.graph);

        if let Some(history) = this.history.as_mut() {
            history.push(history::capture_frame(&this.layer));
        }

        this
    }

    pub fn capture(&self, pattern: &Pattern<T>) -> Matches {
        Matches(self.layer.match_pattern(pattern).positions)
    }

    pub fn replace(&mut self, positions: &Matches, replace_to: &Pattern<T>) {
        if positions.0.is_empty() {
            return;
        }

        for p in positions.0.iter().copied() {
            self.layer.pattern_replace(p, replace_to);
        }

        if let Some(history) = self.history.as_mut() {
            history.push(history::capture_frame(&self.layer));
        }
    }

    pub fn export(&self) -> Vec<T> {
        self.layer.export()
    }

    pub fn is_history_enabled(&self) -> bool {
        self.history.is_some()
    }

    /// 返回历史记录。如果未启用历史记录则仅返回最后一帧
    pub fn export_history(&self) -> HistoryData<T> {
        HistoryData {
            width: self.width(),
            frames: match &self.history {
                Some(h) => h.clone(),
                None => vec![self.export()],
            },
        }
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

pub struct CreateTespat<I> {
    pub graph: I,
    pub width: usize,
    pub enable_history: bool,
}

impl<I> CreateTespat<I> {
    pub fn new(graph: I, width: usize) -> Self {
        Self {
            graph,
            width,
            enable_history: false,
        }
    }

    pub fn enable_history(mut self, enable: bool) -> Self {
        self.enable_history = enable;
        self
    }

    pub fn create<T>(self) -> Tespat<T>
    where
        T: PatternColor,
        I: ExactSizeIterator<Item = T>,
    {
        Tespat::new(self)
    }
}
