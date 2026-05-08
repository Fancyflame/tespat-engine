use tespat::{
    app::{Tespat, TespatBuilder, match_filter, matches::PickOrder},
    pattern::transform::SymmetryList,
};

use crate::imports::generate_paths::{self, Color as OutputColor};

use crate::imports::generate_rooms::*;

pub fn cast_color_for_output(c: &Color) -> Option<OutputColor> {
    Some(match *c {
        color::Empty | color::Border => generate_paths::color::Empty,
        color::Wall => generate_paths::color::Wall,
        color::RoomFloor => generate_paths::color::Room,
        color::Anchor => generate_paths::color::Anchor,
        _ => return None,
    })
}

pub fn generate(enable_history: bool, width: usize, height: usize) -> Tespat<Color> {
    let mut tespat = TespatBuilder::new_filled(color::Border, width, height)
        .enable_history(enable_history)
        .build();

    // 生成边界
    tespat.execute(&pattern::FIND_BORDER, match_filter::all, SymmetryList::ID);

    // 生成一个锚点
    tespat.execute(
        &pattern::SPAWN_FIRST_ANCHOR,
        match_filter::one,
        SymmetryList::ID,
    );

    // 生成网格
    while tespat.execute(
        &pattern::SPAWN_GRID,
        match_filter::all,
        SymmetryList::ROTATE_ONLY,
    ) {}

    // 选一些地方生成最小房间
    {
        let mut m = tespat.capture(
            &pattern::GENERATE_SEED.0,
            SymmetryList::ID,
            PickOrder::Randomized,
        );
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
            tespat.color_count(&color::Empty) as f64 / (tespat.width() * tespat.height()) as f64;

        if empty_ratio < 0.3 {
            break;
        }

        if !tespat.execute(
            &pattern::SELECT_VERTEX,
            match_filter::one,
            SymmetryList::FULL,
        ) {
            break;
        }

        // 墙壁扩散
        while tespat.execute(
            &pattern::SELECT_WALL_TO_GROW,
            match_filter::one,
            SymmetryList::FULL,
        ) || tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_2,
            match_filter::one,
            SymmetryList::FULL,
        ) {}

        // 墙壁扩散完成，尝试关联顶点
        if !tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_END,
            match_filter::one,
            SymmetryList::FULL,
        ) {
            // 关联顶点失败，代表没有足够的空间供墙壁向外延伸

            // 取消激活顶点
            tespat.execute(
                (
                    &unit_pattern::ACTIVE_ROOM_VERTEX,
                    &unit_pattern::ROOM_VERTEX,
                ),
                match_filter::all,
                SymmetryList::ID,
            );

            // 将所有激活的墙禁止向外延伸
            tespat.execute(
                (&unit_pattern::GROWING_WALL, &unit_pattern::DEACTIVE_WALL),
                match_filter::all,
                SymmetryList::ID,
            );

            // 将整堵墙禁止向外延伸
            while tespat.execute(
                &pattern::DEACTIVATE_WALL,
                match_filter::one,
                SymmetryList::ROTATE_ONLY,
            ) {}

            // 下一波查找
            continue;
        }

        // 将所有顶点向外延伸
        tespat.execute(&pattern::VERTEX_GROW, match_filter::all, SymmetryList::FULL);

        // 将所有墙向外延伸
        tespat.execute(&pattern::WALL_GROW, match_filter::all, SymmetryList::FULL);
    }

    // 生成完毕，将所有禁止激活的墙重新写为墙
    tespat.execute(
        (&unit_pattern::DEACTIVE_WALL, &unit_pattern::WALL),
        match_filter::all,
        SymmetryList::ID,
    );

    // 将所有顶点换成墙
    tespat.execute(
        (&unit_pattern::ROOM_VERTEX, &unit_pattern::WALL),
        match_filter::all,
        SymmetryList::ID,
    );

    tespat.execute(
        (&unit_pattern::WALL, &unit_pattern::ROOM_FLOOR),
        match_filter::all,
        SymmetryList::ID,
    );

    tespat
}
