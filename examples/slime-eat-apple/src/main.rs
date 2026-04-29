use tespat::{app::match_filter, pattern::transform::SymmetryList};

// 引入 build.rs 生成的规则代码。
mod example {
    tespat::include_tespat!("slime_eat_apple");
    impl ColorMapTrait for () {
        const MAP: ColorMapStruct = ColorMapStruct::DEFAULT;
    }
}

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
            match_filter::all,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            &pattern::SLIME_MOVE,
            match_filter::one,
            SymmetryList {
                ccw_90: true,
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
        tespat.export_history().to_editor_playback_file(),
    )
    .unwrap();
}
