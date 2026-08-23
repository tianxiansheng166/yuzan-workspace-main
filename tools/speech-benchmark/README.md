# Speech benchmark harness

This is a DB-free harness for approved, consented speech samples. The tracked
example contains only synthetic references and fictional teacher labels:

```sh
pnpm speech:benchmark -- \
  --manifest tools/speech-benchmark/benchmark.example.json \
  --providers local,iflytek,tencent
```

The CLI reports provider skip/failure states, valid results, failure rate,
MAE/RMSE, Pearson/Spearman, tolerance bands, p50/p95 latency, and review rate.
Cloud credentials are checked by presence only. A future live runner must be
explicitly wired to approved audio; the harness never scans the database or
exports current student recordings.

Fewer than 30 real teacher-labelled samples produces
`INSUFFICIENT_CALIBRATION_DATA`. Any future candidate calibration is report-only
and does not activate runtime formal scoring.
