#!/usr/bin/env python3
"""Reproducible synthetic HUMANIE forecasting-method benchmark.

Run from repository root: python scripts/forecast_backtest.py
Seeded synthetic series; results are a method demonstration only.
"""
import numpy as np
from sklearn.linear_model import LinearRegression

SEED = 42
N_WEEKS = 104
HOLDOUT = 20
WINDOW = 12
SEASONAL_LAG = 52
INTERVAL_Z = 1.2816  # nominal central 80% under a normal-error assumption

rng = np.random.default_rng(SEED)
t = np.arange(N_WEEKS)
y = (
    120 + 0.25 * t
    + 12 * np.sin(2 * np.pi * t / 52)
    + 4 * np.sin(2 * np.pi * t / 13)
    + rng.normal(0, 5, N_WEEKS)
)

start = N_WEEKS - HOLDOUT
actual = y[start:]
trend_predictions, seasonal_predictions, intervals = [], [], []
x_window = np.arange(WINDOW).reshape(-1, 1)

for i in range(start, N_WEEKS):
    window = y[i-WINDOW:i]
    model = LinearRegression().fit(x_window, window)
    forecast = float(model.predict(np.array([[WINDOW]]))[0])
    residuals = window - model.predict(x_window)
    residual_sd = float(np.std(residuals, ddof=1))
    trend_predictions.append(forecast)
    seasonal_predictions.append(float(y[i-SEASONAL_LAG]))
    intervals.append((forecast - INTERVAL_Z * residual_sd,
                     forecast + INTERVAL_Z * residual_sd))

def score(predictions):
    errors = np.abs(actual - np.asarray(predictions))
    mae = float(np.mean(errors))
    wape = float(np.sum(errors) / np.sum(np.abs(actual)) * 100)
    return mae, wape

trend_mae, trend_wape = score(trend_predictions)
seasonal_mae, seasonal_wape = score(seasonal_predictions)
intervals = np.asarray(intervals)
coverage = float(np.mean((actual >= intervals[:, 0]) & (actual <= intervals[:, 1])) * 100)
improvement = (seasonal_wape - trend_wape) / seasonal_wape * 100

print(f"seed={SEED}; series={N_WEEKS}; train={start}; holdout={HOLDOUT}; window={WINDOW}")
print(f"Rolling trend: MAE={trend_mae:.2f}; WAPE={trend_wape:.2f}%")
print(f"Seasonal-naive (lag {SEASONAL_LAG}): MAE={seasonal_mae:.2f}; WAPE={seasonal_wape:.2f}%")
print(f"Relative WAPE reduction vs baseline={improvement:.2f}%")
print(f"Nominal 80% interval observed coverage={coverage:.0f}% ({int(coverage/100*HOLDOUT)}/{HOLDOUT})")
print("Coverage is descriptive on a small synthetic holdout; interval calibration is not established.")
