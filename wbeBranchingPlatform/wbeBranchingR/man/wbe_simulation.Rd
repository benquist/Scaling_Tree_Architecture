\name{simulate_wbe_tree}
\alias{simulate_wbe_tree}
\alias{compute_wbe_metrics}
\title{Simulate WBE Branching Trees and Compute Metrics}
\description{Simulates a branching tree under explicit furcation ratio and computes allometric proxies.}
\usage{
simulate_wbe_tree(params = NULL)

compute_wbe_metrics(tree)
}
\arguments{
  \item{params}{A \code{wbe_params} object created by \code{new_wbe_params()}.}
  \item{tree}{A \code{wbe_tree} object created by \code{simulate_wbe_tree()}.}
}
\value{
\code{simulate_wbe_tree()} returns a \code{wbe_tree} list with \code{nodes}, \code{edges}, and \code{params}.\cr
\code{compute_wbe_metrics()} returns a one-row tibble containing mass and conductance proxies.
}
\examples{
p <- new_wbe_params(furcation_ratio = 2, seed = 1)
tr <- simulate_wbe_tree(p)
compute_wbe_metrics(tr)
}
