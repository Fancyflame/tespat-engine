use tespat::{app::MatchFilter, include_tespat, pattern::transform::SymmetryList};

include_tespat!();

fn main() {
    use example::pattern;
    let mut tespat = pattern::GRAPH
        .0
        .create_tespat()
        .unwrap()
        .enable_history(true)
        .build();

    loop {
        if tespat.execute(
            &pattern::EAT_APPLE,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            &pattern::SLIME_MOVE,
            MatchFilter::One,
            SymmetryList {
                rot_90: true,
                ..SymmetryList::ID
            },
        ) {
            continue;
        }

        break;
    }

    std::fs::write(
        format!(
            "{}/exported.json",
            std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()
        ),
        tespat.export_history().to_json(),
    )
    .unwrap();
}
