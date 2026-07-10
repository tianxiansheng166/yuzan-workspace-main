# QA-003 Performance Review

## Available measurements

Production build, generated client/server asset inventory, public-asset sizes, HTTP route responses, console build output, and static request boundaries are the available evidence on VM1. Public art contains no large checked-in image payload; the directory currently contains only its placeholder.

The generated Nitro server output is 2.76 MB (718 kB gzip). The client manifest is 27.50 kB (2.67 kB gzip); route CSS chunks observed in build output range from 0.34 kB to 9.29 kB, and visible route JS chunks are individually small. No source-level evidence of autoplay media was found. Demo fixtures are TypeScript data modules rather than large binary payloads.

All nine core production deep links returned HTTP 200. Sampled HTML-referenced `_nuxt` JS/CSS resources returned HTTP 200, and Nitro SSR logs showed no rendering errors during the route sweep.

## Browser limitation

`PERFORMANCE_BROWSER_MEASUREMENT_BLOCKED`: no Playwright, Lighthouse, or Chromium executable is available, and QA-003 may not add dependencies or modify root configuration. Therefore LCP, CLS, INP, network waterfalls, route-transition timing, hydration layout shift, runtime console errors, runtime 404s, and reduced-motion runtime behavior were not assigned pass results.

## Follow-up measurements

Run the same QA branch on a browser-capable runner. Capture per-route JS/CSS transfer sizes, console and request failures, layout shift during hydration, long-list interaction latency on teacher review/report routes, and Lighthouse diagnostics at 390x844 and 1440x900. Treat scores as supporting evidence, not the sole verdict.
