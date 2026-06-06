smith_interp <- function(u, u_min, u_max, y_min, y_max) {
  uu <- max(u_min, min(u_max, u))
  y_min + (uu - u_min) * (y_max - y_min) / (u_max - u_min)
}

smith_path_fraction <- function(tree) {
  if (!inherits(tree, "smith_tree")) stop("tree must be created with simulate_smith_tree()")
  p <- tree$tips$path_from_base
  if (!length(p)) return(NA_real_)
  mean(p) / max(p)
}

layout_smith_tree <- function(
  tree,
  crown_spread = NULL,
  branch_spread = NULL,
  jitter = NULL,
  seed = NULL
) {
  if (!inherits(tree, "smith_tree")) stop("tree must be created with simulate_smith_tree()")
  u <- tree$params$u

  if (is.null(crown_spread)) crown_spread <- smith_interp(u, -5, 5, 0.55, 1.25)
  if (is.null(branch_spread)) branch_spread <- smith_interp(u, -5, 5, pi / 5.5, pi / 2.6)
  if (is.null(jitter)) jitter <- smith_interp(u, -5, 5, 0.055, 0.16)
  if (!is.null(seed)) set.seed(seed)

  seg <- tree$segments
  children_list <- split(seg$segment_id[!is.na(seg$parent_id)], seg$parent_id[!is.na(seg$parent_id)])

  seg$x0 <- NA_real_
  seg$y0 <- NA_real_
  seg$x1 <- NA_real_
  seg$y1 <- NA_real_
  seg$angle <- NA_real_

  root_idx <- which(seg$segment_id == 1L)
  seg$x0[root_idx] <- 0
  seg$y0[root_idx] <- 0
  seg$angle[root_idx] <- pi / 2
  seg$x1[root_idx] <- seg$length[root_idx] * cos(seg$angle[root_idx])
  seg$y1[root_idx] <- seg$length[root_idx] * sin(seg$angle[root_idx])

  q <- 1L
  while (length(q) > 0) {
    sid <- q[[1]]
    q <- q[-1]
    pid <- as.character(sid)
    kids <- children_list[[pid]]
    if (is.null(kids) || !length(kids)) next

    parent_idx <- which(seg$segment_id == sid)
    parent_angle <- seg$angle[parent_idx]
    parent_x <- seg$x1[parent_idx]
    parent_y <- seg$y1[parent_idx]

    kid_idx <- match(kids, seg$segment_id)
    ranks <- seg$rank[kid_idx]
    ord <- order(ranks)
    kid_idx <- kid_idx[ord]
    ranks <- ranks[ord]
    largest_pos <- which.max(ranks)

    rel_size <- ranks / max(ranks)
    side_signs <- rep(c(-1, 1), length.out = length(kid_idx))

    for (ii in seq_along(kid_idx)) {
      kidx <- kid_idx[ii]
      if (sid == 1L && length(kid_idx) == 1L) {
        offset <- 0
      } else if (ii == largest_pos) {
        offset <- rnorm(1, 0, jitter * 0.25)
      } else {
        lateral_strength <- (1 - rel_size[ii])^0.45
        offset <- side_signs[ii] * branch_spread * (0.35 + 0.65 * lateral_strength)
        offset <- offset + rnorm(1, 0, jitter)
      }

      angle <- parent_angle + offset * crown_spread
      angle <- max(0.05, min(pi - 0.05, angle))

      seg$x0[kidx] <- parent_x
      seg$y0[kidx] <- parent_y
      seg$angle[kidx] <- angle
      seg$x1[kidx] <- parent_x + seg$length[kidx] * cos(angle)
      seg$y1[kidx] <- parent_y + seg$length[kidx] * sin(angle)

      q <- c(q, seg$segment_id[kidx])
    }
  }

  ys <- c(seg$y0, seg$y1)
  min_y <- min(ys, na.rm = TRUE)
  max_y <- max(ys, na.rm = TRUE)
  H <- max(max_y - min_y, 1e-9)

  seg$x0 <- seg$x0 / H
  seg$x1 <- seg$x1 / H
  seg$y0 <- (seg$y0 - min_y) / H
  seg$y1 <- (seg$y1 - min_y) / H

  list(
    segments = seg,
    path_fraction = smith_path_fraction(tree),
    aspect_ratio = {
      xx <- c(seg$x0, seg$x1)
      yy <- c(seg$y0, seg$y1)
      height <- max(yy, na.rm = TRUE) - min(yy, na.rm = TRUE)
      width <- max(xx, na.rm = TRUE) - min(xx, na.rm = TRUE)
      height / max(width, 1e-9)
    }
  )
}

plot_smith_tree <- function(
  tree,
  layout = NULL,
  col_main = "black",
  col_fine = "gray35",
  fine_rank_threshold = 4,
  lwd_multiplier = 7,
  label = NULL,
  add = FALSE,
  axes = FALSE,
  frame.plot = FALSE
) {
  if (!inherits(tree, "smith_tree")) stop("tree must be created with simulate_smith_tree()")
  lay <- if (is.null(layout)) layout_smith_tree(tree) else layout
  seg <- lay$segments

  xs <- c(seg$x0, seg$x1)
  ys <- c(seg$y0, seg$y1)
  xr <- range(xs, na.rm = TRUE)
  yr <- range(ys, na.rm = TRUE)
  pad <- diff(xr) * 0.12 + 0.05
  xlim <- c(xr[1] - pad, xr[2] + pad)
  ylim <- c(min(0, yr[1]), yr[2] + 0.05)

  if (!add) {
    plot(NA, NA, type = "n", xlim = xlim, ylim = ylim, asp = 1,
         xlab = "", ylab = "", axes = axes, frame.plot = frame.plot)
  }

  ord <- order(seg$diameter, decreasing = TRUE)
  maxD <- max(seg$diameter, na.rm = TRUE)
  for (i in ord) {
    lw <- lwd_multiplier * (seg$diameter[i] / maxD)^0.75
    lw <- max(lw, 0.12)
    col <- if (seg$rank[i] <= fine_rank_threshold) col_fine else col_main
    segments(seg$x0[i], seg$y0[i], seg$x1[i], seg$y1[i], lwd = lw, lend = "round", col = col)
  }

  if (!is.null(label)) {
    usr <- par("usr")
    text(mean(usr[1:2]), usr[3] + 0.06 * diff(usr[3:4]), label, cex = 1.05, col = "gray35")
  }

  invisible(lay)
}

plot_smith_architecture_spectrum <- function(
  N_twig = 512,
  f_max = 3,
  u_values = c(-5, -2, 0, 2, 5),
  D_t = 0.02,
  safety_factor = 4,
  b_const = 10,
  l0_factor = 0.794,
  seed = 42,
  lwd_multiplier = 7
) {
  oldpar <- par(no.readonly = TRUE)
  on.exit(par(oldpar), add = TRUE)
  par(mfrow = c(1, length(u_values)), mar = c(0.5, 0.2, 1.2, 0.2))

  out <- vector("list", length(u_values))

  for (i in seq_along(u_values)) {
    u <- u_values[i]
    new_params_fn <- get("new_smith_params", mode = "function")
    simulate_tree_fn <- get("simulate_smith_tree", mode = "function")
    p <- new_params_fn(
      N_t = N_twig,
      D_t = D_t,
      f_max = f_max,
      u = u,
      safety_factor = safety_factor,
      b_const = b_const,
      l0_factor = l0_factor,
      seed = seed + i
    )
    tr <- simulate_tree_fn(p)
    lay <- layout_smith_tree(tr, seed = seed + 1000 + i)

    lab <- bquote(u == .(u) ~ "," ~ P[f] == .(round(lay$path_fraction, 2)))
    plot_smith_tree(
      tr,
      layout = lay,
      label = lab,
      lwd_multiplier = lwd_multiplier,
      axes = FALSE,
      frame.plot = FALSE
    )

    m <- tr$summary
    out[[i]] <- data.frame(
      u = u,
      n_tips = m$n_tips,
      path_fraction = lay$path_fraction,
      aspect_ratio = lay$aspect_ratio,
      total_network_path_length = m$total_network_path_length,
      stringsAsFactors = FALSE
    )
  }

  do.call(rbind, out)
}
