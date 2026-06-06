validate_smith_params <- function(params) {
	if (!is.list(params)) stop("params must be a list")

	required <- c(
		"N_t", "D_t", "f_max", "u", "safety_factor",
		"b_const", "l0_factor", "furcation_mode", "seed"
	)
	missing_fields <- setdiff(required, names(params))
	if (length(missing_fields) > 0) {
		stop("params is missing required fields: ", paste(missing_fields, collapse = ", "))
	}

	scalar_num <- function(x) is.numeric(x) && length(x) == 1 && is.finite(x)

	if (!scalar_num(params$N_t) || params$N_t < 2 || params$N_t != as.integer(params$N_t)) {
		stop("N_t must be an integer >= 2")
	}
	if (!scalar_num(params$D_t) || params$D_t <= 0) {
		stop("D_t must be > 0")
	}
	if (!scalar_num(params$f_max) || params$f_max < 2 || params$f_max != as.integer(params$f_max)) {
		stop("f_max must be an integer >= 2")
	}
	if (!scalar_num(params$u)) {
		stop("u must be finite")
	}
	if (!scalar_num(params$safety_factor) || params$safety_factor <= 0) {
		stop("safety_factor must be > 0")
	}
	if (!scalar_num(params$b_const) || params$b_const <= 0) {
		stop("b_const must be > 0")
	}
	if (!scalar_num(params$l0_factor) || params$l0_factor < 0) {
		stop("l0_factor must be >= 0")
	}

	params$furcation_mode <- match.arg(params$furcation_mode, c("random", "max"))

	if (!is.null(params$seed)) {
		if (!scalar_num(params$seed) || params$seed != as.integer(params$seed)) {
			stop("seed must be NULL or a finite integer")
		}
		params$seed <- as.integer(params$seed)
	}

	params$N_t <- as.integer(params$N_t)
	params$f_max <- as.integer(params$f_max)
	class(params) <- "smith_params"
	params
}

new_smith_params <- function(
	N_t = 128,
	D_t = 0.02,
	f_max = 3,
	u = 0,
	safety_factor = 4,
	b_const = 10,
	l0_factor = 0.794,
	furcation_mode = c("random", "max"),
	seed = NULL
) {
	params <- list(
		N_t = as.integer(N_t),
		D_t = D_t,
		f_max = as.integer(f_max),
		u = u,
		safety_factor = safety_factor,
		b_const = b_const,
		l0_factor = l0_factor,
		furcation_mode = match.arg(furcation_mode),
		seed = seed
	)

	validate_smith_params(params)
}

update_smith_params <- function(base_params, updates = list()) {
	if (!inherits(base_params, "smith_params")) {
		stop("base_params must be created with new_smith_params()")
	}
	if (!is.list(updates)) stop("updates must be a list")
	validate_smith_params(utils::modifyList(as.list(base_params), updates))
}

choose_smith_furcation <- function(R_m, f_max, mode = c("random", "max")) {
	mode <- match.arg(mode)
	if (R_m <= 1) return(1L)
	upper <- as.integer(min(f_max, R_m))
	lower <- 2L
	if (upper < lower) return(2L)
	if (mode == "max") return(upper)
	sample.int(upper - lower + 1L, size = 1L) + lower - 1L
}

smith_partition_rank <- function(R_m, f, u) {
	if (!is.numeric(R_m) || R_m != as.integer(R_m) || R_m < f) {
		stop("R_m must be an integer >= f")
	}
	if (!is.numeric(f) || f != as.integer(f) || f < 2) {
		stop("f must be an integer >= 2")
	}
	if (!is.numeric(u) || !is.finite(u) || length(u) != 1) {
		stop("u must be a finite scalar")
	}

	daughters <- integer(f)

	for (i in seq_len(f - 1L)) {
		if (i == 1L) {
			A_i <- 1L
		} else {
			A_i <- daughters[i - 1L]
		}

		R_rem <- R_m - sum(daughters[seq_len(i - 1L)])
		Z_i <- floor(R_rem / (f - i + 1L))
		if (Z_i < A_i) Z_i <- A_i

		candidates <- seq.int(A_i, Z_i)
		if (length(candidates) == 1L) {
			daughters[i] <- candidates
			next
		}

		if (u <= 0) {
			weights <- candidates ^ u
		} else {
			weights <- (Z_i - A_i + candidates) ^ (-u)
		}
		weights[!is.finite(weights)] <- 0
		if (sum(weights) <= 0) {
			weights <- rep(1, length(candidates))
		}

		daughters[i] <- sample(candidates, size = 1L, prob = weights)
	}

	daughters[f] <- as.integer(R_m - sum(daughters[seq_len(f - 1L)]))
	daughters
}

simulate_smith_tree <- function(params = new_smith_params()) {
	if (!inherits(params, "smith_params")) {
		stop("params must be created with new_smith_params()")
	}
	if (!is.null(params$seed)) {
		set.seed(params$seed)
	}

	segments <- tibble::tibble(
		segment_id = 1L,
		parent_id = NA_integer_,
		depth = 0L,
		daughter_order = NA_integer_,
		rank = as.integer(params$N_t)
	)

	queue <- 1L
	next_id <- 1L

	while (length(queue) > 0L) {
		sid <- queue[[1L]]
		queue <- queue[-1L]

		R_m <- segments$rank[segments$segment_id == sid][1]
		if (is.na(R_m) || R_m <= 1L) next

		if (sid == 1L) {
			# Keep a single non-bifurcating trunk segment before any furcation.
			f <- 1L
			child_ranks <- as.integer(R_m)
		} else {
			f <- choose_smith_furcation(R_m, params$f_max, params$furcation_mode)
			child_ranks <- smith_partition_rank(R_m = R_m, f = f, u = params$u)
		}

		for (j in seq_len(f)) {
			next_id <- next_id + 1L
			child <- tibble::tibble(
				segment_id = next_id,
				parent_id = sid,
				depth = segments$depth[segments$segment_id == sid][1] + 1L,
				daughter_order = j,
				rank = as.integer(child_ranks[j])
			)
			segments <- dplyr::bind_rows(segments, child)
			if (child$rank > 1L) queue <- c(queue, child$segment_id)
		}
	}

	# Geometry from rank conservation: D(R) = D_t * sqrt(R)
	segments <- segments |>
		dplyr::mutate(diameter = params$D_t * sqrt(rank))

	children_sub <- segments[!is.na(segments$parent_id), c("parent_id", "diameter")]
	if (nrow(children_sub) > 0) {
		split_d <- split(children_sub$diameter, children_sub$parent_id)
		children_tbl <- tibble::tibble(
			parent_id = as.integer(names(split_d)),
			max_child_diameter = as.numeric(vapply(split_d, max, numeric(1))),
			n_children = as.integer(vapply(split_d, length, integer(1)))
		)
	} else {
		children_tbl <- tibble::tibble(
			parent_id = integer(),
			max_child_diameter = double(),
			n_children = integer()
		)
	}

	L_star <- function(D) {
		(params$b_const / params$safety_factor) * (D ^ (2 / 3)) -
			params$l0_factor * (params$b_const / params$safety_factor) * (params$D_t ^ (2 / 3))
	}

	segments <- dplyr::left_join(segments, children_tbl, by = c("segment_id" = "parent_id"))
	segments$n_children[is.na(segments$n_children)] <- 0L
	segments$is_terminal <- segments$n_children == 0L
	segments$length <- ifelse(
		segments$is_terminal,
		pmax(L_star(segments$diameter), 1e-8),
		pmax(L_star(segments$diameter) - L_star(segments$max_child_diameter), 1e-8)
	)

	segments <- segments[order(segments$depth, segments$segment_id), ]
	segments$path_from_base <- NA_real_

	segments$path_from_base[segments$segment_id == 1L] <- segments$length[segments$segment_id == 1L]
	for (i in seq_len(nrow(segments))) {
		pid <- segments$parent_id[i]
		if (is.na(pid)) next
		parent_path <- segments$path_from_base[segments$segment_id == pid]
		segments$path_from_base[i] <- parent_path + segments$length[i]
	}

	tips <- segments[segments$is_terminal, ]

	summary <- tibble::tibble(
		n_tips = nrow(tips),
		basal_diameter = segments$diameter[segments$segment_id == 1L][1],
		total_network_path_length = sum(tips$path_from_base),
		mean_path_length = mean(tips$path_from_base),
		max_path_length = max(tips$path_from_base),
		n_segments = nrow(segments),
		max_depth = max(segments$depth)
	)

	out <- list(segments = segments, tips = tips, params = params, summary = summary)
	class(out) <- "smith_tree"
	out
}

compute_smith_path_metrics <- function(tree) {
	if (!inherits(tree, "smith_tree")) {
		stop("tree must be created with simulate_smith_tree()")
	}
	tree$summary
}

run_smith_allometry_experiment <- function(
	n_tips_values = c(16, 32, 64, 128, 256),
	n_rep = 20,
	base_params = new_smith_params(seed = NULL)
) {
	if (!inherits(base_params, "smith_params")) {
		stop("base_params must be created with new_smith_params()")
	}
	if (!is.numeric(n_tips_values) || length(n_tips_values) < 2 || any(!is.finite(n_tips_values))) {
		stop("n_tips_values must be a finite numeric vector with at least two values")
	}
	n_tips_values <- as.integer(round(n_tips_values))
	if (any(n_tips_values < 2L)) stop("all n_tips_values must be >= 2")
	if (!is.numeric(n_rep) || length(n_rep) != 1 || n_rep < 1 || n_rep != as.integer(n_rep)) {
		stop("n_rep must be an integer >= 1")
	}
	n_rep <- as.integer(n_rep)

	rows <- list()
	idx <- 1L
	for (nt in n_tips_values) {
		for (rep in seq_len(n_rep)) {
			local_seed <- if (is.null(base_params$seed)) NULL else as.integer(base_params$seed + nt * 1000L + rep)
			p <- update_smith_params(base_params, list(N_t = as.integer(nt), seed = local_seed))
			tr <- simulate_smith_tree(p)
			m <- tr$summary
			rows[[idx]] <- tibble::tibble(
				target_n_tips = as.integer(nt),
				rep = rep,
				realized_n_tips = m$n_tips,
				basal_diameter = m$basal_diameter,
				total_network_path_length = m$total_network_path_length,
				mean_path_length = m$mean_path_length,
				max_path_length = m$max_path_length,
				n_segments = m$n_segments,
				max_depth = m$max_depth
			)
			idx <- idx + 1L
		}
	}

	metrics <- dplyr::bind_rows(rows)

	fit_loglog <- function(x, y) {
		keep <- is.finite(x) & is.finite(y) & x > 0 & y > 0
		if (sum(keep) < 3) {
			return(tibble::tibble(slope = NA_real_, intercept = NA_real_, r2 = NA_real_, n = sum(keep)))
		}
		fit <- stats::lm(log10(y[keep]) ~ log10(x[keep]))
		tibble::tibble(
			slope = unname(stats::coef(fit)[2]),
			intercept = unname(stats::coef(fit)[1]),
			r2 = summary(fit)$r.squared,
			n = sum(keep)
		)
	}

	fits <- dplyr::bind_rows(
		fit_loglog(metrics$realized_n_tips, metrics$total_network_path_length) |>
			dplyr::mutate(relationship = "total_path_length_vs_tip_count"),
		fit_loglog(metrics$basal_diameter, metrics$total_network_path_length) |>
			dplyr::mutate(relationship = "total_path_length_vs_basal_diameter")
	)
	fits <- fits[, c("relationship", setdiff(names(fits), "relationship"))]

	list(metrics = metrics, fits = fits, base_params = base_params)
}
