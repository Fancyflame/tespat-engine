use std::collections::HashMap;

use serde_json::json;

use crate::{GraphColor, layer::Layer};

pub(super) fn capture_frame<T: GraphColor>(layer: &Layer<T>) -> Vec<T> {
    layer.export().cloned().collect()
}

pub struct HistoryData<T> {
    pub width: usize,
    pub frames: Vec<Vec<T>>,
}

#[cfg(feature = "web-editor")]
impl<T> HistoryData<T>
where
    T: GraphColor + AsRef<crate::web_editor::EditorPalette>,
{
    pub fn to_editor_playback_file(&self) -> String {
        let mut palettes = Vec::new();
        let mut palette_map: HashMap<T, usize> = HashMap::new();

        let frames: Vec<Vec<usize>> = self
            .frames
            .iter()
            .map(|orig_frame| {
                orig_frame
                    .iter()
                    .map(|color| {
                        let &mut id = palette_map.entry(color.clone()).or_insert_with(|| {
                            let id = palettes.len();
                            palettes.push(color.as_ref());
                            id
                        });
                        id
                    })
                    .collect()
            })
            .collect();

        json!({
            "width": self.width,
            "frames": frames,
            "palettes": palettes,
        })
        .to_string()
    }
}
