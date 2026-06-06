test_that("mechanistic tradeoff terms are finite and bounded", {
  metrics <- analyze_ensemble(
    path_fraction_values = c(0.4, 0.7),
    n_rep = 4,
    base_params = new_spa_params(max_order = 7, seed = 310)
  )$metrics

  out <- compute_mechanistic_tradeoff(metrics)

  expect_true(all(is.finite(out$theta)))
  expect_true(all(is.finite(out$lambda)))
  expect_true(all(is.finite(out$phi_K) & out$phi_K >= 0 & out$phi_K <= 1))
  expect_true(all(is.finite(out$phi_Psi) & out$phi_Psi >= 0 & out$phi_Psi <= 1))
  expect_true(all(is.finite(out$phi_B) & out$phi_B >= 0 & out$phi_B <= 1))
  expect_true(all(is.finite(out$R_eff) & out$R_eff >= 0 & out$R_eff <= 1))
})

test_that("tradeoff surface is deterministic with fixed seed", {
  base <- new_spa_params(max_order = 6, seed = 2024)

  run1 <- compute_tradeoff_surface(
    path_fraction_values = c(0.4, 0.7),
    asymmetry_values = c(0.2, 0.8),
    length_decay_values = c(0.77, 0.80),
    radius_decay_values = c(0.67, 0.70),
    n_rep = 2,
    base_params = base
  )$surface

  run2 <- compute_tradeoff_surface(
    path_fraction_values = c(0.4, 0.7),
    asymmetry_values = c(0.2, 0.8),
    length_decay_values = c(0.77, 0.80),
    radius_decay_values = c(0.67, 0.70),
    n_rep = 2,
    base_params = base
  )$surface

  expect_equal(run1, run2)
})

test_that("frontier is non-empty and valid subset", {
  out <- compute_tradeoff_surface(
    path_fraction_values = c(0.45, 0.7, 0.9),
    asymmetry_values = c(0.1, 0.5),
    n_rep = 2,
    base_params = new_spa_params(max_order = 6, seed = 505)
  )

  fr <- compute_tradeoff_frontier(out$surface)

  expect_true(nrow(fr$frontier) >= 1)
  expect_true(all(fr$frontier$is_frontier))
  expect_true(all(fr$frontier$frontier_rank == seq_len(nrow(fr$frontier))))
})

test_that("tradeoff surface validates inputs", {
  expect_error(
    compute_tradeoff_surface(path_fraction_values = numeric(0)),
    "non-empty numeric"
  )
  expect_error(
    compute_tradeoff_surface(asymmetry_values = c(-0.1, 0.5)),
    "in \\[0, 1\\]"
  )
  expect_error(
    compute_tradeoff_surface(n_rep = 1.5),
    "integer"
  )
})

test_that("theta scaling surface is deterministic with fixed seed", {
  base <- new_spa_params(max_order = 6, seed = 909)

  run1 <- compute_theta_scaling_surface(
    path_fraction_values = c(0.4, 0.7),
    asymmetry_values = c(0.2, 0.8),
    length_decay_values = c(0.77, 0.80),
    radius_decay_values = c(0.67, 0.70),
    n_rep = 3,
    base_params = base
  )$surface

  run2 <- compute_theta_scaling_surface(
    path_fraction_values = c(0.4, 0.7),
    asymmetry_values = c(0.2, 0.8),
    length_decay_values = c(0.77, 0.80),
    radius_decay_values = c(0.67, 0.70),
    n_rep = 3,
    base_params = base
  )$surface

  expect_equal(run1, run2)
})

test_that("theta scaling outputs include finite theta and fitted exponents", {
  out <- compute_theta_scaling_surface(
    path_fraction_values = c(0.45, 0.7),
    asymmetry_values = c(0.1, 0.5),
    n_rep = 3,
    base_params = new_spa_params(max_order = 6, seed = 111)
  )

  expect_true(nrow(out$surface) >= 1)
  expect_true(all(is.finite(out$surface$theta_theory)))
  expect_true(all(is.finite(out$surface$lambda_path)))
  expect_true(all(is.finite(out$surface$alpha_leaf)))
  expect_true(all(out$surface$n_obs >= 3))
})
