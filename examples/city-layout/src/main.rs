use tespat::{
    app::{TespatBuilder, match_filter},
    pattern::transform::SymmetryList,
};

// 引入 build.rs 生成的规则代码。
mod example {
    tespat::include_tespat!("city-layout");

    impl ColorMapTrait for () {
        const MAP: ColorMapStruct = ColorMapStruct {
            any: tespat::MatchColor::Ignore,
            ..ColorMapStruct::DEFAULT
        };
    }
}

fn main() {
    use example::*;

    let mut tespat = TespatBuilder::new_filled(Color::Active, 20, 30)
        .enable_history(true)
        .build();

    loop {
        // 生成所有候选点，未成功生成则意味着全部墙体已生成完毕
        if !tespat.execute(
            &pattern::SEARCH_SPACE,
            match_filter::all,
            SymmetryList::ROTATE_ONLY,
        ) {
            break;
        }

        // 随机挑选一个候选点生成种子
        tespat.execute(
            (&unit_pattern::SEED_CANDIDATE, &unit_pattern::SEED),
            match_filter::one,
            SymmetryList::ID,
        );

        // 将所有未使用的候选点替换回active
        tespat.execute(
            (&unit_pattern::SEED_CANDIDATE, &unit_pattern::ACTIVE),
            match_filter::all,
            SymmetryList::ID,
        );

        // 生成方向
        tespat.execute(
            &pattern::DIRECTION_SELECT,
            match_filter::one,
            SymmetryList::ROTATE_ONLY,
        );

        // 延伸墙体
        while tespat.execute(
            &pattern::PROPAGATION,
            match_filter::all,
            SymmetryList::ROTATE_ONLY,
        ) {}

        tespat.execute(
            (&unit_pattern::GROWTH, &unit_pattern::WALL),
            match_filter::all,
            SymmetryList::ID,
        );

        tespat.execute(
            (&unit_pattern::SEED, &unit_pattern::WALL),
            match_filter::all,
            SymmetryList::ID,
        );
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
