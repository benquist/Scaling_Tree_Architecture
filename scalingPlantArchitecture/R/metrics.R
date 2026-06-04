compute_path_metrics <- function(tree) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  edges <- tree$edges
  if (nrow(edges) == 0) {
    out <- list(paths = tibble::tibble(), summary = list(mean_path_length = NA_real_, mean_resistance = NA_real_, realized_path_fraction = NA_real_))
    return(out)
  }

  children <- split(edges, edges$from)
  child_nodes <- unique(edges$to)
  parent_nodes <- unique(edges$from)
  tip_nodes <- setdiff(child_nodes, parent_nodes)

  traverse <- function(node, path_len = 0, path_res = 0, path_stem_volume = 0, n_main = 0, n_seg = 0) {
    key <- as.character(node)
    if (!key %in% names(children)) {
      return(list(tibble::tibble(
        tip_node = node,
        path_length = path_len,
        path_resistance = path_res,
        path_stem_volume = path_stem_volume,
        main_fraction = if (n_seg == 0) NA_real_ else n_main / n_seg,
        n_segments = n_seg
      )))
    }

    out <- list()
    for (i in seq_len(nrow(children[[key]]))) {
      e <- children[[key]][i, ]
      next_len <- path_len + e$length
      next_res <- path_res + e$length / (e$radius^4)
      next_path_stem_volume <- path_stem_volume + pi * e$radius^2 * e$length
      next_main <- n_main + as.integer(e$is_main)
      out <- c(out, traverse(e$to, next_len, next_res, next_path_stem_volume, next_main, n_seg + 1L))
    }
    out
  }

  path_tbl <- dplyr::bind_rows(traverse(1L))
  max_path <- max(path_tbl$path_length)
  path_tbl <- dplyr::mutate(path_tbl, path_length_fraction = path_length / max_path)

  realized_main_fraction <- mean(path_tbl$main_fraction, na.rm = TRUE)
  realized_length_fraction <- mean(path_tbl$path_length_fraction, na.rm = TRUE)

  list(
    paths = path_tbl,
    summary = list(
      mean_path_length = mean(path_tbl$path_length),
      mean_resistance = mean(path_tbl$path_resistance),
      mean_path_stem_volume = mean(path_tbl$path_stem_volume),
      realized_path_fraction = realized_main_fraction,
      realized_path_fraction_main = realized_main_fraction,
      realized_path_fraction_length = realized_length_fraction,
      n_tips = length(tip_nodes)
    )
  )
}

compute_tree_allometries <- function(tree, leaf_area_scale = 1) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")
  if (!is.numeric(leaf_area_scale) || length(leaf_area_scale) != 1 || !is.finite(leaf_area_scale) || leaf_area_scale <= 0) {
    stop("leaf_area_scale must be a positive finite scalar")
  }

  edges <- tree$edges
  if (nrow(edges) == 0) {
    return(list(
      edge_allometries = tibble::tibble(),
      tip_allometries = tibble::tibble(),
      summary = tibble::tibble(
        stem_volume_total = NA_real_,
        leaf_area_total = NA_real_,
        mean_path_length = NA_real_,
        mean_path_fraction = NA_real_,
        n_tips = 0L
      )
    ))
  }

  children <- split(edges$to, edges$from)
  child_nodes <- unique(edges$to)
  parent_nodes <- unique(edges$from)
  tip_nodes <- setdiff(child_nodes, parent_nodes)

  edge_tbl <- dplyr::mutate(
    edges,
    stem_volume = pi * radius^2 * length,
    is_terminal_edge = to %in% tip_nodes,
    leaf_area_proxy = ifelse(is_terminal_edge, leaf_area_scale * pi * radius^2, 0)
  )

  path <- compute_path_metrics(tree)

  tip_edges <- dplyr::filter(edge_tbl, is_terminal_edge) |>
    dplyr::select(tip_node = to, terminal_radius = radius, terminal_edge_length = length)

  tip_tbl <- dplyr::left_join(path$paths, tip_edges, by = "tip_node") |>
    dplyr::mutate(
      path_fraction = path_length_fraction,
      leaf_area_proxy = leaf_area_scale * pi * terminal_radius^2,
      stem_volume_to_tip = path_stem_volume
    )

  summary_tbl <- tibble::tibble(
    stem_volume_total = sum(edge_tbl$stem_volume),
    leaf_area_total = sum(edge_tbl$leaf_area_proxy),
    mean_path_length = mean(tip_tbl$path_length),
    mean_path_fraction = mean(tip_tbl$path_fraction),
    n_tips = nrow(tip_tbl)
  )

  list(
    edge_allometries = edge_tbl,
    tip_allometries = tip_tbl,
    summary = summary_tbl
  )
}

compute_node_path_lengths <- function(tree) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  edges <- tree$edges
  if (nrow(edges) == 0) {
    return(tibble::tibble())
  }

  children <- split(edges, edges$from)
  child_nodes <- unique(edges$to)
  parent_nodes <- unique(edges$from)
  tip_nodes <- setdiff(child_nodes, parent_nodes)

  walk <- function(node, path_len = 0, n_seg = 0) {
    key <- as.character(node)
    if (!key %in% names(children)) {
      return(list())
    }

    out <- list()
    for (i in seq_len(nrow(children[[key]]))) {
      e <- children[[key]][i, ]
      next_len <- path_len + e$length
      child <- e$to

      out[[length(out) + 1L]] <- tibble::tibble(
        node_id = child,
        path_length = next_len,
        n_segments = n_seg + 1L,
        is_tip = child %in% tip_nodes
      )

      out <- c(out, walk(child, next_len, n_seg + 1L))
    }
    out
  }

  dplyr::bind_rows(walk(1L))
}

compute_tree_shape <- function(tree) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  x_span <- diff(range(tree$nodes$x))
  y_span <- diff(range(tree$nodes$y))
  tibble::tibble(
    height = y_span,
    width = x_span,
    aspect_ratio = ifelse(x_span <= 0, NA_real_, y_span / x_span)
  )
}

compute_scaling_metrics <- function(tree) {
  if (!inherits(tree, "spa_tree")) stop("tree must be from simulate_branching_tree()")

  path <- compute_path_metrics(tree)
  shape <- compute_tree_shape(tree)
  edges <- tree$edges

  total_volume <- sum(pi * edges$radius^2 * edges$length)
  total_conductance <- sum(1 / path$paths$path_resistance)

  tibble::tibble(
    path_fraction_target = tree$params$path_fraction,
    path_fraction_realized = path$summary$realized_path_fraction,
    path_fraction_realized_main = path$summary$realized_path_fraction_main,
    path_fraction_realized_length = path$summary$realized_path_fraction_length,
    mean_path_length = path$summary$mean_path_length,
    mean_path_stem_volume = path$summary$mean_path_stem_volume,
    n_tips = path$summary$n_tips,
    M_proxy = total_volume,
    K_proxy = total_conductance,
    B_proxy = total_conductance,
    height = shape$height,
    width = shape$width,
    aspect_ratio = shape$aspect_ratio
  )
}
