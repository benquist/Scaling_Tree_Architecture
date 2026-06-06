test_that("layout_smith_tree returns valid normalized geometry", {
  p <- new_smith_params(N_t = 64, u = -2, seed = 123)
  tr <- simulate_smith_tree(p)
  lay <- layout_smith_tree(tr, seed = 456)

  expect_true(is.list(lay))
  expect_true(all(c("segments", "path_fraction", "aspect_ratio") %in% names(lay)))
  expect_true(is.finite(lay$path_fraction))
  expect_true(lay$path_fraction > 0 && lay$path_fraction <= 1)
  expect_true(is.finite(lay$aspect_ratio))
  expect_true(all(is.finite(lay$segments$x0)))
  expect_true(all(is.finite(lay$segments$y0)))
  expect_true(all(is.finite(lay$segments$x1)))
  expect_true(all(is.finite(lay$segments$y1)))
})

test_that("plot_smith_architecture_spectrum returns summary rows", {
  stats <- plot_smith_architecture_spectrum(
    N_twig = 32,
    f_max = 3,
    u_values = c(-3, 0, 3),
    seed = 11
  )

  expect_true(is.data.frame(stats))
  expect_equal(nrow(stats), 3)
  expect_true(all(c("u", "n_tips", "path_fraction", "aspect_ratio") %in% names(stats)))
})
