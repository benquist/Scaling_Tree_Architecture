\name{new_wbe_params}
\alias{new_wbe_params}
\alias{update_wbe_params}
\title{Create and Update WBE Parameter Sets}
\description{Constructs and validates parameter lists used by the WBE branching simulator.}
\usage{
new_wbe_params(
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
)

update_wbe_params(base_params, updates = list())
}
\arguments{
  \item{max_order}{Maximum branching order.}
  \item{furcation_ratio}{Explicit furcation ratio \eqn{n} (integer >= 2).}
  \item{branch_prob}{Branch continuation probability.}
  \item{length_ratio}{Per-order branch length ratio \eqn{a}.}
  \item{radius_ratio}{Per-order branch radius ratio \eqn{b}.}
  \item{path_fraction}{Main-path allocation fraction at each split.}
  \item{asymmetry_strength}{Strength of asymmetry between symmetric and biased splits.}
  \item{base_length}{Base segment length.}
  \item{base_radius}{Base segment radius.}
  \item{branch_angle_spread}{Angular spread across daughters.}
  \item{angle_jitter_sd}{Random angle jitter (degrees).}
  \item{seed}{Optional integer random seed.}
  \item{base_params}{An existing \code{wbe_params} object.}
  \item{updates}{Named list of parameters to change.}
}
\value{A validated object of class \code{wbe_params}.}
\examples{
p <- new_wbe_params(furcation_ratio = 3, seed = 42)
p2 <- update_wbe_params(p, list(length_ratio = 0.78))
}
