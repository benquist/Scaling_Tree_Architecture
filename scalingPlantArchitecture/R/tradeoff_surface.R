`%||%` <- function(x, y) if (is.null(x)) y else x

.normalize_weights <- function(w_k, w_psi, w_b) {
  wsum <- w_k + w_psi + w_b
  if (!is.finite(wsum) || wsum <= 0) {
    stop("Weights must sum to a positive finite value")
  }
  c(w_k = w_k / wsum, w_psi = w_psi / wsum, w_b = w_b / wsum)
}

compute_mechanistic_tradeoff <- function(
  metrics_df,
  eps = 1e-9,
  k0 = 0.6,
  b0 = 0.35,
  c_psi = 0.9,
  p_psi = 2,
  c_lambda = 0.6,
  w_k = 0.45,
  w_psi = 0.30,
  w_b = 0.25
) {
  required_cols <- c("M_proxy", "n_tips", "mean_path_length")
  missing_cols <- setdiff(required_cols, names(metrics_df))
  if (length(missing_cols) > 0) {
    stop("metrics_df is missing required columns: ", paste(missing_cols, collapse = ", "))
  }

  w <- .normalize_weights(w_k, w_psi, w_b)

  df <- dplyr::as_tibble(metrics_df) |>
    dplyr::mutate(
      M_eff = M_proxy,
      N_eff = n_tips,
      L_eff = mean_path_length,
      Vp_eff = dplyr::if_else(
        "mean_path_stem_volume" %in% names(metrics_df) & is.finite(mean_path_stem_volume) & mean_path_stem_volume > 0,
        mean_path_stem_volume,
        M_proxy / pmax(n_tips, 1)
      )
    ) |>
    dplyr::mutate(
      valid_inputs = is.finite(M_eff) & is.finite(N_eff) & is.finite(L_eff) &
        (M_eff > 0) & (N_eff >= 1) & (L_eff > 0),
      theta = dplyr::if_else(
        valid_inputs,
        L_eff / (((M_eff / N_eff)^(1 / 3)) + eps),
        NA_real_
      ),
      lambda = dplyr::if_else(
        valid_inputs,
        Vp_eff / ((M_eff / N_eff) + eps),
        NA_real_
      ),
      K_tilde = dplyr::if_else(
        valid_inputs,
        (N_eff * Vp_eff^2) / (M_eff * L_eff^3 + eps),
        NA_real_
      ),
      B_tilde = dplyr::if_else(
        valid_inputs,
        M_eff / (N_eff * L_eff^3 + eps),
        NA_real_
      ),
      phi_K = dplyr::if_else(valid_inputs, K_tilde / (K_tilde + k0), NA_real_),
      phi_Psi = dplyr::if_else(valid_inputs, exp(-c_psi * theta^p_psi), NA_real_),
      phi_B = dplyr::if_else(
        valid_inputs,
        (B_tilde / (B_tilde + b0)) * exp(-c_lambda * (log(lambda + eps))^2),
        NA_real_
      ),
      R_eff = dplyr::if_else(
        valid_inputs,
        pmin(1, pmax(0, w[["w_k"]] * phi_K + w[["w_psi"]] * phi_Psi + w[["w_b"]] * phi_B)),
        NA_real_
      )
    ) |>
    dplyr::select(-M_eff, -N_eff, -L_eff)

  df
}

compute_tradeoff_surface <- function(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.0),
  asymmetry_values = c(0.25, 0.5, 0.75),
  length_decay_values = NULL,
  radius_decay_values = NULL,
  n_rep = 20,
  base_params = new_spa_params(seed = NULL),
  tradeoff_cfg = list()
) {
  if (!inherits(base_params, "spa_params")) {
    stop("base_params must be created with new_spa_params()")
  }
  if (!is.numeric(path_fraction_values) || length(path_fraction_values) == 0 || any(!is.finite(path_fraction_values))) {
    stop("path_fraction_values must be a non-empty numeric vector")
  }
  if (any(path_fraction_values < 0 | path_fraction_values > 1)) {
    stop("path_fraction_values must be in [0, 1]")
  }
  if (!is.numeric(asymmetry_values) || length(asymmetry_values) == 0 || any(!is.finite(asymmetry_values))) {
    stop("asymmetry_values must be a non-empty numeric vector")
  }
  if (any(asymmetry_values < 0 | asymmetry_values > 1)) {
    stop("asymmetry_values must be in [0, 1]")
  }
  if (!is.numeric(n_rep) || length(n_rep) != 1 || n_rep < 1 || n_rep != as.integer(n_rep)) {
    stop("n_rep must be an integer >= 1")
  }

  length_decay_values <- length_decay_values %||% base_params$length_decay
  radius_decay_values <- radius_decay_values %||% base_params$radius_decay

  if (any(length_decay_values <= 0 | length_decay_values >= 1)) {
    stop("length_decay_values must be within (0, 1)")
  }
  if (any(radius_decay_values <= 0 | radius_decay_values >= 1)) {
    stop("radius_decay_values must be within (0, 1)")
  }

  combos <- expand.grid(
    path_fraction = path_fraction_values,
    asymmetry_strength = asymmetry_values,
    length_decay = length_decay_values,
    radius_decay = radius_decay_values,
    stringsAsFactors = FALSE
  )

  rows <- vector("list", nrow(combos) * n_rep)
  idx <- 1L
  for (i in seq_len(nrow(combos))) {
    cmb <- combos[i, , drop = FALSE]
    for (r in seq_len(n_rep)) {
      updates <- list(
        path_fraction = cmb$path_fraction,
        asymmetry_strength = cmb$asymmetry_strength,
        length_decay = cmb$length_decay,
        radius_decay = cmb$radius_decay
      )
      if (!is.null(base_params$seed)) {
        updates$seed <- base_params$seed + (i * 100000L) + r
      }
      p <- update_spa_params(base_params, updates)
      tr <- simulate_branching_tree(p)
      met <- compute_scaling_metrics(tr)
      met$path_fraction_setting <- cmb$path_fraction
      met$asymmetry_setting <- cmb$asymmetry_strength
      met$length_decay_setting <- cmb$length_decay
      met$radius_decay_setting <- cmb$radius_decay
      met$replicate <- r
      rows[[idx]] <- met
      idx <- idx + 1L
    }
  }

  metrics <- dplyr::bind_rows(rows)
  metrics <- do.call(compute_mechanistic_tradeoff, c(list(metrics_df = metrics), tradeoff_cfg))

  summary_tbl <- metrics |>
    dplyr::group_by(path_fraction_setting, asymmetry_setting, length_decay_setting, radius_decay_setting) |>
    dplyr::summarise(
      n_rep = dplyr::n(),
      mean_M_proxy = mean(M_proxy, na.rm = TRUE),
      mean_n_tips = mean(n_tips, na.rm = TRUE),
      mean_path_length = mean(mean_path_length, na.rm = TRUE),
      mean_phi_K = mean(phi_K, na.rm = TRUE),
      mean_phi_Psi = mean(phi_Psi, na.rm = TRUE),
      mean_phi_B = mean(phi_B, na.rm = TRUE),
      mean_R_eff = mean(R_eff, na.rm = TRUE),
      sd_R_eff = stats::sd(R_eff, na.rm = TRUE),
      .groups = "drop"
    )

  list(metrics = metrics, surface = summary_tbl)
}

compute_tradeoff_frontier <- function(
  surface_tbl,
  maximize_cols = c("mean_phi_K", "mean_phi_B", "mean_R_eff"),
  minimize_cols = c("mean_path_length")
) {
  dat <- dplyr::as_tibble(surface_tbl)
  for (nm in c(maximize_cols, minimize_cols)) {
    if (!nm %in% names(dat)) stop("Column not found in surface_tbl: ", nm)
  }

  n <- nrow(dat)
  if (n == 0) return(dat)

  dominated <- rep(FALSE, n)
  for (i in seq_len(n)) {
    if (dominated[i]) next
    for (j in seq_len(n)) {
      if (i == j) next
      better_or_equal_max <- all(dat[j, maximize_cols, drop = TRUE] >= dat[i, maximize_cols, drop = TRUE])
      better_or_equal_min <- all(dat[j, minimize_cols, drop = TRUE] <= dat[i, minimize_cols, drop = TRUE])
      strictly_better <-
        any(dat[j, maximize_cols, drop = TRUE] > dat[i, maximize_cols, drop = TRUE]) ||
        any(dat[j, minimize_cols, drop = TRUE] < dat[i, minimize_cols, drop = TRUE])
      if (better_or_equal_max && better_or_equal_min && strictly_better) {
        dominated[i] <- TRUE
        break
      }
    }
  }

  dat$is_frontier <- !dominated
  frontier <- dat |>
    dplyr::filter(is_frontier) |>
    dplyr::arrange(dplyr::desc(mean_R_eff), mean_path_length)
  frontier$frontier_rank <- seq_len(nrow(frontier))

  list(surface = dat, frontier = frontier)
}

plot_tradeoff_surface <- function(surface_tbl, preset = c("publication", "lecture")) {
  tokens <- spa_plot_tokens(match.arg(preset))
  ggplot2::ggplot(
    surface_tbl,
    ggplot2::aes(x = mean_path_length, y = mean_n_tips / pmax(mean_M_proxy, 1e-9), color = mean_R_eff)
  ) +
    ggplot2::geom_point(size = 2.2, alpha = 0.9) +
    ggplot2::scale_color_viridis_c(option = "D", end = 0.9) +
    ggplot2::labs(
      x = "Mean path length (transport burden)",
      y = "Terminal deployment per biomass",
      color = "Mean R_eff",
      title = "Mechanistic trade-off surface"
    ) +
    spa_theme_figure(tokens = tokens, show_grid = TRUE)
}

run_tradeoff_surface_experiment <- function(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.0),
  asymmetry_values = c(0.25, 0.5, 0.75),
  length_decay_values = NULL,
  radius_decay_values = NULL,
  n_rep = 20,
  base_params = new_spa_params(seed = NULL),
  tradeoff_cfg = list()
) {
  out <- compute_tradeoff_surface(
    path_fraction_values = path_fraction_values,
    asymmetry_values = asymmetry_values,
    length_decay_values = length_decay_values,
    radius_decay_values = radius_decay_values,
    n_rep = n_rep,
    base_params = base_params,
    tradeoff_cfg = tradeoff_cfg
  )

  fr <- compute_tradeoff_frontier(out$surface)
  list(metrics = out$metrics, surface = fr$surface, frontier = fr$frontier)
}

.fit_loglog_slope <- function(x, y) {
  ok <- is.finite(x) & is.finite(y) & x > 0 & y > 0
  if (sum(ok) < 2) {
    return(NULL)
  }

  dat <- data.frame(lx = log10(x[ok]), ly = log10(y[ok]))
  if (stats::var(dat$lx) <= 1e-12) {
    return(NULL)
  }

  fit <- stats::lm(ly ~ lx, data = dat)
  y_hat <- stats::fitted(fit)
  y <- dat$ly
  sse <- sum((y - y_hat)^2)
  sst <- sum((y - mean(y))^2)
  rsq <- if (sst > 0) 1 - sse / sst else 1
  list(
    slope = unname(stats::coef(fit)[["lx"]]),
    intercept = unname(stats::coef(fit)[["(Intercept)"]]),
    r2 = ifelse(is.finite(rsq), rsq, NA_real_),
    n = nrow(dat)
  )
}

.theta_from_decays <- function(length_decay, radius_decay, branching_ratio = 2) {
  if (!is.finite(length_decay) || !is.finite(radius_decay) || !is.finite(branching_ratio)) {
    return(NA_real_)
  }
  if (length_decay <= 0 || radius_decay <= 0 || branching_ratio <= 1) {
    return(NA_real_)
  }

  a <- -log(radius_decay) / log(branching_ratio)
  b <- -log(length_decay) / log(branching_ratio)
  denom <- 2 * a + b
  if (!is.finite(denom) || denom <= 0) {
    return(NA_real_)
  }
  1 / denom
}

compute_theta_scaling_surface <- function(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.0),
  asymmetry_values = c(0.25, 0.5, 0.75),
  length_decay_values = NULL,
  radius_decay_values = NULL,
  n_rep = 20,
  base_params = new_spa_params(seed = NULL)
) {
  if (!inherits(base_params, "spa_params")) {
    stop("base_params must be created with new_spa_params()")
  }
  if (!is.numeric(path_fraction_values) || length(path_fraction_values) == 0 || any(!is.finite(path_fraction_values))) {
    stop("path_fraction_values must be a non-empty numeric vector")
  }
  if (!is.numeric(asymmetry_values) || length(asymmetry_values) == 0 || any(!is.finite(asymmetry_values))) {
    stop("asymmetry_values must be a non-empty numeric vector")
  }
  if (any(path_fraction_values < 0 | path_fraction_values > 1)) {
    stop("path_fraction_values must be in [0, 1]")
  }
  if (any(asymmetry_values < 0 | asymmetry_values > 1)) {
    stop("asymmetry_values must be in [0, 1]")
  }
  if (!is.numeric(n_rep) || length(n_rep) != 1 || n_rep < 2 || n_rep != as.integer(n_rep)) {
    stop("n_rep must be an integer >= 2")
  }

  length_decay_values <- length_decay_values %||% base_params$length_decay
  radius_decay_values <- radius_decay_values %||% base_params$radius_decay

  if (any(length_decay_values <= 0 | length_decay_values >= 1)) {
    stop("length_decay_values must be within (0, 1)")
  }
  if (any(radius_decay_values <= 0 | radius_decay_values >= 1)) {
    stop("radius_decay_values must be within (0, 1)")
  }

  combos <- expand.grid(
    path_fraction = path_fraction_values,
    asymmetry_strength = asymmetry_values,
    length_decay = length_decay_values,
    radius_decay = radius_decay_values,
    stringsAsFactors = FALSE
  )

  metrics_rows <- vector("list", nrow(combos) * n_rep)
  out_rows <- vector("list", nrow(combos))
  metrics_idx <- 1L

  for (i in seq_len(nrow(combos))) {
    cmb <- combos[i, , drop = FALSE]
    per_combo <- vector("list", n_rep)

    for (r in seq_len(n_rep)) {
      updates <- list(
        path_fraction = cmb$path_fraction,
        asymmetry_strength = cmb$asymmetry_strength,
        length_decay = cmb$length_decay,
        radius_decay = cmb$radius_decay
      )
      if (!is.null(base_params$seed)) {
        updates$seed <- base_params$seed + (i * 100000L) + r
      }

      p <- update_spa_params(base_params, updates)
      tr <- simulate_branching_tree(p)
      met <- compute_scaling_metrics(tr)
      met$path_fraction_setting <- cmb$path_fraction
      met$asymmetry_setting <- cmb$asymmetry_strength
      met$length_decay_setting <- cmb$length_decay
      met$radius_decay_setting <- cmb$radius_decay
      met$replicate <- r
      metrics_rows[[metrics_idx]] <- met
      per_combo[[r]] <- met
      metrics_idx <- metrics_idx + 1L
    }

    combo_tbl <- dplyr::bind_rows(per_combo)
    path_fit <- .fit_loglog_slope(combo_tbl$M_proxy, combo_tbl$mean_path_length)
    leaf_fit <- .fit_loglog_slope(combo_tbl$M_proxy, combo_tbl$n_tips)

    out_rows[[i]] <- dplyr::tibble(
      path_fraction_setting = cmb$path_fraction,
      asymmetry_setting = cmb$asymmetry_strength,
      length_decay_setting = cmb$length_decay,
      radius_decay_setting = cmb$radius_decay,
      theta_theory = .theta_from_decays(cmb$length_decay, cmb$radius_decay),
      lambda_path = if (is.null(path_fit)) NA_real_ else path_fit$slope,
      alpha_leaf = if (is.null(leaf_fit)) NA_real_ else leaf_fit$slope,
      path_r2 = if (is.null(path_fit)) NA_real_ else path_fit$r2,
      leaf_r2 = if (is.null(leaf_fit)) NA_real_ else leaf_fit$r2,
      n_obs = nrow(combo_tbl),
      mean_M_proxy = mean(combo_tbl$M_proxy, na.rm = TRUE),
      mean_n_tips = mean(combo_tbl$n_tips, na.rm = TRUE),
      mean_path_length = mean(combo_tbl$mean_path_length, na.rm = TRUE)
    )
  }

  list(
    metrics = dplyr::bind_rows(metrics_rows),
    surface = dplyr::bind_rows(out_rows)
  )
}

plot_theta_scaling_surface <- function(
  surface_tbl,
  response = c("lambda_path", "alpha_leaf"),
  preset = c("publication", "lecture")
) {
  response <- match.arg(response)
  tokens <- spa_plot_tokens(match.arg(preset))

  y_label <- if (response == "lambda_path") {
    "Path-length exponent (L ~ M^lambda)"
  } else {
    "Leaf deployment exponent (N_leaf ~ M^alpha)"
  }

  ggplot2::ggplot(
    surface_tbl,
    ggplot2::aes_string(x = "theta_theory", y = response, color = "path_fraction_setting")
  ) +
    ggplot2::geom_point(size = 2.2, alpha = 0.9) +
    ggplot2::geom_smooth(method = "lm", se = FALSE, linewidth = 0.8, color = "#3e5058") +
    ggplot2::scale_color_viridis_c(option = "C", end = 0.92) +
    ggplot2::labs(
      x = "Theta (shallow to steep)",
      y = y_label,
      color = "Path fraction",
      title = "Theta-centered architecture response"
    ) +
    spa_theme_figure(tokens = tokens, show_grid = TRUE)
}

run_theta_scaling_experiment <- function(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.0),
  asymmetry_values = c(0.25, 0.5, 0.75),
  length_decay_values = NULL,
  radius_decay_values = NULL,
  n_rep = 20,
  base_params = new_spa_params(seed = NULL)
) {
  compute_theta_scaling_surface(
    path_fraction_values = path_fraction_values,
    asymmetry_values = asymmetry_values,
    length_decay_values = length_decay_values,
    radius_decay_values = radius_decay_values,
    n_rep = n_rep,
    base_params = base_params
  )
}