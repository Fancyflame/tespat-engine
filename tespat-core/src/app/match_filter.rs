use crate::{
    GraphColor, Pattern,
    app::{Tespat, matches::Matches},
};

pub trait MatchFilter {
    fn filter(&self, matches: &mut Matches, ctx: &dyn PickNonOverlapContext);
}

impl<F> MatchFilter for F
where
    F: Fn(&mut Matches, &dyn PickNonOverlapContext),
{
    fn filter(&self, matches: &mut Matches, ctx: &dyn PickNonOverlapContext) {
        self(matches, ctx)
    }
}

pub fn one(matches: &mut Matches, _: &dyn PickNonOverlapContext) {
    matches.pick(1);
}

pub const fn at_most(count: usize) -> impl MatchFilter {
    move |matches: &mut Matches, _: &dyn PickNonOverlapContext| {
        matches.pick(count);
    }
}

pub const fn percent(pct: f32) -> impl MatchFilter {
    move |matches: &mut Matches, _: &dyn PickNonOverlapContext| {
        matches.ratio_pick(pct);
    }
}

pub fn non_overlap(matches: &mut Matches, ctx: &dyn PickNonOverlapContext) {
    ctx.pick_non_overlapping(matches);
}

pub fn all(matches: &mut Matches, _: &dyn PickNonOverlapContext) {
    matches.pick_all();
}

pub(super) struct PickNonOverlappingContextInner<'a, T, M, R>
where
    M: 'static,
    R: 'static,
{
    pub tespat: &'a Tespat<T>,
    pub match_pattern: &'a Pattern<M>,
    pub replace_pattern: &'a Pattern<R>,
}

pub trait PickNonOverlapContext {
    fn pick_non_overlapping<'a>(&self, matches: &'a mut Matches) -> &'a mut Matches;
}

impl<T, M, R> PickNonOverlapContext for PickNonOverlappingContextInner<'_, T, M, R>
where
    T: GraphColor,
{
    fn pick_non_overlapping<'a>(&self, matches: &'a mut Matches) -> &'a mut Matches {
        matches.pick_non_overlapping(self.tespat, self.match_pattern, self.replace_pattern);
        matches
    }
}
