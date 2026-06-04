test_that("simulate_branching_tree returns valid class", {
  p <- new_spa_params(max_order = 6, seed = 11)
  tr <- simulate_branching_tree(p)

  expect_s3_class(tr, "spa_tree")
  expect_true(nrow(tr$nodes) > 1)
  expect_true(nrow(tr$edges) > 0)
})

test_that("ensemble metrics expose bounded realized path-fraction columns", {
  metrics <- analyze_ensemble(
    path_fraction_values = c(0.3, 0.7, 1.0),
    n_rep = 6,
    base_params = new_spa_params(max_order = 8, seed = 700)
  )$metrics

  expect_true(all(is.finite(metrics$path_fraction_realized)))
  expect_true(all(metrics$path_fraction_realized >= 0 & metrics$path_fraction_realized <= 1))
  expect_true(all(is.finite(metrics$path_fraction_realized_main)))
  expect_true(all(metrics$path_fraction_realized_main >= 0 & metrics$path_fraction_realized_main <= 1))
  expect_true(all(is.finite(metrics$path_fraction_realized_length)))
  expect_true(all(metrics$path_fraction_realized_length >= 0 & metrics$path_fraction_realized_length <= 1))
  expect_equal(metrics$path_fraction_realized, metrics$path_fraction_realized_main)
})

test_that("fixed seed is deterministic for simulation metrics", {
  p <- new_spa_params(max_order = 7, path_fraction = 0.68, seed = 2001)

  m1 <- compute_scaling_metrics(simulate_branching_tree(p))
  m2 <- compute_scaling_metrics(simulate_branching_tree(p))

  expect_equal(m1$path_fraction_realized, m2$path_fraction_realized)
  expect_equal(m1$M_proxy, m2$M_proxy)
  expect_equal(m1$K_proxy, m2$K_proxy)
})

test_that("realized path-fraction metrics are bounded and available", {
  p <- new_spa_params(max_order = 7, path_fraction = 0.5, seed = 900)
  path_summary <- compute_path_metrics(simulate_branching_tree(p))$summary

  expect_true(path_summary$realized_path_fraction_main >= 0 && path_summary$realized_path_fraction_main <= 1)
  expect_true(path_summary$realized_path_fraction_length >= 0 && path_summary$realized_path_fraction_length <= 1)
  expect_equal(path_summary$realized_path_fraction, path_summary$realized_path_fraction_main)
})
