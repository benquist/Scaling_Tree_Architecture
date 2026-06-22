plot_wbe_scaling_diagnostic <- function(diag_obj) {
  metrics <- diag_obj$metrics
  metrics$log_M_proxy <- log(metrics$M_proxy)
  metrics$log_K_proxy <- log(metrics$K_proxy)
  fit <- diag_obj$fit
  theory <- diag_obj$theoretical_exponent

  x_range <- range(metrics$log_M_proxy, na.rm = TRUE)
  x_mid <- mean(x_range)
  y_mid <- mean(metrics$log_K_proxy, na.rm = TRUE)

  intercept_fit <- y_mid - fit$estimate * x_mid
  intercept_theory <- y_mid - theory * x_mid

  ggplot2::ggplot(metrics, ggplot2::aes(x = metrics$log_M_proxy, y = metrics$log_K_proxy)) +
    ggplot2::geom_point(alpha = 0.45, color = "#155e75", size = 1.8) +
    ggplot2::geom_abline(
      slope = fit$estimate,
      intercept = intercept_fit,
      color = "#b45309",
      linewidth = 0.9
    ) +
    ggplot2::geom_abline(
      slope = theory,
      intercept = intercept_theory,
      color = "#7f1d1d",
      linetype = "dashed",
      linewidth = 0.9
    ) +
    ggplot2::labs(
      title = "WBE Scaling Diagnostic",
      subtitle = paste0(
        "Observed slope = ", round(fit$estimate, 3),
        " | Theory slope = ", round(theory, 3),
        " | Delta = ", round(diag_obj$delta_fit_minus_theory, 3)
      ),
      x = "log(Mass proxy)",
      y = "log(Conductance proxy)"
    ) +
    ggplot2::theme_minimal(base_size = 11)
}
