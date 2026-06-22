test_that("new_wbe_params validates furcation_ratio", {
  expect_error(new_wbe_params(furcation_ratio = 1), "furcation_ratio")
  expect_s3_class(new_wbe_params(furcation_ratio = 3), "wbe_params")
})

test_that("diagnostic runs and returns theory exponent", {
  p <- new_wbe_params(max_order = 7, furcation_ratio = 2, seed = 1)
  out <- run_wbe_scaling_diagnostic(order_values = 4:6, n_rep = 3, base_params = p)
  expect_true(is.list(out))
  expect_true(is.finite(out$theoretical_exponent))
  expect_true(nrow(out$metrics) > 0)
})
