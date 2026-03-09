use std::fs;

use tespat::{
    app::{MatchFilter, TespatBuilder},
    include_tespat,
    pattern::transform::SymmetryList,
};

include_tespat!();

fn main() {
    use imports::generate_rooms::*;

    let mut tespat = TespatBuilder::new_filled(Color::Empty, 50, 60)
        .enable_history(true)
        .build();

    // 选一些地方生成最小房间
    {
        let mut m = tespat.capture(&pattern::GENERATE_SEED_MATCH, SymmetryList::ID);
        m.pick_non_overlapping(
            &tespat,
            &pattern::GENERATE_SEED_MATCH,
            &pattern::GENERATE_SEED_REPLACE,
        );
        m.ratio_pick(0.4);
        tespat.replace(&m, &pattern::GENERATE_SEED_REPLACE);
    }

    // 如果还有空间可能可以生成
    loop {
        let empty_ratio =
            tespat.color_count(&Color::Empty) as f64 / (tespat.width() * tespat.height()) as f64;

        if empty_ratio < 0.4 {
            break;
        }

        if !tespat.execute(
            &pattern::SELECT_VERTEX_MATCH,
            &pattern::SELECT_VERTEX_REPLACE,
            MatchFilter::One,
            SymmetryList::ALL,
        ) {
            break;
        }

        // 墙壁扩散
        while tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_MATCH,
            &pattern::SELECT_WALL_TO_GROW_REPLACE,
            MatchFilter::One,
            SymmetryList::ALL,
        ) {}

        // 墙壁扩散完成，尝试关联顶点
        if !tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_END_MATCH,
            &pattern::SELECT_WALL_TO_GROW_END_REPLACE,
            MatchFilter::One,
            SymmetryList::ALL,
        ) {
            // 关联顶点失败，代表没有足够的空间供墙壁向外延伸

            // 取消激活顶点
            tespat.execute(
                Color::ActiveRoomVertex.unit_pattern(),
                Color::RoomVertex.unit_pattern(),
                MatchFilter::All,
                SymmetryList::ID,
            );

            // 将所有激活的墙禁止向外延伸
            tespat.execute(
                Color::GrowingWall.unit_pattern(),
                Color::DeactiveWall.unit_pattern(),
                MatchFilter::All,
                SymmetryList::ID,
            );

            // 将整堵墙禁止向外延伸
            while tespat.execute(
                &pattern::DEACTIVATE_WALL_MATCH,
                &pattern::DEACTIVATE_WALL_REPLACE,
                MatchFilter::One,
                SymmetryList::ROTATE_ONLY,
            ) {}

            // 下一波查找
            continue;
        }

        // 将所有顶点向外延伸
        tespat.execute(
            &pattern::VERTEX_GROW_MATCH,
            &pattern::VERTEX_GROW_REPLACE,
            MatchFilter::All,
            SymmetryList::ALL,
        );

        // 将所有墙向外延伸
        tespat.execute(
            &pattern::WALL_GROW_MATCH,
            &pattern::WALL_GROW_REPLACE,
            MatchFilter::All,
            SymmetryList::ALL,
        );
    }

    // 生成完毕，将所有禁止激活的墙重新写为墙
    tespat.execute(
        Color::DeactiveWall.unit_pattern(),
        Color::Wall.unit_pattern(),
        MatchFilter::All,
        SymmetryList::ID,
    );

    fs::write("exported.json", tespat.export_history().to_json()).unwrap();
}
