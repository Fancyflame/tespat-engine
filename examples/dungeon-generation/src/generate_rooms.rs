use tespat::{
    app::{MatchFilter, Tespat, TespatBuilder},
    pattern::transform::SymmetryList,
};

use crate::imports::generate_paths::Color as OutputColor;

use crate::imports::generate_rooms::*;

pub fn cast_color_for_output(c: &Color) -> Option<OutputColor> {
    let v = match c {
        Color::Empty => OutputColor::Empty,
        Color::Border => OutputColor::Empty,
        Color::Wall => OutputColor::Wall,
        Color::RoomFloor => OutputColor::Room,
        // Color::RoomVertex => Self::RoomVertex,
        Color::Anchor => OutputColor::Anchor,
        _ => return None,
    };
    Some(v)
}

pub fn generate(enable_history: bool, width: usize, height: usize) -> Tespat<Color> {
    let mut tespat = TespatBuilder::new_filled(Color::Border, width, height)
        .enable_history(enable_history)
        .build();

    // 生成边界
    tespat.execute(&pattern::FIND_BORDER, MatchFilter::All, SymmetryList::ID);

    // 生成一个锚点
    tespat.execute(
        &pattern::SPAWN_FIRST_ANCHOR,
        MatchFilter::One,
        SymmetryList::ID,
    );

    // 生成网格
    while tespat.execute(
        &pattern::SPAWN_GRID,
        MatchFilter::All,
        SymmetryList::ROTATE_ONLY,
    ) {}

    // 选一些地方生成最小房间
    {
        let mut m = tespat.capture(&pattern::GENERATE_SEED.0, SymmetryList::ID);
        m.pick_non_overlapping(
            &tespat,
            &pattern::GENERATE_SEED.0,
            &pattern::GENERATE_SEED.1,
        );
        m.ratio_pick(0.4);
        tespat.replace(&m, &pattern::GENERATE_SEED.1);
    }

    // 如果还有空间可能可以生成
    loop {
        let empty_ratio =
            tespat.color_count(&Color::Empty) as f64 / (tespat.width() * tespat.height()) as f64;

        if empty_ratio < 0.3 {
            break;
        }

        if !tespat.execute(
            &pattern::SELECT_VERTEX,
            MatchFilter::One,
            SymmetryList::FULL,
        ) {
            break;
        }

        // 墙壁扩散
        while tespat.execute(
            &pattern::SELECT_WALL_TO_GROW,
            MatchFilter::One,
            SymmetryList::FULL,
        ) || tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_2,
            MatchFilter::One,
            SymmetryList::FULL,
        ) {}

        // 墙壁扩散完成，尝试关联顶点
        if !tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_END,
            MatchFilter::One,
            SymmetryList::FULL,
        ) {
            // 关联顶点失败，代表没有足够的空间供墙壁向外延伸

            // 取消激活顶点
            tespat.execute(
                (
                    &unit_pattern::ACTIVE_ROOM_VERTEX,
                    &unit_pattern::ROOM_VERTEX,
                ),
                MatchFilter::All,
                SymmetryList::ID,
            );

            // 将所有激活的墙禁止向外延伸
            tespat.execute(
                (&unit_pattern::GROWING_WALL, &unit_pattern::DEACTIVE_WALL),
                MatchFilter::All,
                SymmetryList::ID,
            );

            // 将整堵墙禁止向外延伸
            while tespat.execute(
                &pattern::DEACTIVATE_WALL,
                MatchFilter::One,
                SymmetryList::ROTATE_ONLY,
            ) {}

            // 下一波查找
            continue;
        }

        // 将所有顶点向外延伸
        tespat.execute(&pattern::VERTEX_GROW, MatchFilter::All, SymmetryList::FULL);

        // 将所有墙向外延伸
        tespat.execute(&pattern::WALL_GROW, MatchFilter::All, SymmetryList::FULL);
    }

    // 生成完毕，将所有禁止激活的墙重新写为墙
    tespat.execute(
        (&unit_pattern::DEACTIVE_WALL, &unit_pattern::WALL),
        MatchFilter::All,
        SymmetryList::ID,
    );

    // 将所有顶点换成墙
    tespat.execute(
        (&unit_pattern::ROOM_VERTEX, &unit_pattern::WALL),
        MatchFilter::All,
        SymmetryList::ID,
    );

    tespat.execute(
        (&unit_pattern::WALL, &unit_pattern::ROOM_FLOOR),
        MatchFilter::All,
        SymmetryList::ID,
    );

    tespat
}
