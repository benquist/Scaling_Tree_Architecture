spa_plot_tokens <- function(preset = c("publication", "lecture")) {
  preset <- match.arg(preset)

  if (preset == "publication") {
    return(list(
      preset = preset,
      base_family = "sans",
      base_size = 10,
      title_size = 11,
      subtitle_size = 9,
      axis_title_size = 9,
      axis_text_size = 8,
      strip_size = 9,
      margin = ggplot2::margin(8, 10, 8, 10),
      panel_spacing = grid::unit(0.22, "in"),
      linewidth_range = c(0.12, 1.1),
      point_size = 1.9,
      fit_linewidth = 0.9,
      root_size = 1.6
    ))
  }

  list(
    preset = preset,
    base_family = "sans",
    base_size = 16,
    title_size = 18,
    subtitle_size = 14,
    axis_title_size = 14,
    axis_text_size = 12,
    strip_size = 13,
    margin = ggplot2::margin(14, 16, 14, 16),
    panel_spacing = grid::unit(0.35, "in"),
    linewidth_range = c(0.25, 2.2),
    point_size = 2.8,
    fit_linewidth = 1.4,
    root_size = 2.4
  )
}

spa_palette <- function() {
  list(
    bg_canvas = "#F6F7F5",
    bg_panel = "#FFFFFF",
    ink = "#1F252A",
    ink_secondary = "#5A6B75",
    grid_major = "#D8DEE3",
    grid_minor = "#ECEFF2",
    accent_data = "#0D6E6E",
    accent_warm = "#B85C38",
    order_low = "#88979C",
    order_high = "#1F252A"
  )
}

spa_theme_figure <- function(tokens = spa_plot_tokens(), show_grid = FALSE) {
  pal <- spa_palette()

  if (show_grid) {
    return(
      ggplot2::theme_minimal(base_size = tokens$base_size, base_family = tokens$base_family) +
        ggplot2::theme(
          plot.background = ggplot2::element_rect(fill = pal$bg_canvas, color = NA),
          panel.background = ggplot2::element_rect(fill = pal$bg_panel, color = NA),
          plot.title = ggplot2::element_text(size = tokens$title_size, face = "bold", color = pal$ink),
          plot.subtitle = ggplot2::element_text(size = tokens$subtitle_size, color = pal$ink_secondary),
          axis.title = ggplot2::element_text(size = tokens$axis_title_size, color = pal$ink),
          axis.text = ggplot2::element_text(size = tokens$axis_text_size, color = pal$ink_secondary),
          strip.text = ggplot2::element_text(size = tokens$strip_size, face = "bold", color = pal$ink),
          panel.grid.major = ggplot2::element_line(color = pal$grid_major, linewidth = 0.3),
          panel.grid.minor = ggplot2::element_line(color = pal$grid_minor, linewidth = 0.2),
          panel.spacing = tokens$panel_spacing,
          plot.margin = tokens$margin
        )
    )
  }

  ggplot2::theme_void(base_size = tokens$base_size, base_family = tokens$base_family) +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = pal$bg_canvas, color = NA),
      panel.background = ggplot2::element_rect(fill = pal$bg_panel, color = NA),
      strip.text = ggplot2::element_text(size = tokens$strip_size, face = "bold", color = pal$ink),
      panel.spacing = tokens$panel_spacing,
      plot.margin = tokens$margin
    )
}

spa_tree_segments <- function(tree) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  seg <- dplyr::left_join(tree$edges, tree$nodes, by = c("from" = "node_id"))
  seg <- dplyr::rename(seg, x = x, y = y)
  seg <- dplyr::left_join(seg, tree$nodes, by = c("to" = "node_id"), suffix = c("", "_end"))
  seg
}

plot_tree <- function(
  tree,
  linewidth_range = NULL,
  preset = c("publication", "lecture"),
  highlight_main_path = FALSE,
  show_order_tone = TRUE,
  title = NULL,
  subtitle = NULL
) {
  tokens <- spa_plot_tokens(match.arg(preset))
  pal <- spa_palette()
  seg <- spa_tree_segments(tree)

  lw_range <- if (is.null(linewidth_range)) tokens$linewidth_range else linewidth_range
  seg$stroke_col <- if (show_order_tone) {
    dplyr::if_else(seg$is_main, pal$order_high, pal$order_low)
  } else {
    pal$ink
  }
  if (highlight_main_path) {
    seg$stroke_col <- dplyr::if_else(seg$is_main, pal$accent_data, pal$order_low)
  }

  p <- ggplot2::ggplot(seg) +
    ggplot2::geom_segment(
      ggplot2::aes(x = x, y = y, xend = x_end, yend = y_end, linewidth = sqrt(radius), color = stroke_col),
      lineend = "round",
      alpha = 0.96,
      show.legend = FALSE
    ) +
    ggplot2::geom_point(
      data = data.frame(x = 0, y = 0),
      ggplot2::aes(x = x, y = y),
      inherit.aes = FALSE,
      color = pal$ink_secondary,
      size = tokens$root_size
    ) +
    ggplot2::scale_color_identity() +
    ggplot2::scale_linewidth_continuous(range = lw_range, guide = "none") +
    ggplot2::coord_equal() +
    spa_theme_figure(tokens = tokens, show_grid = FALSE)

  if (!is.null(title) || !is.null(subtitle)) {
    p <- p + ggplot2::labs(title = title, subtitle = subtitle)
  }

  p
}

plot_smith_tree_panel <- function(
  path_fractions = c(0.3, 0.5, 0.7, 1.0),
  base_params = new_spa_params(seed = NULL),
  preset = c("publication", "lecture"),
  nrow = 1,
  highlight_main_path = FALSE,
  show_order_tone = TRUE
) {
  if (!inherits(base_params, "spa_params")) {
    stop("base_params must be created with new_spa_params()")
  }
  if (!is.numeric(path_fractions) || length(path_fractions) == 0 || any(!is.finite(path_fractions))) {
    stop("path_fractions must be a non-empty numeric vector of finite values")
  }
  if (any(path_fractions < 0 | path_fractions > 1)) {
    stop("path_fractions must all be in [0, 1]")
  }

  tokens <- spa_plot_tokens(match.arg(preset))
  pal <- spa_palette()
  all_seg <- vector("list", length(path_fractions))

  for (i in seq_along(path_fractions)) {
    pf <- path_fractions[i]
    updates <- list(path_fraction = pf)
    updates$seed <- if (is.null(base_params$seed)) i else base_params$seed + i
    p <- update_spa_params(base_params, updates)

    tr <- simulate_branching_tree(p)
    seg <- spa_tree_segments(tr)
    seg$path_fraction <- sprintf("P_f = %.2f", pf)
    seg$stroke_col <- if (show_order_tone) {
      dplyr::if_else(seg$is_main, pal$order_high, pal$order_low)
    } else {
      pal$ink
    }
    if (highlight_main_path) {
      seg$stroke_col <- dplyr::if_else(seg$is_main, pal$accent_data, pal$order_low)
    }
    all_seg[[i]] <- seg
  }

  dat <- dplyr::bind_rows(all_seg)

  ggplot2::ggplot(dat) +
    ggplot2::geom_vline(xintercept = 0, color = pal$grid_major, linewidth = 0.25) +
    ggplot2::geom_segment(
      ggplot2::aes(x = x, y = y, xend = x_end, yend = y_end, linewidth = sqrt(radius), color = stroke_col),
      lineend = "round",
      alpha = 0.97,
      show.legend = FALSE
    ) +
    ggplot2::scale_color_identity() +
    ggplot2::facet_wrap(~path_fraction, nrow = nrow) +
    ggplot2::scale_linewidth_continuous(range = tokens$linewidth_range, guide = "none") +
    ggplot2::coord_equal() +
    spa_theme_figure(tokens = tokens, show_grid = FALSE)
}

plot_pathfraction_scaling <- function(
  metrics_df,
  preset = c("publication", "lecture"),
  show_ci = TRUE
) {
  tokens <- spa_plot_tokens(match.arg(preset))
  pal <- spa_palette()

  ggplot2::ggplot(metrics_df, ggplot2::aes(x = path_fraction_realized, y = aspect_ratio)) +
    ggplot2::geom_point(alpha = 0.38, color = pal$ink_secondary, size = tokens$point_size) +
    ggplot2::geom_smooth(
      method = "lm",
      se = show_ci,
      color = pal$accent_data,
      fill = pal$accent_data,
      alpha = if (show_ci) 0.12 else 0,
      linewidth = tokens$fit_linewidth
    ) +
    ggplot2::labs(
      x = "Path fraction (realized main-path fraction)",
      y = "Aspect ratio (height / width)",
      title = "Path fraction controls crown shape",
      subtitle = "Points are simulations; line is linear model fit"
    ) +
    spa_theme_figure(tokens = tokens, show_grid = TRUE) +
    ggplot2::theme(panel.grid.minor = ggplot2::element_blank())
}

plot_tree_allometries <- function(
  tree,
  preset = c("publication", "lecture"),
  show_ci = TRUE
) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  tokens <- spa_plot_tokens(match.arg(preset))
  pal <- spa_palette()
  allom <- compute_tree_allometries(tree)$tip_allometries

  if (nrow(allom) == 0) {
    stop("tree has no terminal paths to plot allometries")
  }

  rel_leaf_stem <- dplyr::transmute(
    allom,
    relationship = "Leaf area vs Stem volume to tip",
    x = stem_volume_to_tip,
    y = leaf_area_proxy,
    x_lab = "Stem volume to tip (proxy)",
    y_lab = "Leaf area (proxy)"
  )

  rel_leaf_pf <- dplyr::transmute(
    allom,
    relationship = "Leaf area vs Path fraction",
    x = pmax(path_fraction, 1e-8),
    y = leaf_area_proxy,
    x_lab = "Path fraction",
    y_lab = "Leaf area (proxy)"
  )

  rel_stem_path <- dplyr::transmute(
    allom,
    relationship = "Stem volume to tip vs Path length",
    x = path_length,
    y = stem_volume_to_tip,
    x_lab = "Path length",
    y_lab = "Stem volume to tip (proxy)"
  )

  dat <- dplyr::bind_rows(rel_leaf_stem, rel_leaf_pf, rel_stem_path)

  ggplot2::ggplot(dat, ggplot2::aes(x = x, y = y)) +
    ggplot2::geom_point(alpha = 0.42, color = pal$ink_secondary, size = tokens$point_size) +
    ggplot2::geom_smooth(
      method = "lm",
      se = show_ci,
      color = pal$accent_data,
      fill = pal$accent_data,
      alpha = if (show_ci) 0.12 else 0,
      linewidth = tokens$fit_linewidth
    ) +
    ggplot2::facet_wrap(~relationship, scales = "free") +
    ggplot2::labs(
      x = "",
      y = "",
      title = "Per-tree allometric relationships",
      subtitle = "Allometries computed from trunk-to-tip paths"
    ) +
    spa_theme_figure(tokens = tokens, show_grid = TRUE) +
    ggplot2::theme(panel.grid.minor = ggplot2::element_blank())
}

plot_path_length_distribution <- function(
  tree,
  endpoint = c("tips", "all_nodes"),
  bins = 24,
  preset = c("publication", "lecture")
) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")
  endpoint <- match.arg(endpoint)
  tokens <- spa_plot_tokens(match.arg(preset))
  pal <- spa_palette()

  if (!is.numeric(bins) || length(bins) != 1 || !is.finite(bins) || bins < 1 || bins != as.integer(bins)) {
    stop("bins must be an integer >= 1")
  }
  bins <- as.integer(bins)

  if (endpoint == "tips") {
    path_tbl <- compute_path_metrics(tree)$paths
    dat <- tibble::tibble(path_length = path_tbl$path_length)
    subtitle <- "Distribution of trunk-to-tip path lengths"
  } else {
    node_tbl <- compute_node_path_lengths(tree)
    dat <- tibble::tibble(path_length = node_tbl$path_length)
    subtitle <- "Distribution of trunk-to-node path lengths"
  }

  if (nrow(dat) == 0) {
    stop("tree has no path lengths to plot")
  }

  ggplot2::ggplot(dat, ggplot2::aes(x = path_length)) +
    ggplot2::geom_histogram(
      bins = bins,
      color = pal$ink,
      fill = pal$accent_data,
      alpha = 0.7,
      linewidth = 0.25
    ) +
    ggplot2::labs(
      x = "Path length",
      y = "Frequency",
      title = "Path-length frequency distribution",
      subtitle = subtitle
    ) +
    spa_theme_figure(tokens = tokens, show_grid = TRUE) +
    ggplot2::theme(panel.grid.minor = ggplot2::element_blank())
}

plot_tree_teaching_dashboard <- function(
  tree,
  preset = c("publication", "lecture"),
  bins = 24,
  endpoint = c("tips", "all_nodes"),
  show_ci = TRUE,
  draw = TRUE
) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")
  preset <- match.arg(preset)
  endpoint <- match.arg(endpoint)

  p_tree <- plot_tree(
    tree,
    preset = preset,
    highlight_main_path = TRUE,
    title = "Branching architecture",
    subtitle = "Single trunk base with asymmetric furcation above"
  )

  p_allom <- plot_tree_allometries(tree, preset = preset, show_ci = show_ci)
  p_hist <- plot_path_length_distribution(tree, endpoint = endpoint, bins = bins, preset = preset)

  if (draw) {
    grid::grid.newpage()
    lay <- grid::grid.layout(
      nrow = 2,
      ncol = 2,
      heights = grid::unit(c(1.05, 1), "null"),
      widths = grid::unit(c(1, 1), "null")
    )
    vp <- grid::viewport(layout = lay)
    grid::pushViewport(vp)

    print(p_tree, vp = grid::viewport(layout.pos.row = 1, layout.pos.col = 1:2))
    print(p_allom, vp = grid::viewport(layout.pos.row = 2, layout.pos.col = 1))
    print(p_hist, vp = grid::viewport(layout.pos.row = 2, layout.pos.col = 2))

    grid::upViewport()
  }

  invisible(list(
    tree_plot = p_tree,
    allometry_plot = p_allom,
    path_length_plot = p_hist
  ))
}
