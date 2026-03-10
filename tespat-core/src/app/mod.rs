use std::{array, cell::RefCell};

use crate::{
    Pattern, PatternColor,
    app::history::HistoryData,
    layer::{Layer, pattern_match::Match},
    pattern::transform::SymmetryList,
};

mod history;
pub mod matches;

use matches::Matches;

#[derive(Clone)]
pub struct Tespat<T> {
    layer: Layer<T>,
    history: Option<Vec<Vec<T>>>,

    /// 用于重叠判定而预分配的bitset。字段内容本身没有意义。
    overlapping_bitset: RefCell<Vec<bool>>,
}

impl<T: PatternColor> Tespat<T> {
    pub fn new<I>(options: TespatBuilder<I>) -> Self
    where
        I: IntoIterator<Item = T>,
    {
        let mut this = Self {
            layer: Layer::new(),
            history: options.enable_history.then(Vec::new),
            overlapping_bitset: Default::default(),
        };

        this.layer
            .initialize(options.width, options.graph.into_iter());

        if let Some(history) = this.history.as_mut() {
            history.push(history::capture_frame(&this.layer));
        }

        this
    }

    pub fn capture(&self, pattern: &Pattern<T>, transforms: SymmetryList) -> Matches {
        Matches(
            transforms
                .as_array()
                .into_iter()
                .flat_map(|sym| {
                    self.layer
                        .match_pattern(pattern.transform(sym))
                        .positions
                        .into_iter()
                })
                .collect::<Vec<Match>>(),
        )
    }

    pub fn replace(&mut self, positions: &Matches, replace_to: &Pattern<T>) {
        if positions.0.is_empty() {
            return;
        }

        for Match {
            pos_x,
            pos_y,
            symmetry,
        } in positions.0.iter().copied()
        {
            self.layer
                .pattern_replace((pos_x, pos_y), replace_to.transform(symmetry));
        }

        if let Some(history) = self.history.as_mut() {
            history.push(history::capture_frame(&self.layer));
        }
    }

    pub fn execute(
        &mut self,
        capture: &Pattern<T>,
        replace_to: &Pattern<T>,
        filter: MatchFilter,
        transforms: SymmetryList,
    ) -> bool {
        let mut matches = self.capture(capture, transforms);
        match filter {
            MatchFilter::One => matches.pick(1),
            MatchFilter::AtMost(count) => matches.pick(count),
            MatchFilter::Percent(pct) => matches.ratio_pick(pct),
            MatchFilter::NonOverlap => matches.pick_non_overlapping(self, capture, replace_to),
            MatchFilter::All => matches.all(),
        };

        if matches.is_empty() {
            false
        } else {
            self.replace(&matches, replace_to);
            true
        }
    }

    pub fn color_count(&self, color: &T) -> usize {
        self.layer.color_count(color)
    }

    pub fn export(&self) -> Vec<T> {
        self.layer.export().cloned().collect()
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

    /// 将当前的color迁移至新的color
    pub fn migrate<U>(&self) -> TespatBuilder<impl Iterator<Item = U>>
    where
        U: From<T>,
    {
        TespatBuilder {
            graph: self.layer.export().map(|color| U::from(color.clone())),
            width: self.width(),
            enable_history: self.is_history_enabled(),
        }
    }

    pub fn width(&self) -> usize {
        self.layer.width()
    }

    pub fn height(&self) -> usize {
        self.layer.height()
    }
}

pub struct TespatBuilder<I> {
    pub graph: I,
    pub width: usize,
    pub enable_history: bool,
}

impl TespatBuilder<()> {
    pub fn new_filled<T: PatternColor>(
        color: T,
        width: usize,
        height: usize,
    ) -> TespatBuilder<impl Iterator<Item = T>> {
        TespatBuilder {
            graph: std::iter::repeat_n(color, width * height),
            width,
            enable_history: false,
        }
    }
}

impl<I> TespatBuilder<I> {
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

    pub fn build<T>(self) -> Tespat<T>
    where
        T: PatternColor,
        I: Iterator<Item = T>,
    {
        Tespat::new(self)
    }
}

#[derive(Clone, Copy, Debug)]
pub enum MatchFilter {
    One,
    AtMost(usize),
    Percent(f32),
    NonOverlap,
    All,
}
