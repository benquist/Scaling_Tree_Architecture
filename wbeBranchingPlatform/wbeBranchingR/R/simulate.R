simulate_wbe_tree <- function(params = NULL) {
  if (is.null(params)) {
    params <- get("new_wbe_params", mode = "function", inherits = TRUE)()
  }
  if (!inherits(params, "wbe_params")) {
    stop("params must be created with new_wbe_params()")
  }

  if (!is.null(params$seed)) {
    set.seed(params$seed)
  }

  nodes <- tibble::tibble(node_id = 1L, x = 0, y = 0, order = 0L)
  edges <- tibble::tibble(
    edge_id = integer(),
    from = integer(),
    to = integer(),
    order = integer(),
    child_index = integer(),
    length = double(),
    radius = double(),
    angle = double(),
    share_weight = double(),
    is_main = logical()
  )

  node_id <- 1L
  edge_id <- 0L

  .child_weights <- function(n, path_fraction, asymmetry_strength) {
    base <- c(path_fraction, rep((1 - path_fraction) / (n - 1), n - 1))
    symmetric <- rep(1 / n, n)
    w <- (1 - asymmetry_strength) * symmetric + asymmetry_strength * base
    w / sum(w)
  }

  grow <- function(parent_id, parent_x, parent_y, order, parent_angle, seg_length, seg_radius) {
    if (order > params$max_order) return(invisible(NULL))
    if (runif(1) > params$branch_prob && order > 1L) return(invisible(NULL))

    n <- params$furcation_ratio
    weights <- .child_weights(n, params$path_fraction, params$asymmetry_strength)

    if (order == 1L) {
      weights <- c(1, rep(0, n - 1))
    }

    angle_min <- parent_angle - (params$branch_angle_spread / 2)
    angle_max <- parent_angle + (params$branch_angle_spread / 2)
    base_angles <- if (n == 1) parent_angle else seq(angle_min, angle_max, length.out = n)

    for (i in seq_len(n)) {
      if (order == 1L && i > 1L) next

      share_centered <- (weights[i] - (1 / n)) * n
      length_mult <- max(0.2, 1 + 0.35 * share_centered)
      radius_mult <- max(0.2, 1 + 0.25 * share_centered)

      child_length <- max(1e-5, seg_length * params$length_ratio * length_mult)
      child_radius <- max(1e-5, seg_radius * params$radius_ratio * radius_mult)
      child_angle <- base_angles[i] + stats::rnorm(1, mean = 0, sd = params$angle_jitter_sd)

      child_rad <- child_angle * pi / 180
      child_x <- parent_x + child_length * cos(child_rad)
      child_y <- parent_y + child_length * sin(child_rad)

      node_id <<- node_id + 1L
      child_id <- node_id

      nodes <<- dplyr::bind_rows(
        nodes,
        tibble::tibble(node_id = child_id, x = child_x, y = child_y, order = order)
      )

      edge_id <<- edge_id + 1L
      edges <<- dplyr::bind_rows(
        edges,
        tibble::tibble(
          edge_id = edge_id,
          from = parent_id,
          to = child_id,
          order = order,
          child_index = i,
          length = child_length,
          radius = child_radius,
          angle = child_angle,
          share_weight = weights[i],
          is_main = i == 1L
        )
      )

      grow(child_id, child_x, child_y, order + 1L, child_angle, child_length, child_radius)
    }

    invisible(NULL)
  }

  grow(
    parent_id = 1L,
    parent_x = 0,
    parent_y = 0,
    order = 1L,
    parent_angle = 90,
    seg_length = params$base_length,
    seg_radius = params$base_radius
  )

  tree <- list(nodes = nodes, edges = edges, params = params)
  class(tree) <- "wbe_tree"
  tree
}
