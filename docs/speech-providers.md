# Speech provider boundary

QB-009A adds backend-only `iflytek` and `tencent` adapters for Mandarin
sentence reading. `SPEECH_OPEN_RESPONSE` remains on the local diagnostic plus
teacher-review route.

The iFlytek adapter uses the streaming ISE WebSocket endpoint and its official
`ssb`/`auw` frames. The Tencent adapter uses the new SOE WebSocket endpoint and
the documented sorted-parameter HMAC-SHA1 signature. Both require normalized
16 kHz, 16-bit, mono audio and read reference text from the server-authoritative
assessment snapshot.

Environment variables are backend/Worker-only:

- `IFLYTEK_ISE_APP_ID`, `IFLYTEK_ISE_API_KEY`, `IFLYTEK_ISE_API_SECRET`
- `TENCENT_SOE_APP_ID`, `TENCENT_SOE_SECRET_ID`, `TENCENT_SOE_SECRET_KEY`

All provider results are `UNCALIBRATED`, `finalizable: false`, and
`NEEDS_REVIEW`. Vendor responses are retained only in the server-side SpeechJob
audit result; student payloads receive bounded canonical metrics with missing
dimensions represented as `null`.

## Benchmark

Use the tracked synthetic example to verify the harness without a database or
cloud credentials:

```sh
pnpm speech:benchmark -- \
  --manifest tools/speech-benchmark/benchmark.example.json \
  --providers local,iflytek,tencent
```

Approved live samples require an explicit `--live` run and an external manifest;
the harness never scans or exports database recordings. Generated benchmark and
calibration artifacts belong under the ignored
`local_sources/speech-benchmark/.generated/` directory. Fewer than 30 real
teacher-labelled samples produces `INSUFFICIENT_CALIBRATION_DATA`; no report
activates formal runtime scoring.

Protocol authorities: [iFlytek streaming ISE API](https://www.xfyun.cn/doc/Ise/IseAPI.html)
and [Tencent SOE-new API](https://cloud.tencent.com/document/product/1774/107497).
