\name{run_wbe_scaling_diagnostic}
\alias{run_wbe_scaling_diagnostic}
\alias{plot_wbe_scaling_diagnostic}
\alias{theoretical_mass_conductance_exponent}
\title{Theory-vs-Simulation Scaling Diagnostics}
\description{Runs an order-stratified simulation ensemble and compares observed scaling slope to a theory baseline.}
\usage{
theoretical_mass_conductance_exponent(furcation_ratio, length_ratio, radius_ratio)

run_wbe_scaling_diagnostic(
  order_values = 5:12,
  n_rep = 20,
  base_params = NULL
)

plot_wbe_scaling_diagnostic(diag_obj)
}
\arguments{
  \item{furcation_ratio}{Furcation ratio \eqn{n}.}
  \item{length_ratio}{Length ratio \eqn{a}.}
  \item{radius_ratio}{Radius ratio \eqn{b}.}
  \item{order_values}{Integer orders included in the ensemble sweep.}
  \item{n_rep}{Number of replicates per order.}
  \item{base_params}{A \code{wbe_params} object. If NULL, defaults are used.}
  \item{diag_obj}{Diagnostic list from \code{run_wbe_scaling_diagnostic()}.}
}
\value{
\code{run_wbe_scaling_diagnostic()} returns a list with \code{metrics}, \code{fit}, \code{theoretical_exponent}, and \code{delta_fit_minus_theory}.\cr
\code{plot_wbe_scaling_diagnostic()} returns a ggplot object.
}
\examples{
p <- new_wbe_params(furcation_ratio = 3, seed = 10)
out <- run_wbe_scaling_diagnostic(order_values = 4:7, n_rep = 5, base_params = p)
out$theoretical_exponent
plot_wbe_scaling_diagnostic(out)
}
