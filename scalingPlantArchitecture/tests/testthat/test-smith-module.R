test_that("smith rank partition conserves rank and ordering", {
  set.seed(1)
  d <- smith_partition_rank(R_m = 37, f = 4, u = -2)

  expect_equal(sum(d), 37)
  expect_true(all(diff(d) >= 0))
  expect_equal(length(d), 4)
})

test_that("simulate_smith_tree returns expected structure", {
  p <- new_smith_params(N_t = 64, f_max = 3, u = 0, seed = 101)
  tr <- simulate_smith_tree(p)

  expect_s3_class(tr, "smith_tree")
  expect_true(nrow(tr$segments) > 1)
  expect_true(nrow(tr$tips) > 1)
  expect_equal(tr$summary$n_tips, 64)
  expect_true(tr$summary$total_network_path_length > 0)
})

test_that("simulate_smith_tree keeps a single pre-furcation trunk", {
  p <- new_smith_params(N_t = 64, f_max = 4, u = 1, seed = 202)
  tr <- simulate_smith_tree(p)

  root_children <- tr$segments$segment_id[which(tr$segments$parent_id == 1L)]
  expect_length(root_children, 1)

  trunk_child_rank <- tr$segments$rank[tr$segments$segment_id == root_children[1]]
  expect_equal(trunk_child_rank, p$N_t)
})

test_that("smith allometry experiment returns both requested fits", {
  p <- new_smith_params(f_max = 3, u = 1, seed = 5)
  out <- run_smith_allometry_experiment(
    n_tips_values = c(16, 32, 64),
    n_rep = 4,
    base_params = p
  )

  expect_true(all(c("metrics", "fits", "base_params") %in% names(out)))
  expect_true(nrow(out$metrics) == 12)
  expect_true(all(c(
    "total_path_length_vs_tip_count",
    "total_path_length_vs_basal_diameter"
  ) %in% out$fits$relationship))
})
