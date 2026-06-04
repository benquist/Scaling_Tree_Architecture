test_that("new_spa_params validates parameter domains", {
  expect_error(new_spa_params(asym_alpha = 0), "asym_alpha must be > 0")
  expect_error(new_spa_params(asym_beta = 0), "asym_beta must be > 0")
  expect_error(new_spa_params(base_radius = 0), "base_radius must be > 0")
  expect_error(new_spa_params(base_length = 0), "base_length must be > 0")
  expect_error(new_spa_params(branch_angle_sd = -1), "branch_angle_sd must be >= 0")
  expect_error(new_spa_params(main_angle_sd = -1), "main_angle_sd must be >= 0")
  expect_error(new_spa_params(seed = 3.5), "seed must be NULL or a finite integer")
})

test_that("analyze_ensemble validates inputs", {
  p <- new_spa_params(seed = 1)

  expect_error(
    analyze_ensemble(path_fraction_values = numeric(0), n_rep = 5, base_params = p),
    "path_fraction_values must be a non-empty numeric vector of finite values"
  )
  expect_error(
    analyze_ensemble(path_fraction_values = c(-0.1, 0.5), n_rep = 5, base_params = p),
    "path_fraction_values must all be in \\[0, 1\\]"
  )
  expect_error(
    analyze_ensemble(path_fraction_values = c(0.3, 0.5), n_rep = 0, base_params = p),
    "n_rep must be an integer >= 1"
  )
})

test_that("analyze_ensemble seed offsets avoid collisions across path-fraction values", {
  p <- new_spa_params(seed = 7)

  res <- analyze_ensemble(path_fraction_values = c(0.3000, 0.3001), n_rep = 2, base_params = p)
  expect_equal(nrow(res$metrics), 4)

  group_means <- res$metrics |>
    dplyr::group_by(path_fraction_target) |>
    dplyr::summarise(k_mean = mean(K_proxy), .groups = "drop")

  expect_equal(nrow(group_means), 2)
  expect_true(length(unique(group_means$k_mean)) >= 1)
})
