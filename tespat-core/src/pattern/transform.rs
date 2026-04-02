use smallvec::SmallVec;

use crate::{Pattern, index_to_position, pattern::MatchColor};

#[derive(Clone, Copy, Debug)]
pub struct SymmetryList {
    pub id: bool,
    pub rot_90: bool,
    pub rot_180: bool,
    pub rot_270: bool,
    pub flip_h: bool,
    pub flip_v: bool,
    pub flip_d1: bool,
    pub flip_d2: bool,
}

impl SymmetryList {
    pub const EMPTY: Self = Self {
        id: false,
        rot_90: false,
        rot_180: false,
        rot_270: false,
        flip_h: false,
        flip_v: false,
        flip_d1: false,
        flip_d2: false,
    };

    pub const ID: Self = Self {
        id: true,
        ..Self::EMPTY
    };

    pub const ROTATE_ONLY: Self = Self {
        id: true,
        rot_90: true,
        rot_180: true,
        rot_270: true,
        ..Self::EMPTY
    };

    pub const FLIP_ONLY: Self = Self {
        id: true,
        rot_180: true,
        flip_h: true,
        flip_v: true,
        ..Self::EMPTY
    };

    pub const ALL: Self = Self {
        id: true,
        rot_90: true,
        rot_180: true,
        rot_270: true,
        flip_h: true,
        flip_v: true,
        flip_d1: true,
        flip_d2: true,
    };

    pub fn as_array(&self) -> SmallVec<[Symmetry; 8]> {
        [
            (self.id, Symmetry::Id),
            (self.rot_90, Symmetry::CCW90),
            (self.rot_180, Symmetry::Rot180),
            (self.rot_270, Symmetry::CW90),
            (self.flip_h, Symmetry::FlipH),
            (self.flip_v, Symmetry::FlipV),
            (self.flip_d1, Symmetry::FlipD1),
            (self.flip_d2, Symmetry::FlipD2),
        ]
        .into_iter()
        .filter_map(|(b, s)| b.then_some(s))
        .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Symmetry {
    Id,     // 0
    CCW90,  // 1
    Rot180, // 2
    CW90,   // 3
    FlipH,  // 4
    FlipV,  // 5
    FlipD1, // 6 (Main Diagonal \)
    FlipD2, // 7 (Anti-Diagonal /)
}

impl Symmetry {
    pub const NONE: [Self; 1] = [Self::Id];

    pub const ROTATE_ONLY: [Self; 4] = [Self::Id, Self::CCW90, Self::Rot180, Self::CW90];

    pub const FLIP_ONLY: [Self; 3] = [Self::Id, Self::FlipH, Self::FlipV];

    pub const ROTATE_AND_FLIP: [Self; 8] = [
        Self::Id,
        Self::CCW90,
        Self::Rot180,
        Self::CW90,
        Self::FlipH,
        Self::FlipV,
        Self::FlipD1,
        Self::FlipD2,
    ];

    /// 将原始坐标 (x, y) 映射到变换后的坐标
    /// 以 x 向右、y 向下的屏幕坐标系为准；w, h 为变换前（原始）的宽度和高度
    pub const fn map(&self, x: usize, y: usize, w: usize, h: usize) -> (usize, usize) {
        match self {
            Symmetry::Id => (x, y),
            Symmetry::CCW90 => (y, w - 1 - x),
            Symmetry::Rot180 => (w - 1 - x, h - 1 - y),
            Symmetry::CW90 => (h - 1 - y, x),
            Symmetry::FlipH => (w - 1 - x, y),
            Symmetry::FlipV => (x, h - 1 - y),
            Symmetry::FlipD1 => (y, x),
            Symmetry::FlipD2 => (h - 1 - y, w - 1 - x),
        }
    }

    /// 返回当前对称操作的逆操作 (Inverse)
    /// 如果你用操作 S 变换了坐标，再用 S.inverse() 变换回来，就能得到原始坐标。
    pub const fn inverse(&self) -> Self {
        match self {
            // 逆时针旋转 90 的逆操作是顺时针旋转 90
            Symmetry::CCW90 => Symmetry::CW90,

            // 顺时针旋转 90 的逆操作是逆时针旋转 90
            Symmetry::CW90 => Symmetry::CCW90,

            // 其余所有操作的逆操作都是它们本身 (Self-inverse)
            _ => *self,
        }
    }

    /// 输入原始网格的宽(w)和高(h)
    ///
    /// 返回变换后的网格的宽和高 (new_w, new_h)。将新的宽高再次变换得到原来的宽高
    pub const fn map_size(&self, w: usize, h: usize) -> (usize, usize) {
        match self {
            Symmetry::Id | Symmetry::Rot180 | Symmetry::FlipH | Symmetry::FlipV => (w, h),
            Symmetry::CCW90 | Symmetry::CW90 | Symmetry::FlipD1 | Symmetry::FlipD2 => (h, w),
        }
    }

    pub fn iter_on<'a, T>(&self, pattern: &'a Pattern<T>) -> SymmetryPatternIter<'a, T> {
        SymmetryPatternIter {
            pattern,
            symmetry: *self,
            position: (0, 0),
        }
    }
}

pub struct TransformedPattern<'a, T: 'static> {
    pub symmetry: Symmetry,
    pub pattern: &'a Pattern<T>,
}

impl<'a, T> TransformedPattern<'a, T> {
    pub fn size(&self) -> (usize, usize) {
        self.symmetry
            .map_size(self.pattern.width, self.pattern.height)
    }

    pub fn width(&self) -> usize {
        self.size().0
    }

    pub fn height(&self) -> usize {
        self.size().1
    }

    pub fn iter(&self) -> SymmetryPatternIter<'a, T> {
        self.symmetry.iter_on(self.pattern)
    }

    pub fn color_kinds(&self) -> impl Iterator<Item = (&'a MatchColor<T>, (usize, usize))> + '_ {
        self.pattern.color_kinds().iter().map(|(color, index)| {
            let (x, y) = index_to_position(*index, self.pattern.width);
            let pos = self
                .symmetry
                .map(x, y, self.pattern.width, self.pattern.height);
            (color, pos)
        })
    }
}

impl<T> Copy for TransformedPattern<'_, T> {}
impl<T> Clone for TransformedPattern<'_, T> {
    fn clone(&self) -> Self {
        Self {
            symmetry: self.symmetry,
            pattern: self.pattern,
        }
    }
}

pub struct SymmetryPatternIter<'a, T: 'static> {
    pattern: &'a Pattern<T>,
    symmetry: Symmetry,
    position: (usize, usize),
}

impl<'a, T> Iterator for SymmetryPatternIter<'a, T> {
    type Item = ((usize, usize), &'a MatchColor<T>);

    fn next(&mut self) -> Option<Self::Item> {
        let (x, y) = &mut self.position;
        let (width, height) = self
            .symmetry
            .map_size(self.pattern.width, self.pattern.height);

        if *y == height {
            return None;
        }

        let (x_orig, y_orig) = self.symmetry.inverse().map(*x, *y, width, height);
        let index = x_orig + y_orig * self.pattern.width;

        let result = Some(((*x, *y), &self.pattern.grid[index]));

        *x += 1;
        if *x == width {
            *y += 1;
            *x = 0;
        }

        result
    }
}
