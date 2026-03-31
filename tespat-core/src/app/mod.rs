use std::{array, cell::RefCell};

use crate::{
    CaptureColor, GraphColor, Pattern, ReplaceColor,
    app::history::HistoryData,
    layer::{ExportLayerIter, Layer, pattern_match::Match},
    pattern::transform::SymmetryList,
};

mod history;
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

    pub fn capture<P>(&self, pattern: &Pattern<P>, transforms: SymmetryList) -> Matches
    where
        P: CaptureColor<T> + 'static,
    {
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

    pub fn replace<P>(&mut self, positions: &Matches, replace_to: &Pattern<P>)
    where
        P: ReplaceColor<T> + 'static,
    {
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
        let (capture, replace_to) = capture_and_replace.as_pattern_pair();

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

    pub fn export(&self) -> ExportLayerIter<'_, T> {
        self.layer.export()
    }

    /// 用邻近算法将当前画面细化为新的 Tespat
    pub fn refine(&self, n: usize) -> Tespat<T> {
        let refined_layer = self.layer.refine(n);
        let history = self
            .is_history_enabled()
            .then(|| vec![history::capture_frame(&refined_layer)]);

        Tespat {
            layer: refined_layer,
            history,
            overlapping_bitset: Default::default(),
        }
    }

    /// 返回历史记录。如果未启用历史记录则仅返回最后一帧
    pub fn export_history(&self) -> HistoryData<T> {
        HistoryData {
            width: self.width(),
            frames: match &self.history {
                Some(h) => h.clone(),
                None => vec![self.export().cloned().collect()],
            },
        }
    }

    /// 导出到二维数组。如果形状不匹配则返回None
    pub fn export_to_2d_array<const W: usize, const H: usize>(&self) -> Option<[[T; W]; H]> {
        let mut export = self.export();

        let len = self.width() * self.height();
        if len != W * H {
            return None;
        }

        Some(array::from_fn(|_| {
            array::from_fn(|_| export.next().cloned().unwrap())
        }))
    }
}

impl<T> Tespat<T> {
    /// 将当前的color迁移至新的color
    pub fn migrate<U>(&self) -> Result<TespatBuilder<Vec<U>>, U::Error>
    where
        T: Clone,
        U: TryFrom<T>,
    {
        let mut vec = Vec::with_capacity(self.layer.len());
        for old in self.layer.export() {
            vec.push(U::try_from(old.clone())?);
        }

        Ok(self.export_config().graph(self.width(), vec))
    }

    pub fn export_config(&self) -> TespatBuilder<()> {
        TespatBuilder::new().enable_history(self.is_history_enabled())
    }

    pub fn is_history_enabled(&self) -> bool {
        self.history.is_some()
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
    pub const fn new() -> Self {
        Self {
            graph: (),
            width: 0,
            enable_history: false,
        }
    }

    pub fn new_filled<T: GraphColor>(
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
    pub fn graph<I2>(self, width: usize, graph: I2) -> TespatBuilder<I2> {
        TespatBuilder {
            graph,
            width,
            enable_history: self.enable_history,
        }
    }

    pub fn enable_history(mut self, enable: bool) -> Self {
        self.enable_history = enable;
        self
    }

    pub fn build<T>(self) -> Tespat<T>
    where
        T: GraphColor,
        I: IntoIterator<Item = T>,
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
