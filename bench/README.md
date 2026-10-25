# OpenFilter benchmark

`node bench/run.mjs` measures the same shopper scenarios on the fixture store with OpenFilter off (Magento's own layered navigation, Hyvä templates) and on, and writes `results/latest.json` and `results/latest.md`.

| Measure | How |
|---|---|
| Engine requests | OpenSearch `_nodes/stats` `query_total` around one uncached page load (the integration tests count the same way) |
| Server time | median of 11 uncached loads (a throwaway parameter skips Varnish and the page cache), full HTML body |
| Varnish | a scripted session of filter clicks; how many of a second shopper's pages Varnish answers |
| OpenFilter bytes | inline script and stylesheet on a filtered page, gzipped |

Since 1.2 the run also measures a path filter URL, the next page as *Load more* fetches it, and a landing page (each set up for the OpenFilter run only and removed afterwards), against Magento's equivalent page.

Scenarios use the URLs each mode understands (Magento: option ids, one value per filter) and their canonical spelling. Competitors are not installed (clean room); `openfilter/docs/benchmark.md` lists their documented public claims.

`BENCH_GATE=1` turns it into a gate: OpenFilter may not need more engine requests than Magento or add more than `BENCH_BUDGET_MS` (15) ms in any scenario. In CI it runs in the E2E workflow (`gh workflow run E2E -f bench=true`) and attaches the JSON.
