.wbe_internal_fun <- function(name) {
  get(name, mode = "function", inherits = TRUE)
}