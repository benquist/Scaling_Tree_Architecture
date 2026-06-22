# wbeBranchingR

Separate WBE simulation package with two immediate goals:

1. Explicit furcation ratio control (`furcation_ratio`, i.e., n).
2. Built-in theory-vs-simulation scaling diagnostics.

## Quick start

```r
library(wbeBranchingR)

p <- new_wbe_params(
  furcation_ratio = 3,
  length_ratio = 0.794,
  radius_ratio = 0.707,
  seed = 42
)

diag <- run_wbe_scaling_diagnostic(
  order_values = 5:11,
  n_rep = 20,
  base_params = p
)

print(diag$fit)
print(diag$theoretical_exponent)
plot_wbe_scaling_diagnostic(diag)
```

## Notes

- `theoretical_mass_conductance_exponent()` provides a transparent baseline
  exponent for current n, a, b settings.
- The diagnostic plot overlays observed regression slope and the theory slope.
