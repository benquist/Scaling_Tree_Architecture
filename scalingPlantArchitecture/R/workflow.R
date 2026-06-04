run_scaling_experiment <- function(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.0),
  n_rep = 60,
  base_params = new_spa_params(seed = NULL)
) {
  ens <- analyze_ensemble(
    path_fraction_values = path_fraction_values,
    n_rep = n_rep,
    base_params = base_params
  )

  summary_tbl <- ens$metrics |>
    dplyr::group_by(path_fraction_target) |>
    dplyr::summarise(
      mean_path_fraction = mean(path_fraction_realized, na.rm = TRUE),
      mean_aspect_ratio = mean(aspect_ratio, na.rm = TRUE),
      mean_mass_proxy = mean(M_proxy, na.rm = TRUE),
      mean_conductance_proxy = mean(K_proxy, na.rm = TRUE),
      .groups = "drop"
    )

  list(
    metrics = ens$metrics,
    fits = ens$fits,
    summary = summary_tbl,
    analytical_baseline = analytic_symmetric_wbe(
      max_order = base_params$max_order,
      length_ratio = base_params$length_decay,
      radius_ratio = base_params$radius_decay,
      base_length = base_params$base_length,
      base_radius = base_params$base_radius
    )
  )
}
