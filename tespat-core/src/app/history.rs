pub(super) struct History<T> {
    change_position: (usize, usize),
    width: usize,
    change_to: Vec<T>,
}
