use serde_json::json;

use crate::{GraphColor, StrColor, layer::Layer};

pub(super) fn capture_frame<T: GraphColor>(layer: &Layer<T>) -> Vec<T> {
    layer.export().cloned().collect()
}

pub struct HistoryData<T> {
    pub width: usize,
    pub frames: Vec<Vec<T>>,
}

impl<T> HistoryData<T>
where
    T: StrColor,
{
    pub fn to_json(&self) -> String {
        let frames = self
            .frames
            .iter()
            .map(|frame| frame.iter().map(|color| color.to_str()).collect::<Vec<_>>())
            .collect::<Vec<_>>();

        json!({
            "width": self.width,
            "frames": frames,
        })
        .to_string()
    }
}
