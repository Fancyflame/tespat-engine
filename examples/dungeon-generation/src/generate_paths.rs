use tespat::{
    app::{Tespat, match_filter, matches::PickOrder},
    pattern::transform::SymmetryList,
};

use crate::imports::generate_paths::*;

pub fn generate(tespat: &mut Tespat<Color>) {
    loop {
        if tespat.execute(
            &pattern::CREATE_PATH,
            match_filter::one,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            &pattern::BACKWARD_PATH,
            match_filter::one,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            (&unit_pattern::ANCHOR, &unit_pattern::PATH_HEAD),
            match_filter::one,
            SymmetryList::ID,
        ) {
            continue;
        }

        break;
    }

    // 留一个路径头做下一轮凿墙寻路
    tespat.execute(
        (&unit_pattern::PATH_HEAD, &unit_pattern::ANCHOR),
        match_filter::one,
        SymmetryList::ID,
    );

    // 清除剩下的寻路头
    tespat.execute(
        (&unit_pattern::PATH_HEAD, &unit_pattern::PATH),
        match_filter::all,
        SymmetryList::ID,
    );

    // 保存房间信息
    let rooms_info = tespat.clone();

    // 将房间地面替换为路径
    tespat.execute(
        (&unit_pattern::ROOM, &unit_pattern::PATH),
        match_filter::all,
        SymmetryList::ID,
    );

    loop {
        if tespat.execute(
            &pattern::CREATE_CONNECTIVE_PATH,
            match_filter::all,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        if tespat.execute(
            &pattern::DRIP_DOOR,
            match_filter::one,
            SymmetryList::ROTATE_ONLY,
        ) {
            continue;
        }

        break;
    }

    tespat.execute(
        (&unit_pattern::ANCHOR, &unit_pattern::PATH),
        match_filter::all,
        SymmetryList::ID,
    );

    // 清除死胡同
    while tespat.execute(
        &pattern::CLEAR_DEAD_END,
        match_filter::all,
        SymmetryList::ROTATE_ONLY,
    ) {}

    // 随机连通几个区域
    tespat.execute(
        &pattern::DESTROY_WALL,
        match_filter::percent(0.03),
        SymmetryList::ROTATE_ONLY,
    );

    // 恢复房间
    {
        let m = rooms_info.capture(&unit_pattern::ROOM, SymmetryList::ID, PickOrder::Randomized);
        tespat.replace(&m, &unit_pattern::ROOM);
    }
}
