# WBE Branching Platform

A separate, focused simulation and visualization tool for exploring **West, Brown, Enquist (WBE) network scaling theory** applied to symmetric and asymmetric tree branching architectures.

## Overview

This platform lets you:
- Manipulate **explicit branching traits** (furcation number $n$, length ratio $a$, radius ratio $b$, asymmetry).
- Visualize tree **architecture progression** across branching depths.
- Compare **observed scaling exponents** (fitted from simulated trees) to **WBE theoretical predictions** and **finite-size asymptotic estimates**.
- Explore three key allometric relationships: conductance vs. mass, leaves vs. mass, leaves vs. diameter.

---

## Theory: From Branching Traits to Scaling Laws

### Core WBE Assumptions

The WBE framework models hierarchical branching networks (vascular systems, bronchial trees, river networks) under three organizing principles:

1. **Space-filling**: network fills the available volume without unnecessary overlap.
2. **Invariant terminal units**: all terminal branches (capillaries, leaf mesophyll contacts) are geometrically similar.
3. **Area-preserving or elastic similarity**: resource carrying capacity (cross-sectional area or elastic stiffness) is conserved or optimally scaled across levels.

### Branching Geometry

Each generation $m$ produces $n$ daughters from a parent segment. Segments scale by:

$$
\ell_{m+1} = a \cdot \ell_m, \quad r_{m+1} = b \cdot r_m
$$

where:
- $a = $ **length ratio** (typical value: $\approx 0.794$, space-filling in 3D)
- $b = $ **radius ratio** (typical value: $\approx 0.707$, area-preserving)
- $n = $ **furcation number** (typical value: $2$, binary)

### Generation-level Scaling

After $m$ generations, a tree contains:

$$
N_m = n^m \quad \text{(number of terminal tips)}
$$

$$
M_m = \sum_{k=0}^{m} n^k (\pi a^k b^{2k}) \ell_0^2 \cdot \ell_0 = \ell_0^3 \sum_{k=0}^{m} (nab^2)^k \propto \frac{\mu^{m+1} - 1}{\mu - 1}
$$

$$
K_m = \sum_{k=0}^{m} n^k \frac{b^{4k}}{a^k} \frac{1}{(\ell_0/\ell_m)} \propto \frac{\kappa^{m+1} - 1}{\kappa - 1}
$$

where the **generation multipliers** are:

$$
\mu = n a b^2, \quad \kappa = \frac{n b^4}{a}
$$

### Asymptotic (Large-$m$) Scaling Laws

When $\mu > 1$ and $\kappa > 1$ (growing regime), the large-$m$ behavior is:

$$
M_m \sim \mu^m, \quad K_m \sim \kappa^m
$$

so the **allometric exponent** between $K$ and $M$ is:

$$
\boxed{\beta_{K\sim M} = \frac{\ln \kappa}{\ln \mu} = \frac{\ln(nb^4/a)}{\ln(nab^2)}}
$$

**WBE prediction** (when parameters satisfy area-preserving constraint $b = 2^{-1/4}$ and space-filling $a = 2^{-1/3}$ for $n=2$):

$$
\beta_{K\sim M} = \frac{\ln(2 \cdot 2^{-1})}{\ln(2 \cdot 2^{-2/3})} = \frac{\ln(2^0)}{\ln(2^{1/3})} = \frac{0}{1/3} = 0
$$

(i.e., conductance saturates as mass grows — a consequence of optimal capillary design).

---

## Leaf/Terminal Scaling

The number of leaves $N$ scales with network size according to:

$$
N_m = n^m
$$

so the allometric exponent between $N$ and $M$ is:

$$
\boxed{\beta_{N\sim M} = \frac{\ln n}{\ln \mu} = \frac{\ln n}{\ln(nab^2)}}
$$

For the **WBE target** ($N \sim M^{3/4}$):

$$
\frac{\ln n}{\ln(nab^2)} = \frac{3}{4} \quad \Rightarrow \quad nab^2 = n^{4/3} \quad \Rightarrow \quad ab^2 = n^{1/3}
$$

For **binary branching** ($n=2$):

$$
ab^2 = 2^{1/3} \approx 1.26
$$

which is **incompatible** with both area-preserving ($b \approx 0.707$) and space-filling ($a \approx 0.794$) since $0.794 \cdot 0.707^2 \approx 0.396 \ll 1.26$.

This demonstrates a **fundamental tradeoff**: you cannot simultaneously achieve space-filling, area-preserving *and* quarter-power leaf-mass scaling in a strictly symmetric binary tree. Asymmetry or deviation from these classical constraints resolves this.

### Terminal Diameter Scaling

In this simulator, we compute an **effective terminal-equivalent diameter**:

$$
D_{eq} = 2\sqrt{\frac{\sum_{\text{tips}} \pi r_{\text{tip}}^2}{\pi}} \propto (nb^2)^{m/2}
$$

so the allometric exponent between $N$ and $D_{eq}$ is:

$$
\boxed{\beta_{N\sim D_{eq}} = \frac{2\ln n}{\ln(nb^2)}}
$$

---

## Finite-Size Corrections

Real trees have finite depth $m_{\max}$. The finite-$m$ exponent deviates from the asymptotic value:

$$
\beta_{K\sim M}(m) = \frac{\ln \kappa}{\ln \mu} \cdot \frac{1 - \mu^{-(m+1)}}{1 - \kappa^{-(m+1)}}
$$

For large $m$, this approaches the asymptote. For small $m$, curvature appears in log-log plots.

The simulator:
1. **Computes finite-$m$ slopes** by grouping replicates by their maximum order.
2. **Extrapolates to $m \to \infty$** using a linear fit to slope vs. $1/m_{\max}$, yielding an **asymptotic slope** estimate.
3. **Reports finite-size bias**: the gap between the largest-$m$ observed slope and the asymptotic estimate.

---

## Asymmetry Effects

When $\text{asymmetry\_strength} > 0$, daughters no longer receive equal shares of parent resources. The weighted partition redistributes:

$$
w_i = (1 - s) \cdot \frac{1}{n} + s \cdot w_i^{\text{biased}}
$$

where $s \in [0,1]$ is asymmetry strength and $w_i^{\text{biased}}$ favors main path.

Effects:
- **Length and radius modulation**: main daughters receive more length/radius; side daughters less.
- **Altered exponents**: asymmetry changes the effective $\mu$ and $\kappa$, shifting observed slopes.
- **Morphological realism**: natural trees rarely achieve perfect symmetry; asymmetry captures dominance hierarchies (apical control).

---

## Scaling Regimes

### Regime 1: Growing ($\mu > 1, \kappa > 1$)
- Both $M$ and $K$ grow unbounded with $m$.
- $\beta_{K\sim M} > 0$: conductance increases with mass (supply-limited).
- **WBE prediction**: $\beta_{K\sim M} = 0$ (optimal design removes this dependence).

### Regime 2: K-Saturation ($\mu > 1, \kappa < 1$)
- $M$ grows, but $K$ saturates (small terminal radii).
- $\beta_{K\sim M} \to 0$ as $m \to \infty$.
- Physiologically: capillaries become increasingly numerous but individually narrower.

### Regime 3: M-Saturation ($\mu < 1, \kappa > 1$ or $\kappa < 1$)
- Tree stops growing in mass or tips (high taper, small furcation).
- No stable allometric scaling; slopes become noisy or undefined.

---

## Predictions: What to Expect

### For WBE-Compliant Parameters
Set $n=2$, $a \approx 0.794$, $b \approx 0.707$ (area-preserving space-filling):
- $\mu = 2 \cdot 0.794 \cdot 0.707^2 \approx 0.794 < 1$ → **M-saturation regime** → slopes degrade.
- Exponents do not match classical quarter-power predictions.

### For High-Branching Parameters
Set $n=3$ or $4$, adjust $a$ and $b$ to maintain $\mu > 1$:
- $\beta_{K\sim M} > 0$ (conductance grows with mass).
- $\beta_{N\sim M}$ approaches target if $ab^2$ is set appropriately.

### For Asymmetric Parameters
Increase $\text{asymmetry\_strength}$:
- Slopes remain relatively stable (asymmetry modulates distribution, not multipliers).
- Tree morphology becomes visibly hierarchical (main path dominates).

---

## WBE Target Mode: Caveats

The **WBE Target Mode** (checkbox in control panel) sets $a=1.30$, $b=0.984$, $n=2$ to achieve:
$$\beta_{N\sim M} \approx 0.75 \quad \text{(classical 3/4 exponent)}$$
$$\beta_{N\sim D_{eq}} \approx 2.0$$

**⚠️ Important caveat**: These parameter values **violate standard WBE space-filling and area-preserving assumptions**:
- Classical WBE for binary trees: $a \approx 0.794$ (space-filling), $b \approx 0.707$ (area-preserving).
- Target mode: $a = 1.30$ (hyperallometric), $b = 0.984$ (near-isometric).
- The high $a$ value implies **length increases at each branching generation**, contrary to observed taper in vascular systems.

**Purpose**: Target mode is a *pedagogical tool* to explore parameter space where classical quarter-power exponents emerge in symmetric trees, not a biologically realistic configuration. Use it to **understand the exponent–geometry mapping**, not to predict real plant scaling.

---

## Simulation Diagnostics

The control panel reports:

| Metric | Definition | Interpretation |
|--------|-----------|-----------------|
| **K~M observed** | Fitted log-log slope from all replicates | Current dataset exponent |
| **K~M theory** | $\ln(\kappa) / \ln(\mu)$ | Asymptotic prediction from $n,a,b$ |
| **K~M asymptotic** | Extrapolated from finite-$m$ trend | Limiting exponent corrected for finite size |
| **Observed - Theory** | Difference between fitted and predicted | Model deviation (usually < 0.05 for large trees) |
| **N~M observed** | Fitted log-log slope for leaves vs. mass | Current leaves-mass exponent |
| **N~M theory** | $\ln(n) / \ln(nab^2)$ | Asymptotic leaves-mass prediction |
| **N~D_eq observed** | Fitted log-log slope for leaves vs. diameter | Current leaves-diameter exponent |
| **N~D_eq theory** | $2\ln(n) / \ln(nb^2)$ | Asymptotic leaves-diameter prediction |

---

## How to Use

### 1. Explore Baseline WBE
- Set **Furcation** = 2, **Length ratio** = 0.794, **Radius ratio** = 0.707.
- Observe that plots may be noisy (regime boundary).
- Increase **Max order** to 11–12 to improve asymptotic estimates.

### 2. Activate WBE Target Mode
- Toggle **WBE Target Mode** to automatically set $a$ and $b$ for near-$3/4$ and $2$ exponents.
- Compare observed slopes to theory on all three diagnostic plots.

### 3. Vary Branching Parameters
- Increase **Furcation** to 3, 4, or 6 and observe how slopes change.
- Slide **Length ratio** and **Radius ratio** to map the ($a$, $b$) space.
- Asymptotic slopes should remain stable for a given ($n$, $a$, $b$).

### 4. Add Asymmetry
- Increase **Asymmetry strength** from 0 to 0.8.
- Observe tree architecture become hierarchical in the progression panels.
- Note whether slopes shift (they typically shift slightly due to diameter changes).

### 5. Switch Plot Scales
- Use the **Diagnostic scale** dropdown to toggle between Log-Log and Raw.
- Log-Log is preferred for allometric exponent interpretation.
- Raw scale shows absolute units (useful for checking numerical ranges).

---

## Technical Notes

### Proxy Definitions and Assumptions

This simulator uses **dimensionless arbitrary units** for all metrics:

- **$M_{\text{proxy}} = \sum (\pi r^2 \ell)$**: total stem volume (assumed uniform tissue density).  
  *Assumption*: Applies to xylem or any tissue with constant density. **Caution**: Does not account for parenchyma, fibers, or pith.

- **$K_{\text{proxy}} = \sum (r^4 / \ell)$**: proportional to Hagen–Poiseuille hydraulic conductance (omits viscosity, pressure).  
  *Assumption*: Laminar flow in cylindrical conduits; uniform viscosity; no turgor pressure variation.  
  *Limitation*: Real xylem vessels have variable wall thickness and turgor-stiffened walls; this proxy underestimates conductance in young/soft tissues.

- **$N_{\text{tips}}$**: count of terminal nodes.  
  *Assumption*: All terminals are "leaves" or "capillaries."  
  *Limitation*: Real branching systems have vestigial branches, blind-ending vessels, and heterogeneous terminal sizes.

- **$D_{\text{eq}}$**: effective basal diameter from terminal cross-sectional area (pipe-model assumption).  
  $$D_{eq} = 2\sqrt{\frac{\sum_{\text{tips}} A_{\text{tip}}}{\pi}}$$  
  *Assumption*: All terminal vessels have equal cross-sectional area; total cross-section at base equals sum at terminals (perfect area-preservation over entire tree).  
  *Limitation*: Real plants violate this (hydraulic redistribution, reticulation, variable terminal sizes). Use $D_{eq}$ as a **proxy only**, not as true equivalent diameter.

**Validation note**: When comparing to empirical plant allometry, these proxies should be calibrated to real tissue measurements (e.g., M_proxy to xylem mass by harvesting). Do not assume 1:1 correspondence with field measurements.

### Randomness
- **Branch angles** are jittered around the base divergence angle to mimic biological realism.
- **Replicates** at each order differ in exact geometry but share the same expected scaling.
- Fitted slopes are more stable with large $n_{\text{rep}}$; the simulator uses ~15 replicates per order.

### Finite-Size Extrapolation
- Asymptotic slope is estimated by fitting order-wise mean slopes in log-log space against $1/m_{\max}$.
- Valid only in **Log-Log mode** (raw-scale asymptotics are meaningless).
- Shows $R^2$ of the finite-size fit; $R^2 > 0.9$ indicates high confidence.

---

## References

- **West, G.B., Brown, J.H., Enquist, B.J.** (1997). *Science* 276:122–126. Foundational WBE metabolic scaling theory.
- **Savage, V.M., Deeds, E.J., Fontana, W.** (2008). *PLoS Biol.* 6(4):e82. Relaxing WBE assumptions; rank-based branching.
- **Price, C.A., Enquist, B.J., Savage, V.M.** (2007). *PNAS* 104:13204–13209. Network geometry and allometric covariation in plants.
- **Savage, V.M., Bentley, L.P., Enquist, B.J., Sperry, J.S., Smith, D.D., et al.** (2010). *PNAS* 107:15619–15623. Hydraulic trade-offs and finite-size effects in branching networks.

---

## Future Directions

- **Multi-phase networks**: combine hydraulic (K) and mechanical (elastic similarity) constraints.
- **Optimization**: inverse problem — given target exponents, find ($n$, $a$, $b$) automatically.
- **Trait databases**: overlay empirical plant/vascular data for direct model comparison.
- **3D visualization**: render trees in 3D space with full spatial coordinates.

---

**Author**: Brian Enquist Lab  
**Version**: 0.2.0  
**Date**: June 2026
