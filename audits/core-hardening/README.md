# Core hardening observations

These are audit probes, not production acceptance tests or approval of new
semantics. They leave `src/`, the legacy checkout, specifications, and historical
characterization artifacts unchanged. The production probe needs no legacy repo.

Run with the project's supported Node version:

```sh
node audits/core-hardening/probes.js
node audits/core-hardening/legacy-probes.js
```

The first script captures 49 production observations and checks selected observed
relationships. The second captures 21 read-only legacy observations using the
existing legacy helper and v3 Sass dependency. Diagnostics and warnings remain
visible. Successful completion alone does not approve any captured behavior:
expected errors are recorded alongside successful output for review.

Sources and exact CSS/errors are written to ignored
`tmp/core-hardening/production.json` and `tmp/core-hardening/legacy.json`.
No approved snapshots are created or updated. Read the decision-oriented report
in [CORE-HARDENING-v3.md](../../docs/CORE-HARDENING-v3.md).
