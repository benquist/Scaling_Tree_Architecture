simulate_branching_tree <- function(params = new_spa_params()) {
  if (!inherits(params, "spa_params")) {
    stop("params must be created with new_spa_params()")
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
    length = double(),
    radius = double(),
    angle = double(),
    is_main = logical()
  )

  node_id <- 1L
  edge_id <- 0L

  grow <- function(parent_id, parent_x, parent_y, order, parent_angle, seg_length, seg_radius) {
    if (order > params$max_order) return(invisible(NULL))
    if (runif(1) > params$branch_prob && order > 1L) return(invisible(NULL))

    # Force a single trunk segment at the first order (no furcation at the base).
    if (order == 1L) {
      trunk_angle <- parent_angle + rnorm(1, mean = 0, sd = params$main_angle_sd)
      trunk_rad <- trunk_angle * pi / 180
      trunk_x <- parent_x + seg_length * cos(trunk_rad)
      trunk_y <- parent_y + seg_length * sin(trunk_rad)
      trunk_length <- max(seg_length, 1e-4)
      trunk_radius <- max(seg_radius, 1e-4)

      node_id <<- node_id + 1L
      trunk_node <- node_id

      nodes <<- dplyr::bind_rows(
        nodes,
        tibble::tibble(node_id = trunk_node, x = trunk_x, y = trunk_y, order = order)
      )

      edge_id <<- edge_id + 1L
      edges <<- dplyr::bind_rows(
        edges,
        tibble::tibble(
          edge_id = edge_id,
          from = parent_id,
          to = trunk_node,
          order = order,
          length = trunk_length,
          radius = trunk_radius,
          angle = trunk_angle,
          is_main = TRUE
        )
      )

      next_length <- trunk_length * params$length_decay
      next_radius <- trunk_radius * params$radius_decay
      grow(trunk_node, trunk_x, trunk_y, order + 1L, trunk_angle, next_length, next_radius)
      return(invisible(NULL))
    }

    u <- stats::rbeta(1, params$asym_alpha, params$asym_beta)
    p_main <- (1 - params$asymmetry_strength) * 0.5 +
      params$asymmetry_strength * (params$path_fraction * 0.7 + 0.3 * u)
    skew <- (p_main - 0.5) * 2

    main_length <- seg_length * params$length_decay * (1 + 0.35 * skew)
    side_length <- seg_length * params$length_decay * (1 - 0.35 * skew)
    main_radius <- seg_radius * params$radius_decay * (1 + 0.22 * skew)
    side_radius <- seg_radius * params$radius_decay * (1 - 0.22 * skew)

    main_length <- max(main_length, 1e-4)
    side_length <- max(side_length, 1e-4)
    main_radius <- max(main_radius, 1e-4)
    side_radius <- max(side_radius, 1e-4)

    side_sign <- sample(c(-1, 1), size = 1)
    main_angle <- parent_angle + rnorm(1, mean = 0, sd = params$main_angle_sd)
    side_angle <- parent_angle + side_sign * (params$branch_angle + rnorm(1, 0, params$branch_angle_sd))

    main_rad <- main_angle * pi / 180
    side_rad <- side_angle * pi / 180

    main_x <- parent_x + main_length * cos(main_rad)
    main_y <- parent_y + main_length * sin(main_rad)
    side_x <- parent_x + side_length * cos(side_rad)
    side_y <- parent_y + side_length * sin(side_rad)

    node_id <<- node_id + 1L
    main_node <- node_id
    node_id <<- node_id + 1L
    side_node <- node_id

    nodes <<- dplyr::bind_rows(
      nodes,
      tibble::tibble(node_id = main_node, x = main_x, y = main_y, order = order),
      tibble::tibble(node_id = side_node, x = side_x, y = side_y, order = order)
    )

    edge_id <<- edge_id + 1L
    edges <<- dplyr::bind_rows(
      edges,
      tibble::tibble(
        edge_id = edge_id,
        from = parent_id,
        to = main_node,
        order = order,
        length = main_length,
        radius = main_radius,
        angle = main_angle,
        is_main = TRUE
      )
    )

    edge_id <<- edge_id + 1L
    edges <<- dplyr::bind_rows(
      edges,
      tibble::tibble(
        edge_id = edge_id,
        from = parent_id,
        to = side_node,
        order = order,
        length = side_length,
        radius = side_radius,
        angle = side_angle,
        is_main = FALSE
      )
    )

    grow(main_node, main_x, main_y, order + 1L, main_angle, main_length, main_radius)
    grow(side_node, side_x, side_y, order + 1L, side_angle, side_length, side_radius)
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
  class(tree) <- "spa_tree"
  tree
}
