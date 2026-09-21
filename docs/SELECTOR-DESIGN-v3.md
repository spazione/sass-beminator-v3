# Structural selector design: approved production model

## Maintainer approval and production stabilization

The experimental single-simple-selector recommendation is **superseded**:
legacy `selector(':placeholder:hover')` usage requires compound qualifiers.
Production now supports **one compound containing one or more simple qualifiers**,
all non-functional pseudos or attributes. Multiple tokens in one call are not
selector-context chaining. The original experiment below remains historical
feasibility evidence, including its deliberately different classifier and chaining
probe; its tests are unchanged and do not define the production contract.

The approved classifier:

1. Require a Sass string; recognize exact `+`, `>`, `~` as pending relations.
2. Otherwise use `selector.parse()` to require one complex selector and one compound.
3. Use `selector.simple-selectors()` to extract **one or more** simple tokens.
4. Check **every** normalized token: leading `:` without `(`, or leading `[`. Reject
   other families; defer functional pseudos without interpreting their arguments.
5. Append the parsed compound to the current subject with `selector.append()`.

There is no pseudo-name whitelist and no handwritten attribute grammar. Attribute
punctuation is never scanned as pseudo/combinator syntax. This is a conservative
family boundary over Sass's parser, not a full typed AST or browser validator.

| Approved family | Parents / children | Examples |
| --- | --- | --- |
| Qualified compound | block, element, modifier parents; declaration bodies | `:hover`, `::before`, `[disabled]`, `:hover:focus`, `:placeholder:hover`, `:focus::before`, `[disabled]:hover`, `[data-state="open"]:focus`, `:hover[aria-expanded="true"]` |
| Pending relation | element parent, element children | `+`, `>`, `~` |

Qualification changes the subject only; owner, scope, and extend ancestry survive.
This includes ordinary element descendants of extend. `:before` keeps its spelling,
while Sass may normalize quoting/escapes. Unknown non-functional pseudos may pass;
browser support, applicability, meaningful combinations, and pseudo-element
ordering across CSS specifications remain consumer concerns.

A pending frame stores its relation as immutable data. The RHS element uses the
same owner, including inside nested blocks and extend descendants. Multiple RHS
siblings resolve independently, RHS modifiers work normally, and empty branches
emit nothing. Direct declarations retain the existing Sass style-rule error.

**Deferred:** nested selector → selector calls, all public BEM children of qualified
contexts, unapproved pending parents/children, and all functional pseudos (including
`:nth-child(...)` and mixed compounds containing functions). BEM-aware functional
selectors require a separate future API-design phase. No API for them is proposed.
Class/type/ID/universal/placeholder targets, parent references, lists, complex
selectors, and other relation strings remain outside the approved subset.

Production keeps exactly **one private mutable context stack**, **one emission
boundary**, pure derivation, and centralized restoration. It stores no qualifier
history after subject composition. The five public signatures remain unchanged.
Separators and CSS Layers are not implemented by this change.

See [SPEC-v3](SPEC-v3.md#selector) for the normative contract and
[production documentation](PRODUCTION-v3.md#selector-forms-and-declarations) for usage.



Structural-selector stabilization validation: **139 production tests** (39 added),
**42 original spike tests** (27 selector-engine + 15 context-stack), **16 unchanged
structural experiment tests**, and **201 combined project tests** pass on Node
22.19.0 / Dart Sass 1.104.1. Production, both original spikes, the structural
experiment, characterization, normal project, and legacy commands all pass.
Detailed runs disable Node test-process isolation to report individual test
counts rather than file totals. Logs are `tmp/structural-selector-*.log`;
production detail is `tmp/structural-production-initial.log`.

Source/API guards confirm **one mutable module global**, **one emission boundary**,
and exactly five public mixins with no public functions or variables. Existing
block/element/modifier/extend outputs and original `:before`/`+` output regressions
remain green. Six hardening groups remain open; no separator configuration,
CSS Layers, functional pseudo API, or selector-context chaining was implemented.

---

## Original experimental report — historical, not the production contract

The following recommendation was written before maintainer approval. References
to “current production”, “one simple selector”, or future approval below describe
that earlier phase. In particular, single-token rejection and experimental chaining
are **not** the current production policy.

**Recommendation:** a small structural model can replace value-specific `before`
and `adjacent` provenance. Use **qualified** contexts for one simple non-functional
pseudo or attribute qualifier, and **pending-relation** contexts for a selected
combinator stored as immutable data. Keep pure construction, one private mutable
stack, centralized restoration, and one emission boundary.

This is a recommendation for a future approval, **not a production change**.
Production still accepts only `:before` and `+` with its existing parent rules.
No exports, specification semantics, separator configuration, layers, or functional
selector APIs changed. The [disposable proof](../spikes/selector-structure/README.md)
uses Dart Sass 1.104.1 / Node 22.19.0. All CSS below is experimental evidence.
Browser matching/support was not tested.

## 1. Structural families and context facts

| Family | Meaning | Examples | Owner/scope consequence |
| --- | --- | --- | --- |
| Qualified subject | Append one qualifier to the current subject compound | `:hover`, `:before`, `::after`, `[disabled]` | Owner and scope retained; subject becomes qualified |
| Pending relation | Retain a complete left selector until a right-hand BEM target exists | `+`, `>`, `~` | Owner retained; right element supplies owner-based subject; scope becomes `(complete-left, relation)` |
| Arbitrary simple target | Syntactically simple, but not a qualifier in this proposed API | `.foo`, `#id`, `*`, `%placeholder` | Excluded; changing/adding a class is a separate semantic choice |
| Compound/list/complex input | Multiple simple selectors, alternatives, or extra relationships | `:hover:focus`, `:hover, :focus`, `.foo .bar` | Excluded from one-call qualifier input |
| Functional pseudo | Parameterized selector or other function-like condition | `:has(...)`, `:not(...)`, `:is(...)`, `:where(...)`, `:nth-child(...)` | Deferred; no BEM interpretation of arguments |

The proof retains the five justified context facts: `owner`, `subject`, `scope`,
`kind`, `under-extend`. A pending frame adds only `relation`, an immutable string.
It retains the left subject/scope; the relation is not emitted without a right
subject. A qualified frame changes `kind` and `subject`, inheriting other facts.

A stored `selector-value` is **not necessary** after successful qualification:
the parsed input is used transiently during pure derivation, and the qualified
subject already holds the result. Avoid storing duplicate selector history just
to rename kinds. A future chaining policy may justify additional immutable
provenance, but no such production field is proposed here.

Every child goes through the same entry boundary. The stack is saved locally,
the child is pushed, content is emitted/run, and the exact prior list restored.
The proof asserts stack equality and selected depths. It has exactly **one
mutable module global**, two centralized stack writes, and **one `@at-root`
boundary**. All ancestry/selector facts are immutable values; none becomes a
consumer context token.

## 2. Useful Sass primitives and their limits

The official [Sass selector reference](https://sass-lang.com/documentation/modules/selector/)
describes selector values as lists of complex selectors containing compound
strings. `parse()` provides that shape; `simple-selectors()` decomposes a compound
into simple-selector strings. `append()` composes without descendant whitespace;
`nest()` composes selector operands. Those primitives suffice for the experiment.

| Primitive | Role demonstrated by the probe |
| --- | --- |
| `selector.parse()` | Distinguish one complex selector from a list and expose complex operands |
| `selector.simple-selectors()` | Distinguish one simple selector from a multi-simple compound |
| `sass:list` | Inspect cardinality and preserve selector operands as values |
| `selector.append()` | Append a parsed qualifier to the subject only |
| `selector.nest()` | Resolve `(complete-left, combinator, right-subject)` |
| `sass:map` | Derive new immutable frames and attach relation data |
| `sass:string` | Small checks on normalized simple-selector tokens where Sass exposes no typed discriminator |
| `@at-root` | Reuse the existing full-selector emission/pending-content boundary |

The public Sass module does not expose a typed selector AST or predicates such
as “is attribute”, “is pseudo-element”, or “is non-functional pseudo”. Simple
selectors are strings, including an entire `:has(.foo)` token. This is a limit
of the available introspection, not a reason to introduce a private CSS parser.
No selector unification, replacement, extension, or parsing of emitted BEM CSS
is needed. All structure inspection is of the caller's proposed selector input;
BEM provenance continues to come from context values.

## 3. Can the per-token whitelist go away?

**Yes for construction and a conservative syntax-family boundary; no for a
promise that every accepted pseudo name/combination is browser-valid.**

The executable classifier follows this order:

1. Require a Sass string.
2. Recognize exact relation strings `+`, `>`, `~` as pending-relation data.
3. Otherwise call `selector.parse()` and require exactly one complex selector
   containing exactly one compound operand.
4. Call `selector.simple-selectors()` on that compound; require exactly one simple
   selector. Sass owns parsing of quoting, escapes, commas, and attribute contents.
5. Inspect that parser-normalized token: a leading `:` with no `(` is a candidate
   non-functional pseudo qualifier; a leading `[` is a candidate attribute
   qualifier. Everything else is excluded.

The last step is a small lexical family check, **not** a fully typed structural
API from Sass. The `(` check is applied only to normalized pseudo tokens, never
to the whole raw input or to attributes. It deliberately excludes functional
pseudos rather than parsing arguments. No regex CSS grammar is implemented.
Pathological escaped pseudo names containing a literal parenthesis may also be
excluded conservatively; general escape completeness is not promised.

There is no chain of name-specific `:hover`/`:focus`/`:active` cases. A finite
combinator set remains appropriate: relation tokens are operators with explicitly
selected semantics, not an open-ended pseudo-name registry. Blank descendant
operators, `||`, and composed operator strings are outside this experiment.

Observed counterexamples show why “Sass accepts it” is insufficient:

| Input | Sass observation | Conservative family result |
| --- | --- | --- |
| `.foo` | One simple selector; append makes `.card__item.foo` | Exclude class selector |
| `.foo .bar` | Two complex operands; append makes `.card__item.foo .bar` | Exclude complex selector |
| `.theme &`, `&:hover` | `parse()` rejects parent selectors | Exclude, compiler diagnostic |
| `:hover:focus` | One compound but two simple tokens | Exclude multiple qualifiers in one input |
| `:hover, :focus` | Two complex selectors | Exclude selector list |
| `button:hover` | Two simple tokens; direct append can produce `.card__itembutton:hover` | Exclude type/compound input |
| `:has(.foo)` / other functions | Each can be one simple token and append successfully | Defer based on function syntax, not list length |
| Escaped `:h\61 s(.foo)` | Normalizes to `:has(.foo)` | Still deferred; escape does not bypass the gate |
| `:made-up`, `::made-up` | Parse and append successfully | Syntax-family classifier accepts; browser validity is not established |
| `%placeholder` | Parse succeeds; resulting placeholder rule can emit no CSS | Exclude |
| Malformed `[broken` | Parser error | Exclude, compiler diagnostic |

The unknown-pseudo case is the key tradeoff. If maintainers require BEMinator to
reject every nonexistent/unsupported pseudo, a maintained vocabulary or external
CSS semantic validator is needed. Recommend a documented syntax-only qualifier
contract with consumer responsibility for pseudo validity, rather than pretending
Sass's parser provides that guarantee.

## 4. Block qualification

All nine requested pseudo forms were tested under a block:
`:hover`, `:focus`, `:focus-visible`, `:active`, `:disabled`, `:before`, `:after`,
`::before`, `::after`. They yield `.button` followed by that qualifier, e.g.
`.button:hover`. The owner stays `.button`; no element naming is inferred from
qualified CSS. Single-colon `:before` remains single-colon; the supplied double
colon remains double-colon. No specificity wrapper is introduced.

Both attribute examples also work on the same subject. Production block →
selector is currently deferred. This is positive feasibility evidence for a
future narrow parent-rule expansion, not permission to use it today.

## 5. Element and modifier qualification

The same nine pseudo forms and two attributes were tested against element
`.card__button` and modified element `.card__button--active`. Examples:

```css
.card__button:focus-visible
.card__button--active:hover
.card__button--active[disabled]
```

A double modifier beneath a nested component emits:

```css
.page .card--a.card--b:hover
```

The qualifier is appended once to the current compound, not once per modifier
class and not to the outer scope. The existing subject/scope separation makes
this ordinary pure derivation. Siblings emitted afterwards still target the
unqualified parent. Qualified contexts are not inferred by inspecting `&`.

## 6. Extend-descendant qualification

The nine pseudo forms and both attributes were also applied under
`block('card') → extend('icon', 'large') → element('label')`:

```css
.card .icon--large .icon__label:hover
.card .icon--large .icon__label[disabled]
```

The owner remains `icon`, the extend modifier remains ancestor scope, and neither
is duplicated. Extend ancestry is inherited through generic qualified and pending
frames. Attempts to enter a block beneath either family still fail the ancestry
check. This does not propose direct extend → qualifier: only an already-valid
element descendant supplies the parent in these tests.

Together, sections 4–6 account for **44 exact qualifier/context outputs**
(11 qualifiers × 4 contexts), checked against literal expected CSS rule selectors
and declarations. They are experimental expectations, not added SPEC-v3 cases.

## 7. Pending `+`, `>`, and `~`

All three work with one `kind: pending-relation` path and actual operator data:

```css
.card__item + .card__other
.card__item > .card__other
.card__item ~ .card__other
```

In a nested block, the corresponding left scope is retained, for example:

```css
.page .card__item > .card__other
.page .card__item ~ .card__next--active
```

Under extend, the experiment emits
`.card .icon--large .icon__label > .icon__other` (and the `+`/`~` counterparts).
The right element uses the same owner, not the left element as a new naming base.
Its modifier qualifies only the right subject. Multiple right-hand siblings each
resolve from the unchanged pending frame.

`selector.nest()` constructs the complete relation when both targets exist.
Although Sass can represent a bare combinator as a parse result, it is not a
compound/simple selector or a complete emitted target. The proof never emits it.
Empty pending branches emit nothing. Direct declarations fail with the same Sass
style-rule diagnostic used by production `+`. After each relation closes, later
modifier/element siblings derive from their original parent; repeated roots start
empty. Relations were exercised both unscoped and beneath a nested block.

This supports a common mechanism. Approving direct-child or general-sibling
matching is still a public semantic decision. Recommend retaining element as the
left public parent and element as the resolving child initially; no block RHS,
relation chaining, or relations under arbitrary qualifiers are proposed.

## 8. Attribute qualifiers

`[disabled]` and `[data-state='open']` are single simple selectors and append
without new ownership, scope, or mutable state. They naturally share qualified
context derivation with pseudos. Sass serializes the latter as `[data-state=open]`;
quote fidelity is not guaranteed even though the attribute value is unchanged.

An adversarial literal value, `[data-note=':has(.x), > (']`, remains one attribute
selector, including its literal punctuation. It passes the family classifier;
its contents are not interpreted as a deferred function or combinator. This
illustrates why parsing through Sass is preferable to scanning raw input for
parentheses/commas/whitespace.

No additional architecture is required. A potential contract of “one parsed
attribute selector” delegates attribute grammar to Sass rather than implementing
its operators, quoting, flags, or namespaces in BEMinator. Only the examples and
literal-punctuation case were exercised here; no broader browser compatibility
or namespace contract is established. If a narrower attribute operator policy is
required, Sass does not expose typed attribute fields for implementing it cleanly.

## 9. Chaining: easy construction, unresolved validity

The proof permits qualified → qualified solely to investigate chaining. It
constructs left-to-right:

| Calls | Result |
| --- | --- |
| `:hover` → `:before` | `.card:hover:before` |
| `[disabled]` → `:focus` (primitive probe) | `.card[disabled]:focus` |
| modified element → `:hover` | `.card__button--active:hover` |
| `::before` → `::after` (primitive probe) | `.card::before::after` |
| `:before` → `:hover` (primitive probe) | `.card:before:hover` |

The last two are evidence of Sass's willingness to construct strings, not proof
of browser-valid or useful combinations. Ordering, pseudo-element targeting,
legacy single-colon pseudo-element spellings, and impossible state combinations
cannot be validated merely by counting simple selectors. Sass does not report
pseudo-class versus pseudo-element type; even a colon-count rule would miss
legacy `:before`/`:after` semantics.

**Recommend deferring selector-to-selector chaining initially**, despite its
straightforward immutable implementation. Declaration-only qualified bodies
avoid committing to a subtype/pseudo-order policy now. Qualifiers under modifier
are independently useful and do not require chaining approval. Do not infer
qualified → modifier or qualified → element semantics from successful append.

## 10. Remaining boundaries and risks

- The classifier enforces a conservative syntax family, not a full CSS semantic
  validator. Unknown pseudo names and element applicability remain caller concerns
  under the recommended contract.
- All functional pseudos, including static arguments and `:nth-child(...)`, remain
  deferred. A parser treating one as a simple token is not API approval. No `ref`,
  `has-element`, BEM-target argument, or public selector AST is introduced.
- Attribute text can contain selector-like punctuation without becoming a BEM
  reference. No dynamic owner interpretation occurs inside it.
- Sass normalizes some escapes, comments, and attribute quoting; preserve tested
  `:before`/`::before` spelling, not arbitrary source serialization fidelity.
- The existing raw-Sass boundary caveats remain. A raw `&` rule can use Sass's
  lexical parent, and raw selectors surrounding BEM calls do not automatically
  become BEM scope. This spike does not make qualified/pending content a sandbox
  or inspect arbitrary content ASTs. See [the hardening report](CORE-HARDENING-v3.md).
- Browser support, pseudo-element chaining, arbitrary selector lists, namespaces,
  untested attribute forms, and diagnostics for malformed syntax need explicit
  policy if later included. No regex-based CSS parser is recommended.
- The pure classifier is a disposable candidate, not a production-ready guarantee
  covering every adversarial CSS spelling or every future Dart Sass version.

## 11. Smallest useful recommended contract for review

Approve nothing automatically from this experiment. The proposed next contract is:

1. Keep `selector($name)` with one string argument and context-free nested use.
2. Support one non-functional pseudo selector or one parsed attribute selector
   as a **qualified subject**. Use Sass parsing/cardinality plus the conservative
   token-family gate; do not maintain a pseudo-name whitelist or promise browser
   validity. Initially allow block, element, and modifier parents, including
   valid element descendants of extend. Qualified bodies contain declarations;
   additional public core children remain deferred.
3. Support exact `+`, `>`, and `~` as **pending relations**, with element parent
   and element child. Keep direct-declaration rejection and ordinary right-element
   behavior, ownership, and ancestry validation.
4. Exclude class/type/ID/placeholder inputs, selector lists, complex selectors,
   multi-qualifier single strings, parent references, and other relation strings.
5. Keep functional pseudos and qualifier chaining deferred. Do not widen raw-Sass
   integration, layers, or configuration as part of this decision.

The main maintainer choices are whether to accept this syntax-only qualifier
boundary (including unknown pseudo names), which newly probed parents/operators
and attributes to approve, and whether chaining should remain deferred as
recommended. If strict known-pseudo validation is required, retain a deliberate
vocabulary rather than claiming the Sass primitives can supply it automatically.

Production can adopt structural kinds later without another mutable global or a
change in context transport. Approval would still require a separate production
implementation task and new production expectations. This report stops for review.

Validation completed: `npm run test:production`, `npm test`,
`npm run test:characterization`, `npm run test:legacy`, and both existing spike
suites pass. Existing counts are unchanged: **100 production tests**, **42 existing
spike tests** (27 selector-engine + 15 context-stack), and **162 combined project
tests**. The separate new structural suite passes **16 experimental tests**;
it is not added to production or original spike commands. The primitive inspector
records **49 observations** (42 individual inputs, 3 relations, 4 chains), with
errors retained. Logs are `tmp/selector-design-*.log` and
`tmp/selector-structure-*.log`; generated observations/CSS are in
`tmp/selector-structure/`. Source inspection confirms no changes to production,
existing suites, SPEC-v3, dependencies, or historical artifacts. The only added
files are this report and the disposable `spikes/selector-structure/` experiment.
