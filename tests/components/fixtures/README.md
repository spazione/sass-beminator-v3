# Button compatibility evidence

`_maps.scss` and `representative.css` are preserved from the completed Button
spike. The maps are legacy example data, not production tokens. The CSS was
captured from v2, never generated from the promoted implementation.
`representative.scss` now imports the maintained component.

`compatibility.json` captures v2 output for the eleven already-tested, approved
spike cases defined in `../support.js`. It was captured during promotion with
Dart Sass 1.104.1 using `helpers/legacy.js`. The representative entry equals the
original CSS byte-for-byte. Additional cases preserve size/category selection,
map ordering, absent shared and all icon flag/alignment branches, allowing
normal tests to run without v2. No new behavior is approved by these captures.

Tests never regenerate evidence. Live legacy tests verify these captures exactly
and compare promoted output using only the established rule-boundary blank-line
normalization. Review any future evidence change explicitly; never update it
from component output merely to pass tests.
