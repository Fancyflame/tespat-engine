use tespat::{
    app::{MatchFilter, Tespat},
    pattern::transform::SymmetryList,
};

use crate::imports::generate_paths::*;

pub fn generate(tespat: &mut Tespat<Color>) {
    loop {
        if tespat.execute(&pattern::CREATE_PATH, MatchFilter::One, SymmetryList::ROTATE_ONLY) {
            continue;
        }

        if tespat.execute(&pattern::BACKWARD_PATH, MatchFilter::One, SymmetryList::ROTATE_ONLY) {
            continue;
        }

        if tespat.execute(
            (&unit_pattern::ANCHOR, &unit_pattern::PATH_HEAD),
            MatchFilter::One,
            SymmetryList::ID,
        ) {
            continue;
        }

        break;
    }

    // 留一个路径头做下一轮凿墙寻路
    tespat.execute(
        (&unit_pattern::PATH_HEAD, &unit_pattern::ANCHOR),
        MatchFilter::One,
        SymmetryList::ID,
    );

    // 清除剩下的寻路头
    tespat.execute(
        (&unit_pattern::PATH_HEAD, &unit_pattern::PATH),
        MatchFilter::All,
        SymmetryList::ID,
    );

    // 保存房间信息
    let rooms_info = tespat.clone();

    // 将房间地面替换为路径
    tespat.execute(
        (&unit_pattern::ROOM, &unit_pattern::PATH),
        MatchFilter::All,
        SymmetryList::ID,
    );

    loop {
        if tespat.execute(
            &pattern::CREATE_CONNECTIVE_PATH,
            MatchFilter::All,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(&pattern::DRIP_DOOR, MatchFilter::One, SymmetryList::ROTATE_ONLY) {
            continue;
        }

        break;
    }

    tespat.execute(
        (&unit_pattern::ANCHOR, &unit_pattern::PATH),
        MatchFilter::All,
        SymmetryList::ID,
    );

    // 清除死胡同
    while tespat.execute(&pattern::CLEAR_DEAD_END, MatchFilter::All, SymmetryList::ROTATE_ONLY) {}

    // 随机连通几个区域
    tespat.execute(
        &pattern::DESTROY_WALL,
        MatchFilter::Percent(0.03),
        SymmetryList::ROTATE_ONLY,
    );

    // 恢复房间
    {
        let m = rooms_info.capture(&unit_pattern::ROOM, SymmetryList::ID);
        tespat.replace(&m, &unit_pattern::ROOM);
    }
}
