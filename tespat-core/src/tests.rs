use crate::{
    GraphColor, Pattern, StaticColor,
    app::{MatchFilter, TespatBuilder},
    pattern::transform::SymmetryList,
    pattern::{MatchColor, transform::Symmetry},
};

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
enum TestColor {
    A,
    B,
    C,
    D,
    E,
}

impl GraphColor for TestColor {}

impl StaticColor<TestColor> for TestColor {
    fn get_color_with_symmetry(&self, _symmetry: Symmetry) -> TestColor {
        self.clone()
    }
}

fn tespat(width: usize, graph: Vec<TestColor>) -> crate::app::Tespat<TestColor> {
    TespatBuilder::new().graph(width, graph).build()
}

fn pattern(width: usize, grid: Vec<MatchColor<TestColor>>) -> Pattern<TestColor> {
    Pattern::new(width, grid)
}

#[test]
fn ignore_only_pattern_matches_all_legal_positions() {
    let tespat = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let pattern = pattern(2, vec![MatchColor::Ignore, MatchColor::Ignore]);

    let matches = tespat.capture(&pattern, SymmetryList::ID);

    assert_eq!(matches.len(), 2);
}

#[test]
fn not_in_only_pattern_uses_full_scan_semantics() {
    let tespat = tespat(2, vec![TestColor::A, TestColor::B]);
    let pattern = pattern(1, vec![MatchColor::not_in(vec![TestColor::A])]);

    let matches = tespat.capture(&pattern, SymmetryList::ID);

    assert_eq!(matches.len(), 1);
}

#[test]
fn any_of_indexing_deduplicates_candidate_positions() {
    let tespat = tespat(2, vec![TestColor::A, TestColor::B]);
    let pattern = pattern(
        1,
        vec![MatchColor::any_of(vec![
            TestColor::A,
            TestColor::A,
            TestColor::B,
        ])],
    );

    let matches = tespat.capture(&pattern, SymmetryList::ID);

    assert_eq!(matches.len(), 2);
}

#[test]
fn mixed_patcolor_pattern_matches_under_the_correct_symmetry_only() {
    let tespat = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let pattern = pattern(
        2,
        vec![
            MatchColor::Exact(TestColor::A),
            MatchColor::any_of(vec![TestColor::B]),
            MatchColor::not_in(vec![TestColor::A, TestColor::B]),
            MatchColor::Ignore,
        ],
    );

    let matches = tespat.capture(&pattern, SymmetryList::ALL);

    assert_eq!(matches.len(), 1);
}

#[test]
fn replace_only_applies_exact_patcolors() {
    let capture_pattern = pattern(1, vec![MatchColor::Ignore]);

    let mut tespat_any_of = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let matches_any_of = tespat_any_of.capture(&capture_pattern, SymmetryList::ID);
    tespat_any_of.replace(
        &matches_any_of,
        &pattern(1, vec![MatchColor::any_of(vec![TestColor::E])]),
    );
    assert_eq!(
        tespat_any_of.export(),
        &vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D]
    );

    let mut tespat_not_in = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let matches_not_in = tespat_not_in.capture(&capture_pattern, SymmetryList::ID);
    tespat_not_in.replace(
        &matches_not_in,
        &pattern(1, vec![MatchColor::not_in(vec![TestColor::E])]),
    );
    assert_eq!(
        tespat_not_in.export(),
        &vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D]
    );

    let mut tespat_ignore = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let matches_ignore = tespat_ignore.capture(&capture_pattern, SymmetryList::ID);
    tespat_ignore.replace(&matches_ignore, &pattern(1, vec![MatchColor::Ignore]));
    assert_eq!(
        tespat_ignore.export(),
        &vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D]
    );

    let mut tespat_exact = tespat(
        2,
        vec![TestColor::A, TestColor::B, TestColor::C, TestColor::D],
    );
    let matches_exact = tespat_exact.capture(&capture_pattern, SymmetryList::ID);
    tespat_exact.replace(
        &matches_exact,
        &pattern(1, vec![MatchColor::Exact(TestColor::E)]),
    );
    assert_eq!(
        tespat_exact.export(),
        &vec![TestColor::E, TestColor::E, TestColor::E, TestColor::E]
    );
}

#[test]
fn non_overlap_treats_not_in_capture_cells_as_occupied() {
    let tespat = tespat(3, vec![TestColor::A, TestColor::B, TestColor::A]);
    let match_pattern = pattern(
        2,
        vec![
            MatchColor::not_in(vec![TestColor::C]),
            MatchColor::not_in(vec![TestColor::C]),
        ],
    );
    let replace_pattern = pattern(2, vec![MatchColor::Ignore, MatchColor::Ignore]);

    let mut matches = tespat.capture(&match_pattern, SymmetryList::ID);
    matches.pick_non_overlapping(&tespat, &match_pattern, &replace_pattern);

    assert_eq!(matches.len(), 1);
}

#[test]
fn non_overlap_treats_ignore_plus_non_exact_replace_as_transparent() {
    let tespat = tespat(3, vec![TestColor::A, TestColor::B, TestColor::A]);
    let match_pattern = pattern(2, vec![MatchColor::Ignore, MatchColor::Ignore]);
    let replace_pattern = pattern(
        2,
        vec![MatchColor::any_of(vec![TestColor::E]), MatchColor::Ignore],
    );

    let mut matches = tespat.capture(&match_pattern, SymmetryList::ID);
    matches.pick_non_overlapping(&tespat, &match_pattern, &replace_pattern);

    assert_eq!(matches.len(), 2);
}

#[test]
fn create_tespat_rejects_special_capture_rules() {
    let pattern = pattern(1, vec![MatchColor::any_of(vec![TestColor::A])]);

    assert!(pattern.create_tespat::<TestColor>().is_none());
}

#[test]
fn execute_non_overlap_keeps_any_of_capture_cells_opaque() {
    let mut tespat = tespat(3, vec![TestColor::A, TestColor::B, TestColor::A]);
    let match_pattern = pattern(
        2,
        vec![
            MatchColor::any_of(vec![TestColor::A, TestColor::B]),
            MatchColor::any_of(vec![TestColor::A, TestColor::B]),
        ],
    );
    let replace_pattern = pattern(2, vec![MatchColor::Ignore, MatchColor::Ignore]);

    assert!(tespat.execute(
        (&match_pattern, &replace_pattern),
        MatchFilter::NonOverlap,
        SymmetryList::ID
    ));
    assert_eq!(
        tespat.export(),
        &vec![TestColor::A, TestColor::B, TestColor::A]
    );
}
