use crate::{CaptureColor, CaptureVec, GraphColor, ReplaceColor, pattern::transform::Symmetry};

impl<T, C> CaptureColor<C> for T
where
    T: StaticColor<C>,
    C: GraphColor,
{
    fn as_index(&self, symmetry: Symmetry, vec: &mut CaptureVec<C>) {
        extract_color_mode(self, symmetry, |mode| match mode {
            ColorMode::Exact(c) => vec.push(c.clone()),
            ColorMode::Include(i) => vec.extend(i),
            ColorMode::Any | ColorMode::Exclude(_) => {}
        });
    }

    fn matches(&self, graph_color: &C, symmetry: Symmetry) -> bool {
        extract_color_mode(self, symmetry, |mode| match mode {
            ColorMode::Exact(c) => *graph_color == c,
            ColorMode::Include(mut i) => (&mut i).any(|c| *graph_color == c),
            ColorMode::Exclude(mut e) => !(&mut e).any(|c| *graph_color == c),
            ColorMode::Any => true,
        })
    }
}

impl<T, C> ReplaceColor<C> for T
where
    T: StaticColor<C>,
    C: GraphColor,
{
    fn replace(&self, place_graph_color: &C, symmetry: Symmetry) -> C {
        extract_color_mode(self, symmetry, |mode| match mode {
            ColorMode::Exact(c) => c,
            _ => place_graph_color.clone(),
        })
    }
}

/// 固定颜色，可同时用于捕获（包括索引）和替换
pub trait StaticColor<T: GraphColor> {
    fn get_color_with_symmetry(&self, symmetry: Symmetry, control: ColorControl<T>);
}

#[must_use]
pub struct ColorControl<'a, T> {
    func: &'a mut dyn FnMut(ColorMode<'_, T>),
}

impl<'a, T> ColorControl<'a, T> {
    pub fn set(self, mode: ColorMode<T>) {
        (self.func)(mode);
    }
}

pub enum ColorMode<'a, T> {
    Exact(T),
    Include(&'a mut dyn Iterator<Item = T>),
    Exclude(&'a mut dyn Iterator<Item = T>),
    Any,
}

fn extract_color_mode<T, Sc, F, R>(static_color: &Sc, symmetry: Symmetry, f: F) -> R
where
    T: GraphColor,
    Sc: StaticColor<T>,
    F: FnOnce(ColorMode<'_, T>) -> R,
{
    let mut f_once = Some(f);
    let mut result = None;
    let mut f_mut = |mode: ColorMode<'_, T>| {
        result = Some(f_once.take().unwrap()(mode));
    };

    static_color.get_color_with_symmetry(symmetry, ColorControl { func: &mut f_mut });

    if let Some(f) = f_once {
        f(ColorMode::Any)
    } else {
        result.unwrap()
    }
}
