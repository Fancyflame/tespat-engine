use tespat::{
    app::{MatchFilter, Tespat, TespatBuilder},
    pattern::transform::SymmetryList,
};

use crate::imports::generate_rooms::*;

impl From<Color> for crate::imports::generate_paths::Color {
    fn from(value: Color) -> Self {
        match value {
            Color::Empty => Self::Empty,
            Color::Border => Self::Empty,
            Color::Wall => Self::Wall,
            Color::RoomFloor => Self::Room,
            // Color::RoomVertex => Self::RoomVertex,
            Color::Anchor => Self::Anchor,
            _ => {
                log::error!("无效Color转换({value:?})，使用默认值");
                Self::Empty
            }
        }
    }
}

pub fn generate(enable_history: bool, width: usize, height: usize) -> Tespat<Color> {
    let mut tespat = TespatBuilder::new_filled(Color::Border, width, height)
        .enable_history(enable_history)
        .build();

    // 生成边界
    tespat.execute(
        &pattern::FIND_BORDER_MATCH,
        &pattern::FIND_BORDER_REPLACE,
        MatchFilter::All,
        SymmetryList::ID,
    );

    // 生成一个锚点
    tespat.execute(
        &pattern::SPAWN_FIRST_ANCHOR_MATCH,
        &pattern::SPAWN_FIRST_ANCHOR_REPLACE,
        MatchFilter::One,
        SymmetryList::ID,
    );

    // 生成网格
    while tespat.execute(
        &pattern::SPAWN_GRID_MATCH,
        &pattern::SPAWN_GRID_REPLACE,
        MatchFilter::All,
        SymmetryList::ROTATE_ONLY,
    ) {}

    // 选一些地方生成最小房间
    {
        let mut m = tespat.capture(&pattern::GENERATE_SEED_MATCH, SymmetryList::ID);
        m.pick_non_overlapping(
            &tespat,
            &pattern::GENERATE_SEED_MATCH,
            &pattern::GENERATE_SEED_REPLACE,
        );
        m.ratio_pick(0.5);
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
        ) || tespat.execute(
            &pattern::SELECT_WALL_TO_GROW_MATCH_2,
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

    // 将所有顶点换成墙
    tespat.execute(
        Color::RoomVertex.unit_pattern(),
        Color::Wall.unit_pattern(),
        MatchFilter::All,
        SymmetryList::ID,
    );

    tespat.execute(
        Color::Wall.unit_pattern(),
        Color::RoomFloor.unit_pattern(),
        MatchFilter::All,
        SymmetryList::ID,
    );

    tespat
}
