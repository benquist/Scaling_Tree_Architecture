compute_wbe_metrics <- function(tree) {
  if (!inherits(tree, "wbe_tree")) stop("tree must be from simulate_wbe_tree()")

  edges <- tree$edges
  if (nrow(edges) == 0) {
    return(tibble::tibble(
      n_edges = 0L,
      n_tips = 0L,
      max_order_realized = 0L,
      stem_volume_total = NA_real_,
      mean_path_length = NA_real_,
      max_path_length = NA_real_,
      M_proxy = NA_real_,
      K_proxy = NA_real_
    ))
  }

  children <- split(edges, edges$from)
  child_nodes <- unique(edges$to)
  parent_nodes <- unique(edges$from)
  tip_nodes <- setdiff(child_nodes, parent_nodes)

  walk <- function(node, path_len = 0, path_res = 0) {
    key <- as.character(node)
    if (!key %in% names(children)) {
      return(list(tibble::tibble(tip_node = node, path_length = path_len, path_resistance = path_res)))
    }

    out <- list()
    for (i in seq_len(nrow(children[[key]]))) {
      e <- children[[key]][i, ]
      out <- c(out, walk(e$to, path_len + e$length, path_res + e$length / (e$radius^4)))
    }
    out
  }

  path_tbl <- dplyr::bind_rows(walk(1L))
  edge_tbl <- edges
  edge_tbl$stem_volume <- pi * edge_tbl$radius^2 * edge_tbl$length
  edge_tbl$conductance_proxy <- edge_tbl$radius^4 / edge_tbl$length

  tibble::tibble(
    n_edges = nrow(edges),
    n_tips = length(tip_nodes),
    max_order_realized = max(edges$order),
    stem_volume_total = sum(edge_tbl$stem_volume),
    mean_path_length = mean(path_tbl$path_length),
    max_path_length = max(path_tbl$path_length),
    M_proxy = sum(edge_tbl$stem_volume),
    K_proxy = sum(edge_tbl$conductance_proxy)
  )
}

theoretical_mass_conductance_exponent <- function(furcation_ratio, length_ratio, radius_ratio) {
  n <- furcation_ratio
  a <- length_ratio
  b <- radius_ratio

  # Note: Allowing a > 1 and b > 1 for theoretical exploration, even though
  # realistic plants have a ≈ 0.79–0.85 and b ≈ 0.65–0.75.
  # WBE target mode intentionally uses a=1.30, b=0.984 to achieve 3/4 scaling.
  if (n <= 1 || a <= 0 || b <= 0) {
    return(NA_real_)
  }

  mass_base <- n * a * (b^2)
  # Conductance multiplier: κ = n*b^4/a (no conditional logic)
  cond_base <- n * (b^4) / a

  if (mass_base <= 0 || cond_base <= 0 || abs(log(mass_base)) < 1e-12) {
    return(NA_real_)
  }

  # Regime checking (matches JS implementation)
  if (mass_base > 1 && cond_base > 1) {
    return(log(cond_base) / log(mass_base))
  }
  if (mass_base > 1 && cond_base <= 1) {
    return(0)  # K-saturation regime: conductance plateaus
  }
  return(NA_real_)  # M-saturation: no stable scaling
}

run_wbe_scaling_diagnostic <- function(
  order_values = 5:12,
  n_rep = 20,
  base_params = NULL
) {
  if (is.null(base_params)) {
    base_params <- get("new_wbe_params", mode = "function", inherits = TRUE)(seed = NULL)
  }
  if (!inherits(base_params, "wbe_params")) {
    stop("base_params must be created with new_wbe_params()")
  }

  rows <- vector("list", length(order_values) * n_rep)
  idx <- 1L

  for (ord in order_values) {
    for (rep_id in seq_len(n_rep)) {
      updates <- list(max_order = as.integer(ord))
      if (!is.null(base_params$seed)) {
        updates$seed <- base_params$seed + ord * 10000L + rep_id
      }
      p <- get("update_wbe_params", mode = "function", inherits = TRUE)(base_params, updates)
      tr <- get("simulate_wbe_tree", mode = "function", inherits = TRUE)(p)
      met <- compute_wbe_metrics(tr)
      met$order_target <- ord
      met$replicate <- rep_id
      rows[[idx]] <- met
      idx <- idx + 1L
    }
  }

  metrics <- dplyr::bind_rows(rows)

  fit <- estimate_scaling_exponent(metrics, x = "M_proxy", y = "K_proxy")
  theo <- theoretical_mass_conductance_exponent(
    furcation_ratio = base_params$furcation_ratio,
    length_ratio = base_params$length_ratio,
    radius_ratio = base_params$radius_ratio
  )

  list(
    metrics = metrics,
    fit = fit,
    theoretical_exponent = theo,
    delta_fit_minus_theory = fit$estimate - theo
  )
}

estimate_scaling_exponent <- function(df, x = "M_proxy", y = "K_proxy") {
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

theoretical_leaves_exponents <- function(furcation_ratio, length_ratio, radius_ratio) {
  n <- furcation_ratio
  a <- length_ratio
  b <- radius_ratio

  if (n <= 1 || a <= 0 || b <= 0) {
    return(list(betaNvsM = NA_real_, betaNvsDeq = NA_real_))
  }

  mu <- n * a * (b^2)
  delta <- n * (b^2)

  betaNvsM <- if (mu > 1 && abs(log(mu)) > 1e-12) {
    log(n) / log(mu)
  } else {
    NA_real_
  }

  betaNvsDeq <- if (delta > 0 && abs(log(delta)) > 1e-12) {
    2 * log(n) / log(delta)
  } else {
    NA_real_
  }

  list(betaNvsM = betaNvsM, betaNvsDeq = betaNvsDeq)
}

estimate_asymptotic_slope <- function(metrics_with_order, order_values = NULL, use_log = TRUE) {
  if (!use_log) {
    return(list(
      asymptotic_slope = NA_real_,
      finite_size_bias = NA_real_,
      fit_r2 = NA_real_,
      series = tibble::tibble()
    ))
  }

  if (!is.data.frame(metrics_with_order)) {
    stop("metrics_with_order must be a data.frame with 'order' column")
  }

  if (!"order" %in% names(metrics_with_order)) {
    stop("metrics_with_order must contain an 'order' column")
  }

  if (is.null(order_values)) {
    order_values <- sort(unique(metrics_with_order$order))
  }

  sorted_orders <- sort(unique(order_values))
  min_cut <- max(6, sorted_orders[ceiling(length(sorted_orders) / 3)])
  cutoffs <- sorted_orders[sorted_orders >= min_cut]

  if (length(cutoffs) < 3) {
    return(list(
      asymptotic_slope = NA_real_,
      finite_size_bias = NA_real_,
      fit_r2 = NA_real_,
      series = tibble::tibble()
    ))
  }

  slope_from_order_means <- function(m_cutoff) {
    subset <- metrics_with_order %>%
      dplyr::filter(order <= m_cutoff, M_proxy > 0, K_proxy > 0)

    if (nrow(subset) < 6) return(NA_real_)

    order_means <- subset %>%
      dplyr::mutate(
        log_m = log(M_proxy),
        log_k = log(K_proxy)
      ) %>%
      dplyr::group_by(order) %>%
      dplyr::summarise(
        log_m_mean = mean(log_m),
        log_k_mean = mean(log_k),
        .groups = "drop"
      )

    if (nrow(order_means) < 3) return(NA_real_)

    fit <- stats::lm(log_k_mean ~ log_m_mean, data = order_means)
    coef(fit)[2]
  }

  slope_series <- tibble::tibble(
    cutoff_order = cutoffs,
    beta_m = NA_real_,
    inv_m = 1 / cutoffs
  )

  for (i in seq_along(cutoffs)) {
    slope_series$beta_m[i] <- slope_from_order_means(cutoffs[i])
  }

  slope_series <- slope_series %>%
    dplyr::filter(is.finite(beta_m))

  if (nrow(slope_series) < 3) {
    return(list(
      asymptotic_slope = NA_real_,
      finite_size_bias = NA_real_,
      fit_r2 = NA_real_,
      series = slope_series
    ))
  }

  fit <- stats::lm(beta_m ~ inv_m, data = slope_series)
  asymptotic_slope <- coef(fit)[1]
  fit_r2 <- summary(fit)$r.squared
  largest_m <- max(slope_series$cutoff_order)
  beta_largest <- slope_series$beta_m[slope_series$cutoff_order == largest_m][1]
  finite_size_bias <- if (is.finite(beta_largest)) {
    beta_largest - asymptotic_slope
  } else {
    NA_real_
  }

  list(
    asymptotic_slope = asymptotic_slope,
    finite_size_bias = finite_size_bias,
    fit_r2 = fit_r2,
    series = slope_series
  )
}
