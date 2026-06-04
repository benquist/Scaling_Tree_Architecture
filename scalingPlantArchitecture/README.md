# scalingPlantArchitecture

`scalingPlantArchitecture` is an R package scaffold for generating asymmetric,
variable-path-length branching trees inspired by metabolic scaling theory and
WBE-like architecture models.

## What this package does (v0.1.0)

- Simulates branching trees with configurable asymmetry and path-fraction control.
- Draws publication-style tree morphologies across path-fraction scenarios.
- Computes path, shape, volume, and conductance-based scaling summaries.
- Provides a symmetric analytical baseline for comparison with simulations.

## Theory basis

This package is designed to be driven by the two user-supplied theory papers:
- Smith et al. tree-shape/path-fraction style framework (user-supplied).
- WBE/metabolic scaling style vascular network framework (user-supplied).

## Quick start

```r
library(scalingPlantArchitecture)

p <- new_spa_params(max_order = 9, path_fraction = 0.7, seed = 1)
tr <- simulate_branching_tree(p)

plot_tree(tr)
compute_scaling_metrics(tr)

panel <- plot_smith_tree_panel(path_fractions = c(0.3, 0.5, 0.7, 1.0), base_params = p)
panel

ens <- analyze_ensemble(path_fraction_values = c(0.3, 0.5, 0.7, 1.0), n_rep = 40, base_params = p)
plot_pathfraction_scaling(ens$metrics)
ens$fits

analytic_symmetric_wbe(max_order = 12)
```
