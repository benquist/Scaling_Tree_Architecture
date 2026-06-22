pkgname <- "wbeBranchingR"
source(file.path(R.home("share"), "R", "examples-header.R"))
options(warn = 1)
library('wbeBranchingR')

base::assign(".oldSearch", base::search(), pos = 'CheckExEnv')
base::assign(".old_wd", base::getwd(), pos = 'CheckExEnv')
cleanEx()
nameEx("wbe_diagnostics")
### * wbe_diagnostics

flush(stderr()); flush(stdout())

### Name: run_wbe_scaling_diagnostic
### Title: Theory-vs-Simulation Scaling Diagnostics
### Aliases: run_wbe_scaling_diagnostic plot_wbe_scaling_diagnostic
###   theoretical_mass_conductance_exponent

### ** Examples

p <- new_wbe_params(furcation_ratio = 3, seed = 10)
out <- run_wbe_scaling_diagnostic(order_values = 4:7, n_rep = 5, base_params = p)
out$theoretical_exponent
plot_wbe_scaling_diagnostic(out)



cleanEx()
nameEx("wbe_params")
### * wbe_params

flush(stderr()); flush(stdout())

### Name: new_wbe_params
### Title: Create and Update WBE Parameter Sets
### Aliases: new_wbe_params update_wbe_params

### ** Examples

p <- new_wbe_params(furcation_ratio = 3, seed = 42)
p2 <- update_wbe_params(p, list(length_ratio = 0.78))



cleanEx()
nameEx("wbe_simulation")
### * wbe_simulation

flush(stderr()); flush(stdout())

### Name: simulate_wbe_tree
### Title: Simulate WBE Branching Trees and Compute Metrics
### Aliases: simulate_wbe_tree compute_wbe_metrics

### ** Examples

p <- new_wbe_params(furcation_ratio = 2, seed = 1)
tr <- simulate_wbe_tree(p)
compute_wbe_metrics(tr)



### * <FOOTER>
###
cleanEx()
options(digits = 7L)
base::cat("Time elapsed: ", proc.time() - base::get("ptime", pos = 'CheckExEnv'),"\n")
grDevices::dev.off()
###
### Local variables: ***
### mode: outline-minor ***
### outline-regexp: "\\(> \\)?### [*]+" ***
### End: ***
quit('no')
