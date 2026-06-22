validate_wbe_params <- function(params) {
  if (!is.list(params)) stop("params must be a list")

  required <- c(
    "max_order", "furcation_ratio", "branch_prob", "length_ratio", "radius_ratio",
    "path_fraction", "asymmetry_strength", "base_length", "base_radius",
    "branch_angle_spread", "angle_jitter_sd", "seed"
  )

  missing_fields <- setdiff(required, names(params))
  if (length(missing_fields) > 0) {
    stop("params is missing required fields: ", paste(missing_fields, collapse = ", "))
  }

  scalar_num <- function(x) is.numeric(x) && length(x) == 1 && is.finite(x)

  if (!scalar_num(params$max_order) || params$max_order < 2 || params$max_order != as.integer(params$max_order)) {
    stop("max_order must be an integer >= 2")
  }
  if (!scalar_num(params$furcation_ratio) || params$furcation_ratio < 2 || params$furcation_ratio != as.integer(params$furcation_ratio)) {
    stop("furcation_ratio must be an integer >= 2")
  }
  if (!scalar_num(params$branch_prob) || params$branch_prob <= 0 || params$branch_prob > 1) {
    stop("branch_prob must be in (0, 1]")
  }
  if (!scalar_num(params$length_ratio) || params$length_ratio <= 0 || params$length_ratio >= 1) {
    stop("length_ratio must be in (0, 1)")
  }
  if (!scalar_num(params$radius_ratio) || params$radius_ratio <= 0 || params$radius_ratio >= 1) {
    stop("radius_ratio must be in (0, 1)")
  }
  if (!scalar_num(params$path_fraction) || params$path_fraction <= 0 || params$path_fraction >= 1) {
    stop("path_fraction must be in (0, 1)")
  }
  if (!scalar_num(params$asymmetry_strength) || params$asymmetry_strength < 0 || params$asymmetry_strength > 1) {
    stop("asymmetry_strength must be in [0, 1]")
  }
  if (!scalar_num(params$base_length) || params$base_length <= 0) {
    stop("base_length must be > 0")
  }
  if (!scalar_num(params$base_radius) || params$base_radius <= 0) {
    stop("base_radius must be > 0")
  }
  if (!scalar_num(params$branch_angle_spread) || params$branch_angle_spread < 0 || params$branch_angle_spread > 170) {
    stop("branch_angle_spread must be in [0, 170]")
  }
  if (!scalar_num(params$angle_jitter_sd) || params$angle_jitter_sd < 0) {
    stop("angle_jitter_sd must be >= 0")
  }

  if (!is.null(params$seed)) {
    if (!scalar_num(params$seed) || params$seed != as.integer(params$seed)) {
      stop("seed must be NULL or a finite integer")
    }
    params$seed <- as.integer(params$seed)
  }

  params$max_order <- as.integer(params$max_order)
  params$furcation_ratio <- as.integer(params$furcation_ratio)
  class(params) <- "wbe_params"
  params
}

new_wbe_params <- function(
  max_order = 11,
  furcation_ratio = 2,
  branch_prob = 0.98,
  length_ratio = 0.794,
  radius_ratio = 0.707,
  path_fraction = 0.62,
  asymmetry_strength = 0.4,
  base_length = 1,
  base_radius = 0.1,
  branch_angle_spread = 70,
  angle_jitter_sd = 4,
  seed = NULL
) {
  params <- list(
    max_order = as.integer(max_order),
    furcation_ratio = as.integer(furcation_ratio),
    branch_prob = branch_prob,
    length_ratio = length_ratio,
    radius_ratio = radius_ratio,
    path_fraction = path_fraction,
    asymmetry_strength = asymmetry_strength,
    base_length = base_length,
    base_radius = base_radius,
    branch_angle_spread = branch_angle_spread,
    angle_jitter_sd = angle_jitter_sd,
    seed = seed
  )

  validate_wbe_params(params)
}

update_wbe_params <- function(base_params, updates = list()) {
  if (!inherits(base_params, "wbe_params")) {
    stop("base_params must be created with new_wbe_params()")
  }
  if (!is.list(updates)) {
    stop("updates must be a list")
  }

  validate_wbe_params(utils::modifyList(as.list(base_params), updates))
}
