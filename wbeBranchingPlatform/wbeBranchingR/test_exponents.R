source("R/analysis.R")

cat("===== TEST SET 1: Classical WBE =====\n")
cat("Parameters: n=2, a=0.794, b=0.707\n\n")

# Classical WBE
n1 <- 2
a1 <- 0.794
b1 <- 0.707
mu1 <- n1 * a1 * (b1^2)
kappa1 <- n1 * (b1^4) / a1
beta_km_1 <- theoretical_mass_conductance_exponent(n1, a1, b1)

cat("Calculated μ:", mu1, "\n")
cat("Calculated κ:", kappa1, "\n")
cat("Regime: ")
if (mu1 > 1 && kappa1 > 1) cat("Growing\n") else if (mu1 > 1 && kappa1 <= 1) cat("K-saturation\n") else cat("M-saturation\n")
cat("β(K~M):", beta_km_1, "\n")
cat("β(N~M) (theoretical): NA (function not in R)\n")
cat("β(N~D_eq) (theoretical): NA (function not in R)\n")

cat("\n===== TEST SET 2: WBE Target Mode =====\n")
cat("Parameters: n=2, a=1.30, b=0.984\n\n")

n2 <- 2
a2 <- 1.30
b2 <- 0.984
mu2 <- n2 * a2 * (b2^2)
kappa2 <- n2 * (b2^4) / a2
beta_km_2 <- theoretical_mass_conductance_exponent(n2, a2, b2)

cat("Calculated μ:", mu2, "\n")
cat("Calculated κ:", kappa2, "\n")
cat("Regime: ")
if (mu2 > 1 && kappa2 > 1) cat("Growing\n") else if (mu2 > 1 && kappa2 <= 1) cat("K-saturation\n") else cat("M-saturation\n")
cat("β(K~M):", beta_km_2, "\n")
cat("Expected β(K~M):", log(kappa2) / log(mu2), "\n")
cat("β(N~M) (theoretical): NA (function not in R)\n")
cat("β(N~D_eq) (theoretical): NA (function not in R)\n")

cat("\n===== TEST SET 3: High-Branching =====\n")
cat("Parameters: n=3, a=0.80, b=0.75\n\n")

n3 <- 3
a3 <- 0.80
b3 <- 0.75
mu3 <- n3 * a3 * (b3^2)
kappa3 <- n3 * (b3^4) / a3
beta_km_3 <- theoretical_mass_conductance_exponent(n3, a3, b3)

cat("Calculated μ:", mu3, "\n")
cat("Calculated κ:", kappa3, "\n")
cat("Regime: ")
if (mu3 > 1 && kappa3 > 1) cat("Growing\n") else if (mu3 > 1 && kappa3 <= 1) cat("K-saturation\n") else cat("M-saturation\n")
cat("β(K~M):", beta_km_3, "\n")
cat("β(N~M) (theoretical): NA (function not in R)\n")
cat("β(N~D_eq) (theoretical): NA (function not in R)\n")
