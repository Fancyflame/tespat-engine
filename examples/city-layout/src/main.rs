use tespat::{
    app::{MatchFilter, TespatBuilder},
    pattern::transform::SymmetryList,
};

// 引入 build.rs 生成的规则代码。
mod example {
    tespat::include_tespat!("city-layout");
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
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {
            break;
        }

        // 随机挑选一个候选点生成种子
        tespat.execute(
            (&unit_pattern::SEED_CANDIDATE, &unit_pattern::SEED),
            MatchFilter::One,
            SymmetryList::ID,
        );

        // 将所有未使用的候选点替换回active
        tespat.execute(
            (&unit_pattern::SEED_CANDIDATE, &unit_pattern::ACTIVE),
            MatchFilter::All,
            SymmetryList::ID,
        );

        // 生成方向
        tespat.execute(
            &pattern::DIRECTION_SELECT,
            MatchFilter::One,
            SymmetryList::ROTATE_ONLY,
        );

        // 延伸墙体
        while tespat.execute(
            &pattern::PROPAGATION,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {}

        tespat.execute(
            (&unit_pattern::GROWTH, &unit_pattern::WALL),
            MatchFilter::All,
            SymmetryList::ID,
        );

        tespat.execute(
            (&unit_pattern::SEED, &unit_pattern::WALL),
            MatchFilter::All,
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
