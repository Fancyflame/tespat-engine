use std::{
    cell::RefCell,
    ops::{Deref, DerefMut},
};

use crate::{
    CaptureColor, GraphColor, Pattern, ReplaceColor,
    app::{history::HistoryData, matches::PickOrder},
    layer::{Layer, pattern_match::Match},
    pattern::transform::SymmetryList,
};

pub mod history;
pub mod matches;

use matches::Matches;

type PatternPair<'a, C, R> = (&'a Pattern<C>, &'a Pattern<R>);

#[derive(Clone)]
pub struct Tespat<T> {
    layer: Layer<T>,
    history: Option<Vec<Vec<T>>>,

    /// 用于重叠判定而预分配的bitset。字段内容本身没有意义。
    overlapping_bitset: RefCell<Vec<bool>>,
}

impl<T: GraphColor> Tespat<T> {
    pub fn new(options: TespatBuilder<T>) -> Self {
        let TespatBuilder {
            graph,
            width,
            enable_history,
        } = options;

        let mut this = Self {
            layer: Layer::new(),
            history: enable_history.then(Vec::new),
            overlapping_bitset: Default::default(),
        };

        this.layer.initialize(width, graph);

        if let Some(history) = this.history.as_mut() {
            history.push(history::capture_frame(&this.layer));
        }

        this
    }

    pub fn capture<P>(
        &self,
        pattern: &Pattern<P>,
        transforms: SymmetryList,
        pick_order: PickOrder,
    ) -> Matches
    where
        P: CaptureColor<T> + 'static,
    {
        Matches {
            data: transforms
                .as_array()
                .into_iter()
                .flat_map(|sym| {
                    self.layer
                        .match_pattern(pattern.transform(sym))
                        .positions
                        .into_iter()
                })
                .collect::<Vec<Match>>(),
            pick_order,
        }
    }

    pub fn replace<P>(&mut self, positions: &Matches, replace_to: &Pattern<P>)
    where
        P: ReplaceColor<T> + 'static,
    {
        if positions.data.is_empty() {
            return;
        }

        debug_assert!(positions.pick_order.is_as_is());
        let mut _cloned_positions: Option<Matches> = None;
        let pos = if !positions.pick_order.is_as_is() {
            &_cloned_positions.insert(positions.clone()).pick_all()
        } else {
            positions
        };

        for Match {
            pos_x,
            pos_y,
            symmetry,
        } in pos.data.iter().copied()
        {
            self.layer
                .pattern_replace((pos_x, pos_y), replace_to.transform(symmetry));
        }

        self.push_history_frame();
    }

    #[inline]
    pub fn execute<C, R>(
        &mut self,
        capture_and_replace: impl AsPatternPair<C, R>,
        filter: MatchFilter,
        transforms: SymmetryList,
    ) -> bool
    where
        C: CaptureColor<T> + 'static,
        R: ReplaceColor<T> + 'static,
    {
        self.execute_with_order(
            capture_and_replace,
            filter,
            transforms,
            PickOrder::Randomized,
        )
    }

    pub fn execute_with_order<C, R>(
        &mut self,
        capture_and_replace: impl AsPatternPair<C, R>,
        filter: MatchFilter,
        transforms: SymmetryList,
        order: PickOrder,
    ) -> bool
    where
        C: CaptureColor<T> + 'static,
        R: ReplaceColor<T> + 'static,
    {
        let (capture, replace_to) = capture_and_replace.as_pattern_pair();

        let mut matches = self.capture(capture, transforms, order);
        match filter {
            MatchFilter::One => matches.pick(1),
            MatchFilter::AtMost(count) => matches.pick(count),
            MatchFilter::Percent(pct) => matches.ratio_pick(pct),
            MatchFilter::NonOverlap => matches.pick_non_overlapping(self, capture, replace_to),
            MatchFilter::All => matches.pick_all(),
        };

        if matches.is_empty() {
            false
        } else {
            self.replace(&matches, replace_to);
            true
        }
    }

    pub fn set_color_by_position(&mut self, x: usize, y: usize, color: T) {
        let index = x + y * self.width();
        self.layer.set_color(index, color);
    }

    /// 返回历史记录。如果未启用历史记录则仅返回最后一帧
    pub fn export_history(&self) -> HistoryData<T> {
        HistoryData {
            width: self.width(),
            frames: match &self.history {
                Some(h) => h.clone(),
                None => vec![self.export().clone()],
            },
        }
    }

    pub fn push_history_frame(&mut self) {
        if let Some(history) = self.history.as_mut() {
            history.push(history::capture_frame(&self.layer));
        }
    }
}

impl<T> Tespat<T> {
    /// 将当前的color迁移至新的color
    pub fn migrate<U, F>(&self, mut map: F) -> Result<TespatBuilder<U>, TespatMigrateError<&T>>
    where
        U: GraphColor,
        F: FnMut(&T) -> Option<U>,
    {
        let vec: Vec<U> = self
            .layer
            .export()
            .iter()
            .map(|old| map(old).ok_or_else(|| TespatMigrateError { value: old }))
            .collect::<Result<_, _>>()?;

        Ok(self.export_config().set_graph_and_width(self.width(), vec))
    }

    pub fn export_config(&self) -> TespatBuilder<()> {
        TespatBuilder::new_filled((), self.width(), self.height())
            .enable_history(self.is_history_enabled())
    }

    pub fn is_history_enabled(&self) -> bool {
        self.history.is_some()
    }

    pub fn into_builder(mut self) -> TespatBuilder<T> {
        self.export_config().set_graph(self.layer.take_data())
    }
}

impl<T> Deref for Tespat<T> {
    type Target = Layer<T>;
    fn deref(&self) -> &Self::Target {
        &self.layer
    }
}

impl<T> DerefMut for Tespat<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.layer
    }
}

pub struct TespatBuilder<T> {
    pub graph: Vec<T>,
    pub width: usize,
    pub enable_history: bool,
}

impl TespatBuilder<()> {
    pub const fn new() -> Self {
        Self {
            graph: Vec::new(),
            width: 0,
            enable_history: false,
        }
    }
}

impl<T> TespatBuilder<T> {
    pub fn new_filled(color: T, width: usize, height: usize) -> TespatBuilder<T>
    where
        T: Clone,
    {
        TespatBuilder {
            graph: std::iter::repeat_n(color, width * height).collect(),
            width,
            enable_history: false,
        }
    }

    pub fn set_graph_and_width<U>(&self, width: usize, graph: Vec<U>) -> TespatBuilder<U> {
        self.set_graph(graph).set_width(width)
    }

    pub fn set_graph<U>(&self, graph: Vec<U>) -> TespatBuilder<U> {
        TespatBuilder {
            graph,
            width: self.width,
            enable_history: self.enable_history,
        }
    }

    pub fn set_width(mut self, width: usize) -> Self {
        self.width = width;
        self
    }

    pub fn enable_history(mut self, enable: bool) -> Self {
        self.enable_history = enable;
        self
    }

    pub fn copy_config(&self) -> TespatBuilder<()> {
        TespatBuilder {
            graph: vec![(); self.graph.len()],
            width: self.width,
            enable_history: self.enable_history,
        }
    }

    pub fn build(self) -> Tespat<T>
    where
        T: GraphColor,
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

pub trait AsPatternPair<C, R> {
    fn as_pattern_pair(&self) -> PatternPair<'_, C, R>;
}

impl<C, R> AsPatternPair<C, R> for PatternPair<'_, C, R> {
    fn as_pattern_pair(&self) -> PatternPair<'_, C, R> {
        *self
    }
}

impl<C, R> AsPatternPair<C, R> for (Pattern<C>, Pattern<R>) {
    fn as_pattern_pair(&self) -> PatternPair<'_, C, R> {
        (&self.0, &self.1)
    }
}

impl<C, R, P> AsPatternPair<C, R> for &P
where
    P: AsPatternPair<C, R>,
{
    fn as_pattern_pair(&self) -> PatternPair<'_, C, R> {
        (**self).as_pattern_pair()
    }
}

#[derive(Debug, thiserror::Error, Clone, Copy)]
#[error("cannot migrate Tespat because of unexpected source `{value:?}`")]
pub struct TespatMigrateError<T> {
    pub value: T,
}
