Benchmark 2026-10-15T01:40:20.051Z · Magento CLI 2.4.9 · https://app.openfilter.test · median of 11 uncached loads

| Scenario | Magento: engine requests · server time | OpenFilter: engine requests · server time |
|---|---|---|
| category page | 4 · 189.2 ms | 1 · 171.2 ms |
| one filter | 4 · 172.9 ms | 1 · 170.7 ms |
| three filters | 4 · 159.2 ms | 1 · 160.2 ms |
| two values of one filter | not possible | 1 · 175.3 ms |
| search page | 4 · 168.7 ms | 1 · 159.8 ms |
| search with a filter | 4 · 170 ms | 1 · 164.5 ms |
| second shopper's clicks served by Varnish | 5 of 5 | 6 of 6 |

OpenFilter's own bytes on a filtered page: script 6120 B, stylesheet 2951 B (gzipped).
