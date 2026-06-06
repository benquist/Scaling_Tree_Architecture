# Smith Module and Visualization README

This document describes the Smith-style component implemented for the scalingPlantArchitecture project, including:

- the separate R package module in this package
- the separate interactive browser visualization in js-tree-simulator

This component is additive and does not replace the original SPA simulator.

## 1. What this component does

The Smith-style component builds trees using branch rank as the core state variable.

- Rank R is the number of terminal twigs supported by a segment.
- The trunk starts with rank N_t.
- At each branching event, daughter ranks satisfy rank conservation:
  - R_m = sum_i R_d,i
- Daughter ranks are assigned sequentially under nondecreasing ordering and feasibility bounds.
- Segment diameters are assigned from rank using area-preserving scaling:
  - D(R) = D_t * R^(1/2)
- Segment lengths are assigned from a Smith-style elastic-similarity rule:
  - L_star(D) = (b/s) * D^(2/3) - l0 * (b/s) * D_t^(2/3)
- Internal segment length is computed as:
  - l_m = L_star(D_m) - L_star(D_d,max)
- Terminal segment length is:
  - l_t = L_star(D_t)

The module reports total network path length as the sum of all root-to-tip path lengths across terminal tips.

## 2. Implemented R functions

Location:

- R module: R/smith_module.R

Exported functions:

- new_smith_params
- update_smith_params
- smith_partition_rank
- simulate_smith_tree
- compute_smith_path_metrics
- run_smith_allometry_experiment

Parameter set in new_smith_params:

- N_t: terminal tip count (integer >= 2)
- D_t: terminal twig diameter (> 0)
- f_max: maximum furcation (integer >= 2)
- u: asymmetry/symmetry control
- safety_factor: s (> 0)
- b_const: b (> 0)
- l0_factor: finite-size correction multiplier (>= 0), default 0.794
- furcation_mode: random or max
- seed: optional integer seed

## 3. Rank partition logic used in code

For mother rank R_m and furcation f:

- Daughters are sampled in nondecreasing order.
- Lower bound for first daughter:
  - A_1 = 1
- Lower bound for i > 1:
  - A_i = R_d,i-1
- Upper bound:
  - Z_i = floor((R_m - sum_{j < i} R_d,j) / (f - i + 1))
- Final daughter is set by conservation:
  - R_d,f = R_m - sum_{j=1}^{f-1} R_d,j

Sampling weights:

- if u <= 0:
  - weights proportional to candidate^u
- if u > 0:
  - weights proportional to (Z - A + candidate)^(-u)

This matches the intended asymmetry control pattern in the Smith-style derivation.

## 4. Output structure from simulate_smith_tree

simulate_smith_tree returns an object of class smith_tree with:

- segments table
- tips table
- params list
- summary table with:
  - n_tips
  - basal_diameter
  - total_network_path_length
  - mean_path_length
  - max_path_length
  - n_segments
  - max_depth

## 5. Allometry experiment API

run_smith_allometry_experiment runs replicated simulations across user-specified tip classes and returns:

- metrics table (per replicate)
- fits table with log-log slopes for:
  - total_path_length_vs_tip_count
  - total_path_length_vs_basal_diameter

## 6. Separate interactive visualization

Location:

- ../js-tree-simulator/smith-model.html
- ../js-tree-simulator/smith-model.css
- ../js-tree-simulator/smith-model.js

Visualization controls:

- N_t, D_t, f_max, u
- safety factor s
- mechanical constant b
- virtual-length factor
- seed
- allometry sweep settings (min tips, max tips, classes, replicates)

Visualization outputs:

- rendered Smith-style tree
- total network path length vs tip count scatter with log-log fit
- total network path length vs basal diameter scatter with log-log fit

## 7. Accuracy notes relative to this implementation

To keep this README aligned with code, note the following:

- The R module supports furcation_mode = random or max.
- The JS visualization currently uses random furcation within feasible bounds and does not expose furcation_mode.
- The finite-size term is parameterized as l0_factor in R and l0 in JS; default is 0.794.
- Lengths are clamped to a small positive floor for numerical stability.
- This component currently focuses on architecture and path-length allometry; full conduit-level hydraulic conductance calculations are not yet implemented in the new module.

## 8. Minimal R usage example

library(scalingPlantArchitecture)

p <- new_smith_params(
  N_t = 128,
  D_t = 0.02,
  f_max = 3,
  u = 0,
  safety_factor = 4,
  b_const = 10,
  l0_factor = 0.794,
  seed = 42
)

tr <- simulate_smith_tree(p)
compute_smith_path_metrics(tr)

exp <- run_smith_allometry_experiment(
  n_tips_values = c(16, 32, 64, 128, 256),
  n_rep = 10,
  base_params = p
)

exp$fits

## 9. Validation status

Current validation files:

- tests/testthat/test-smith-module.R

Validated items include:

- rank partition conservation and ordering
- tree generation structure and expected tip count
- allometry experiment output shape and relationship labels
