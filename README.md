# Scaling Tree Architecture

A research-oriented repository for exploring how branching geometry and path structure influence emergent allometric scaling.

This project combines:
- an R package (`scalingPlantArchitecture`) for simulation, metrics, and analytical baselines;
- an interactive JavaScript app (`js-tree-simulator`) for rapid visual diagnostics;
- provenance notes (`chat_provenance_log.md`) for workflow traceability of major decisions and runs.

## Scientific scope

The codebase is designed for theory-guided exploration at the interface of:
- WBE-style vascular-network scaling ideas (binary branching, geometric decay, allometric exponents; cite primary WBE sources in manuscripts that reuse these outputs);
- Smith-style path-architecture diagnostics (path fraction and path-length heterogeneity; cite the specific Smith-framework source used in each analysis);
- simulation-based checks of finite-size and asymmetry effects.

This repository is for simulation experiments and theory diagnostics. It does not directly estimate empirical species-level parameters, demographic rates, or community-level biodiversity outcomes without external calibration, validation against measured data, and explicit ecological context.

## Repository structure

- `scalingPlantArchitecture/`: R package source code, tests, and vignette.
- `js-tree-simulator/`: browser app for interactive architecture and allometry exploration.
- `scalingPlantArchitecture_0.1.0.tar.gz`: package build artifact backup.
- `chat_provenance_log.md`: append-only workflow/provenance notes.

## Theory basis implemented in code

The JavaScript simulator computes theory-derived exponents from two branching ratios:
- `eta` = daughter/parent length ratio (`lengthDecay`)
- `gamma` = daughter/parent radius ratio (`radiusDecay`)

It defines
- `aL = -log(eta)/log(2)` (trunk length scaling exponent vs leaf number)
- `aD = -log(gamma)/log(2)` (trunk diameter scaling exponent vs leaf number)
- `aStem = 2*aD + aL` (trunk stem-volume exponent)
- `q = 2*gamma^2*eta` (network-volume regime diagnostic)

Regime logic for total vascular network volume exponent `aNet`:
- `q < 1 - epsilon`: proximal-dominated, `aNet = aStem`
- `q > 1 + epsilon`: distal-dominated, `aNet = 1`
- `|q - 1| <= epsilon`: near-critical tolerance rule, implemented as `aNet = aStem` for diagnostics (`epsilon = 1e-6`)

At exact criticality (`q = 1`), total network volume is expected to include a multiplicative log correction; the implementation above is a practical approximation near the boundary.

The simulator maps these quantities to expected allometric slopes (`b_th`) and reports them alongside fitted slopes (`b`) and asymptotic estimates (`b_inf`). Agreement or mismatch indicates consistency with model assumptions, not proof of ecological mechanism in real systems.

### Path-fraction definition in this project

Smith-style path fraction is reported as:
- `Pf = mean(L_l / L_l*)`

where `L_l` is each root-to-tip path length and `L_l*` is the maximum root-to-tip path length within the same tree. In idealized symmetric limiting cases, `Pf` approaches 1.0.

## R package quick start

```r
# from repository root in R
install.packages("scalingPlantArchitecture", repos = NULL, type = "source")
library(scalingPlantArchitecture)

p <- new_spa_params(max_order = 9, path_fraction = 0.68, seed = 42)
tr <- simulate_branching_tree(p)

plot_tree(tr, preset = "publication")
metrics <- compute_scaling_metrics(tr)
metrics
```

Run ensemble diagnostics:

```r
p_fast <- new_spa_params(max_order = 7, path_fraction = 0.68, seed = 42)
ens <- analyze_ensemble(
  path_fraction_values = c(0.29, 0.51, 0.68, 1.00),
  n_rep = 20,
  base_params = p_fast
)

plot_pathfraction_scaling(ens$metrics, preset = "publication", show_ci = TRUE)
ens$fits
```

## Vignette

A worked vignette is included at:
- `scalingPlantArchitecture/vignettes/smith_wbe_workflow.Rmd`

It demonstrates:
- tree generation;
- Smith-style panel plots;
- ensemble scaling diagnostics;
- per-tree allometries;
- analytical symmetric baseline checks.

## JavaScript app quick start

1. Open `js-tree-simulator/index.html` in a modern browser.
2. Tune controls for branching geometry and class sampling.
3. Click **Generate**.
4. Read diagnostics in the three tabs:
   - Path Distributions
   - Diameter-based allometries
   - Leaf-based allometries

The app displays theory-vs-fit comparisons (`b_th`, `b`, `b_inf`, `Deltafit`, `Deltaasym`) to help identify potential mismatches.

## Typical workflow

1. Choose a baseline parameter set in R with `new_spa_params()`.
2. Simulate single trees to inspect morphology and path distributions.
3. Run `analyze_ensemble()` over path-fraction targets.
4. Compare fitted exponents to analytical expectations.
5. Stress-test assumptions interactively in the JavaScript app.
6. Record settings, seeds, and caveats in provenance logs.

## Reproducibility notes

- Seeded simulations are intended to be reproducible for fixed settings, but exact bitwise reproducibility can vary by R version, RNG settings, package versions, and platform.
- Finite depth and stopping rules can shift fitted exponents relative to asymptotic expectations.
- Some diagnostics are regime-dependent; interpretation should account for `q = 2*gamma^2*eta` and finite-size effects.
- Reported uncertainty primarily reflects simulation and fitting variability under chosen settings; it does not include measurement, taxonomic, environmental, or model-structure uncertainty unless explicitly added.
- Record R version, package versions, RNG configuration, seed values, and execution order when reproducing figures and tables.
- Package and app are intended for theory exploration and method development, not stand-alone biodiversity assessment or decision support.

Optional reproducibility lockfile workflow:

```r
# run once in repository root
install.packages("renv")
renv::init(bare = TRUE)
renv::snapshot()

# on a new machine
renv::restore()
```

## License

The R package is licensed under MIT (`scalingPlantArchitecture/LICENSE`).

For repository-level licensing, treat package-level licensing as authoritative unless a top-level `LICENSE` file is added.

## Citation guidance

When citing methods or outputs from this repository, include:
- repository URL and commit hash;
- package version from `scalingPlantArchitecture/DESCRIPTION`;
- exact script/vignette used;
- seed values and environment details.

## References

- West, G. B., Brown, J. H., and Enquist, B. J. (1997). A general model for the origin of allometric scaling laws in biology. *Science*, 276(5309), 122-126. https://doi.org/10.1126/science.276.5309.122
- West, G. B., Brown, J. H., and Enquist, B. J. (1999). A general model for the structure and allometry of plant vascular systems. *Nature*, 400, 664-667. https://doi.org/10.1038/23251
- Smith-style path-fraction framework reference: user-specified source. Add full citation metadata (authors, year, title, DOI/URL) for any publication release using this repository.

## Status

Package version is defined in `scalingPlantArchitecture/DESCRIPTION`.

This repository is a backup and working home for scaling-tree architecture analyses and documentation, intended for method development and hypothesis generation.
