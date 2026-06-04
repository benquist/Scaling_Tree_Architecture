estimate_scaling_exponent <- function(df, x = "M_proxy", y = "B_proxy") {
  keep <- is.finite(df[[x]]) & is.finite(df[[y]]) & df[[x]] > 0 & df[[y]] > 0
  dat <- df[keep, , drop = FALSE]

  if (nrow(dat) < 3) {
    return(tibble::tibble(term = "log_slope", estimate = NA_real_, std_error = NA_real_, conf_low = NA_real_, conf_high = NA_real_))
  }

  fit <- stats::lm(log(dat[[y]]) ~ log(dat[[x]]))
  cf <- summary(fit)$coefficients
  slope <- cf[2, 1]
  se <- cf[2, 2]
  crit <- qt(0.975, df = fit$df.residual)

  tibble::tibble(
    term = "log_slope",
    estimate = slope,
    std_error = se,
    conf_low = slope - crit * se,
    conf_high = slope + crit * se
  )
}

analyze_ensemble <- function(
  path_fraction_values = c(0.3, 0.5, 0.7, 1.0),
  n_rep = 50,
  base_params = new_spa_params(seed = NULL)
) {
  if (!inherits(base_params, "spa_params")) {
    stop("base_params must be created with new_spa_params()")
  }
  if (!is.numeric(path_fraction_values) || length(path_fraction_values) == 0 || any(!is.finite(path_fraction_values))) {
    stop("path_fraction_values must be a non-empty numeric vector of finite values")
  }
  if (any(path_fraction_values < 0 | path_fraction_values > 1)) {
    stop("path_fraction_values must all be in [0, 1]")
  }
  if (!is.numeric(n_rep) || length(n_rep) != 1 || !is.finite(n_rep) || n_rep < 1 || n_rep != as.integer(n_rep)) {
    stop("n_rep must be an integer >= 1")
  }

  n_rep <- as.integer(n_rep)
  rows <- vector("list", length(path_fraction_values) * n_rep)
  idx <- 1L

  for (pf_idx in seq_along(path_fraction_values)) {
    pf <- path_fraction_values[pf_idx]
    for (rep_id in seq_len(n_rep)) {
      updates <- list(path_fraction = pf)
      if (!is.null(base_params$seed)) {
        updates$seed <- base_params$seed + (pf_idx * 100000L) + rep_id
      }
      p <- update_spa_params(base_params, updates)

      tr <- simulate_branching_tree(p)
      met <- compute_scaling_metrics(tr)
      met$replicate <- rep_id
      rows[[idx]] <- met
      idx <- idx + 1L
    }
  }

  metrics <- dplyr::bind_rows(rows)

  pf_ar_tbl <- dplyr::transmute(
    metrics,
    M_proxy = path_fraction_realized,
    B_proxy = aspect_ratio
  )

  fit_pf_ar <- estimate_scaling_exponent(pf_ar_tbl, x = "M_proxy", y = "B_proxy")

  fit_k_m <- estimate_scaling_exponent(metrics, x = "M_proxy", y = "K_proxy")

  list(
    metrics = metrics,
    fits = list(
      path_fraction_to_aspect = fit_pf_ar,
      mass_to_conductance = fit_k_m
    )
  )
}

analytic_symmetric_wbe <- function(
  max_order = 12,
  branching_ratio = 2,
  length_ratio = 0.72,
  radius_ratio = 0.79,
  base_length = 1,
  base_radius = 0.1
) {
  orders <- seq_len(max_order)
  out <- vector("list", length(orders))

  for (k in orders) {
    levels <- 0:(k - 1)
    n_paths <- branching_ratio^k

    path_res <- (base_length / (base_radius^4)) * sum((length_ratio / (radius_ratio^4))^levels)
    k_total <- n_paths / path_res

    mass_levels <- branching_ratio^levels * pi * (base_radius * radius_ratio^levels)^2 * (base_length * length_ratio^levels)
    m_total <- sum(mass_levels)

    out[[k]] <- tibble::tibble(order = k, M_proxy = m_total, K_proxy = k_total)
  }

  dat <- dplyr::bind_rows(out)
  fit <- estimate_scaling_exponent(dat, x = "M_proxy", y = "K_proxy")
  list(table = dat, exponent = fit)
}
