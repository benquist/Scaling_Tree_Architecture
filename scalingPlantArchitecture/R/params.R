validate_spa_params <- function(params) {
  if (!is.list(params)) stop("params must be a list")

  required <- c(
    "max_order", "branch_prob", "length_decay", "radius_decay", "path_fraction",
    "asymmetry_strength", "asym_alpha", "asym_beta", "base_length", "base_radius",
    "branch_angle", "branch_angle_sd", "main_angle_sd", "seed"
  )

  missing_fields <- setdiff(required, names(params))
  if (length(missing_fields) > 0) {
    stop("params is missing required fields: ", paste(missing_fields, collapse = ", "))
  }

  scalar_num <- function(x) is.numeric(x) && length(x) == 1 && is.finite(x)

  if (!scalar_num(params$max_order) || params$max_order < 1 || params$max_order != as.integer(params$max_order)) {
    stop("max_order must be an integer >= 1")
  }
  if (!scalar_num(params$branch_prob) || params$branch_prob <= 0 || params$branch_prob > 1) {
    stop("branch_prob must be in (0, 1]")
  }
  if (!scalar_num(params$length_decay) || params$length_decay <= 0 || params$length_decay >= 1) {
    stop("length_decay must be in (0, 1)")
  }
  if (!scalar_num(params$radius_decay) || params$radius_decay <= 0 || params$radius_decay >= 1) {
    stop("radius_decay must be in (0, 1)")
  }
  if (!scalar_num(params$path_fraction) || params$path_fraction < 0 || params$path_fraction > 1) {
    stop("path_fraction must be in [0, 1]")
  }
  if (!scalar_num(params$asymmetry_strength) || params$asymmetry_strength < 0 || params$asymmetry_strength > 1) {
    stop("asymmetry_strength must be in [0, 1]")
  }
  if (!scalar_num(params$asym_alpha) || params$asym_alpha <= 0) {
    stop("asym_alpha must be > 0")
  }
  if (!scalar_num(params$asym_beta) || params$asym_beta <= 0) {
    stop("asym_beta must be > 0")
  }
  if (!scalar_num(params$base_length) || params$base_length <= 0) {
    stop("base_length must be > 0")
  }
  if (!scalar_num(params$base_radius) || params$base_radius <= 0) {
    stop("base_radius must be > 0")
  }
  if (!scalar_num(params$branch_angle)) {
    stop("branch_angle must be finite")
  }
  if (!scalar_num(params$branch_angle_sd) || params$branch_angle_sd < 0) {
    stop("branch_angle_sd must be >= 0")
  }
  if (!scalar_num(params$main_angle_sd) || params$main_angle_sd < 0) {
    stop("main_angle_sd must be >= 0")
  }

  if (!is.null(params$seed)) {
    if (!scalar_num(params$seed) || params$seed != as.integer(params$seed)) {
      stop("seed must be NULL or a finite integer")
    }
    params$seed <- as.integer(params$seed)
  }

  params$max_order <- as.integer(params$max_order)
  class(params) <- "spa_params"
  params
}

update_spa_params <- function(base_params, updates = list()) {
  if (!inherits(base_params, "spa_params")) {
    stop("base_params must be created with new_spa_params()")
  }
  if (!is.list(updates)) {
    stop("updates must be a list")
  }

  p <- utils::modifyList(as.list(base_params), updates)
  validate_spa_params(p)
}

new_spa_params <- function(
  max_order = 10,
  branch_prob = 0.98,
  length_decay = 0.72,
  radius_decay = 0.79,
  path_fraction = 0.7,
  asymmetry_strength = 0.7,
  asym_alpha = 2,
  asym_beta = 2,
  base_length = 1,
  base_radius = 0.1,
  branch_angle = 34,
  branch_angle_sd = 9,
  main_angle_sd = 4,
  seed = NULL
) {
  params <- list(
    max_order = as.integer(max_order),
    branch_prob = branch_prob,
    length_decay = length_decay,
    radius_decay = radius_decay,
    path_fraction = path_fraction,
    asymmetry_strength = asymmetry_strength,
    asym_alpha = asym_alpha,
    asym_beta = asym_beta,
    base_length = base_length,
    base_radius = base_radius,
    branch_angle = branch_angle,
    branch_angle_sd = branch_angle_sd,
    main_angle_sd = main_angle_sd,
    seed = seed
  )

  validate_spa_params(params)
}
