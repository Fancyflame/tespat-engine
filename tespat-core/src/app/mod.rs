use std::{array, cell::RefCell};

use crate::{PatternColor, layer::Layer, pattern::Pattern};

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

    pub fn export_history(&self) -> Vec<Vec<T>> {
        self.history.clone().unwrap_or_default()
    }

    pub fn export_history_json(&self) -> serde_json::Result<String> {
        #[derive(serde::Serialize)]
        struct JsonHistory {
            width: usize,
            frames: Vec<Vec<String>>,
        }

        let export = JsonHistory {
            width: self.width(),
            frames: self
                .export_history()
                .into_iter()
                .map(|frame| {
                    frame
                        .into_iter()
                        .map(|color| format!("{color:?}"))
                        .collect::<Vec<_>>()
                })
                .collect(),
        };

        serde_json::to_string(&export)
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

    pub fn enable_history(mut self) -> Self {
        self.enable_history = true;
        self
    }

    pub fn with_history(mut self, enable_history: bool) -> Self {
        self.enable_history = enable_history;
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::{Pattern, PatternColor};

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
    enum Color {
        A,
        B,
        C,
    }

    impl PatternColor for Color {}

    #[test]
    fn records_full_frames_and_exports_json() {
        let initial = Pattern::literal([[Some(Color::A), Some(Color::B)]]);
        let mut tespat = initial.create_tespat().unwrap().enable_history().create();

        let positions = tespat.capture(&Pattern::literal([[Some(Color::A)]]));
        tespat.replace(&positions, &Pattern::literal([[Some(Color::C)]]));

        let history = tespat.export_history();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0], vec![Color::A, Color::B]);
        assert_eq!(history[1], vec![Color::C, Color::B]);

        let history_json = tespat.export_history_json().unwrap();
        let value: serde_json::Value = serde_json::from_str(&history_json).unwrap();
        assert_eq!(
            value,
            json!({
                "width": 2,
                "frames": [
                    ["A", "B"],
                    ["C", "B"],
                ],
            })
        );
    }

    #[test]
    fn disabled_history_exports_empty() {
        let initial = Pattern::literal([[Some(Color::A), Some(Color::B)]]);
        let tespat = initial.create_tespat().unwrap().create::<Color>();

        assert!(!tespat.is_history_enabled());
        assert!(tespat.export_history().is_empty());

        let history_json = tespat.export_history_json().unwrap();
        let value: serde_json::Value = serde_json::from_str(&history_json).unwrap();
        assert_eq!(
            value,
            json!({
                "width": 2,
                "frames": [],
            })
        );
    }
}
