use tespat::{app::MatchFilter, include_tespat, pattern::transform::SymmetryList};

include_tespat!();

fn main() {
    use example::*;

    let mut tespat = pattern::GRAPH
        .create_tespat()
        .unwrap()
        .enable_history(true)
        .build();

    loop {
        // 生成所有候选点，未成功生成则意味着全部墙体已生成完毕
        if !tespat.execute(
            &pattern::SEARCH_SPACE_MATCH,
            &pattern::SEARCH_SPACE_REPLACE,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {
            break;
        }

        // 随机挑选一个候选点生成种子
        tespat.execute(
            Color::SeedCandidate.unit_pattern(),
            Color::Seed.unit_pattern(),
            MatchFilter::One,
            SymmetryList::ID,
        );

        // 将所有未使用的候选点替换回active
        tespat.execute(
            Color::SeedCandidate.unit_pattern(),
            Color::Active.unit_pattern(),
            MatchFilter::All,
            SymmetryList::ID,
        );

        // 生成方向
        tespat.execute(
            &pattern::DIRECTION_SELECT_MATCH,
            &pattern::DIRECTION_SELECT_REPLACE,
            MatchFilter::One,
            SymmetryList::ROTATE_ONLY,
        );

        // 延伸墙体
        while tespat.execute(
            &pattern::PROPAGATION_MATCH,
            &pattern::PROPAGATION_REPLACE,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {}

        tespat.execute(
            Color::Growth.unit_pattern(),
            Color::Wall.unit_pattern(),
            MatchFilter::All,
            SymmetryList::ID,
        );

        tespat.execute(
            Color::Seed.unit_pattern(),
            Color::Wall.unit_pattern(),
            MatchFilter::All,
            SymmetryList::ID,
        );
    }

    std::fs::write("exported.json", tespat.export_history().to_json()).unwrap();
}
