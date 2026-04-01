use std::borrow::Cow;

use serde::Serialize;

pub trait GetEditorPalette {
    fn get_editor_palette(&self) -> EditorPalette;
}

#[derive(Clone, Serialize)]
pub struct EditorPalette {
    pub color: Cow<'static, str>,
    pub icon: Option<Cow<'static, str>>,
}

impl EditorPalette {
    pub const fn new_static(color: &'static str, icon: Option<&'static str>) -> Self {
        Self {
            color: Cow::Borrowed(color),
            icon: match icon {
                Some(icon) => Some(Cow::Borrowed(icon)),
                None => None,
            },
        }
    }
}
