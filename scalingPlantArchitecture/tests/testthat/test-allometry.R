test_that("compute_tree_allometries returns expected structures", {
  tr <- simulate_branching_tree(new_spa_params(max_order = 7, seed = 123))
  out <- compute_tree_allometries(tr)

  expect_true(is.list(out))
  expect_true(all(c("edge_allometries", "tip_allometries", "summary") %in% names(out)))
  expect_true(nrow(out$edge_allometries) > 0)
  expect_true(nrow(out$tip_allometries) > 0)
  expect_true(nrow(out$summary) == 1)

  expect_true(all(c("stem_volume", "leaf_area_proxy", "is_terminal_edge") %in% names(out$edge_allometries)))
  expect_true(all(c("path_length", "path_fraction", "leaf_area_proxy", "stem_volume_to_tip") %in% names(out$tip_allometries)))
  expect_true(all(out$tip_allometries$path_fraction >= 0 & out$tip_allometries$path_fraction <= 1))
})

test_that("compute_node_path_lengths returns both tips and non-tip nodes", {
  tr <- simulate_branching_tree(new_spa_params(max_order = 7, seed = 321))
  node_paths <- compute_node_path_lengths(tr)

  expect_true(nrow(node_paths) > 0)
  expect_true(all(c("node_id", "path_length", "is_tip") %in% names(node_paths)))
  expect_true(all(node_paths$path_length > 0))
  expect_true(any(node_paths$is_tip))
})

test_that("new plotting helpers return ggplot objects", {
  tr <- simulate_branching_tree(new_spa_params(max_order = 6, seed = 222))

  p1 <- plot_tree_allometries(tr, preset = "publication", show_ci = FALSE)
  p2 <- plot_path_length_distribution(tr, endpoint = "tips", bins = 12, preset = "publication")
  p3 <- plot_path_length_distribution(tr, endpoint = "all_nodes", bins = 12, preset = "publication")

  expect_s3_class(p1, "ggplot")
  expect_s3_class(p2, "ggplot")
  expect_s3_class(p3, "ggplot")
})

test_that("teaching dashboard returns component plots", {
  tr <- simulate_branching_tree(new_spa_params(max_order = 6, seed = 654))

  out <- plot_tree_teaching_dashboard(
    tr,
    preset = "publication",
    bins = 12,
    endpoint = "tips",
    show_ci = FALSE,
    draw = FALSE
  )

  expect_true(is.list(out))
  expect_true(all(c("tree_plot", "allometry_plot", "path_length_plot") %in% names(out)))
  expect_s3_class(out$tree_plot, "ggplot")
  expect_s3_class(out$allometry_plot, "ggplot")
  expect_s3_class(out$path_length_plot, "ggplot")
})
