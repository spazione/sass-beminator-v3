// Diagnostic spike only. Never writes src/ or the legacy checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
import { cpus, loadavg } from 'node:os';
import * as sass from 'sass';
import { projectRoot, requireLegacyRoot } from '../helpers/project-paths.js';
assert.equal(process.versions.node, '22.19.0');
assert.match(sass.info, /^dart-sass\s+1\.104\.1\s/m);
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  assert.match(arg, /^--[\w-]+=.+$/); const i = arg.indexOf('='); return [arg.slice(2,i),arg.slice(i+1)];
}));
for (const key of Object.keys(args)) assert.ok(['group','scale','scenario','tag'].includes(key));
const corePath = join(projectRoot, 'src/core/_bem.scss');
const core = readFileSync(corePath, 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const harness = readFileSync(join(projectRoot, 'benchmarks/compile-performance.mjs'), 'utf8');
const from = harness.indexOf('const wrap = '), to = harness.indexOf('const output = ');
assert.ok(from > 0 && to > from);
const { workload, flatRules, stats } = runInNewContext(harness.slice(from,to)+'\n({workload,flatRules,stats})',{assert});
const output = join(projectRoot, 'tmp/benchmarks/performance-decomposition');
mkdirSync(output, {recursive:true});
function replace(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected unique replacement: ${before}`);
  return source.replace(before,after);
}
function body(source, name, replacement, kind='function') {
  const start = source.indexOf(`@${kind} ${name}(`); assert.ok(start>=0);
  const open = source.indexOf('{',start), close = source.indexOf('\n}',open); assert.ok(close>open);
  return source.slice(0,open+1)+'\n'+replacement+'\n'+source.slice(close);
}
const allowed = core.match(/  \$allowed: \(root:[\s\S]*?extend: \(element,\)\);/)[0];
const staticMap = source => replace(replace(source,allowed,''),
  '@function -validate($parent, $kind) {',
  allowed.trim().replace('$allowed:', '$-allowed-transitions:')+'\n\n@function -validate($parent, $kind) {')
  .replace('map.get($allowed, $parent-kind)', 'map.get($-allowed-transitions, $parent-kind)');
const nameBody = core.slice(core.indexOf('@function -name('), core.indexOf('// Parse caller input only.'));
const typeChecks = nameBody.slice(nameBody.indexOf('  @if'), nameBody.indexOf('  $letters:'));
const firstChecks = nameBody.slice(nameBody.indexOf('  @if'), nameBody.indexOf('  @for'));
const nameHoist = source => {
  const full = source.slice(source.indexOf('@function -name('), source.indexOf('// Parse caller input only.'));
  const next = full.replace('  @for $index', "  $characters: $letters + '0123456789-';\n  @for $index")
    .replace("string.index($letters + '0123456789-',", 'string.index($characters,');
  return replace(source,full,next);
};
const nameEquivalent = source => {
  const hoisted = nameHoist(source);
  const full = hoisted.slice(hoisted.indexOf('@function -name('), hoisted.indexOf('// Parse caller input only.'));
  const next = full.replace('  @for $index from 1 through string.length($name) {',
    '  $length: string.length($name);\n  @if $length > 1 {\n  @for $index from 2 through $length {')
    .replace('  @return $name;', '  }\n  @return $name;');
  return replace(hoisted,full,next);
};
const nameSplit = source => {
  const full = source.slice(source.indexOf('@function -name('), source.indexOf('// Parse caller input only.'));
  const next = full.replace('  @for $index from 1 through string.length($name) {',
    "  @each $character in string.split($name, '') {")
    .replace("string.index($letters + '0123456789-', string.slice($name, $index, $index))",
      "string.index('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789-', $character)");
  return replace(source,full,next);
};
const rootLiteral = '(owner: null, subject: null, scope: (), kind: root, under-extend: false)';
const rootConstant = source => replace(source,'$-context-stack: ();',
  `$-root-context: ${rootLiteral};\n$-context-stack: ();`).replace(`@return ${rootLiteral};`,'@return $-root-context;');
const appendStrings = source => source
  .replace("selector.append($owner, '#{$element-separator}#{$name}')", "'#{$owner}#{$element-separator}#{$name}'")
  .replace("selector.append($subject, '#{$modifier-separator}#{$first}')", "'#{$subject}#{$modifier-separator}#{$first}'");
const noNest = source => body(source,'-complete-selector','  @return map.get($context, subject);');
const tupleContext = source => {
  let next = source.replace(rootLiteral,'(null, null, (), root, false)')
    .replace('(owner: $owner, subject: $subject, scope: $scope, kind: $kind,\n    under-extend: map.get($parent, under-extend) or $kind == extend)',
      '($owner, $subject, $scope, $kind, map.get($parent, under-extend) or $kind == extend)')
    .replace('map.set($child, relation, $name)', 'list.append($child, $name, comma)');
  for (const [index, field] of ['owner','subject','scope','kind','under-extend','relation'].entries()) {
    next = next.replaceAll(new RegExp(`map.get\\(\\$(parent|context), ${field}\\)`, 'g'),
      (_, variable) => `list.nth($${variable}, ${index+1})`);
  }
  return next;
};
const enterStart = core.indexOf('@mixin -enter(');
const enterOpen = core.indexOf('{', enterStart);
const enterBody = core.slice(enterOpen + 1, core.indexOf('\n}', enterOpen));
let publicDirect = body(core, 'block', '$kind: block; $first: null; $second: null;'+enterBody, 'mixin');
publicDirect = body(publicDirect, 'element', '$kind: element; $first: null; $second: null;'+enterBody, 'mixin');
publicDirect = body(publicDirect, 'modifier', '$kind: modifier; $name: $mod1; $first: $mod2; $second: null;'+enterBody, 'mixin');
const variants = {
  stock: {source:core, label:'production control'},
  'public-direct': {source:publicDirect,label:'diagnostic lower bound only; common lifecycle copied into public mixins, remove enter dispatch/content forwarding'},
  'static-map': {source:staticMap(core), label:'equivalent validation'},
  'no-relationship': {source:body(core,'-validate','  @return $parent;'), label:'diagnostic lower bound only'},
  'name-type': {source:body(core,'-name',typeChecks+'  @return $name;'), label:'diagnostic lower bound only'},
  'name-first': {source:body(core,'-name',firstChecks+'  @return $name;'), label:'diagnostic lower bound only'},
  'name-bypass': {source:body(core,'-name','  @return $name;'), label:'diagnostic lower bound only'},
  'name-hoist': {source:nameHoist(core), label:'equivalent validation; hoist character alphabet per name'},
  'name-equivalent': {source:nameEquivalent(core), label:'equivalent validation; hoist alphabet and skip already-checked first character'},
  'name-split': {source:nameSplit(core), label:'equivalent validation; iterate string.split characters with literal alphabet'},
  'name-slices-only': {source:body(core,'-name',firstChecks+
    '  @for $index from 1 through string.length($name) { $character: string.slice($name, $index, $index); }\n  @return $name;'),label:'diagnostic lower bound only; retain loop and slices, remove per-character membership and concatenation'},
  'name-loop-only': {source:body(core,'-name',firstChecks+
    '  @for $index from 1 through string.length($name) { $character: $index; }\n  @return $name;'),label:'diagnostic lower bound only; retain numeric loop with local assignment'},
  'root-constant': {source:rootConstant(core), label:'equivalent immutable root context'},
  'tuple-context': {source:tupleContext(core),label:'diagnostic lower bound only; positional context construction and access instead of maps'},
  'minimal-map': {source:core.replaceAll(/map.get\(\$(parent|context), scope\)/g,'()')
    .replaceAll(/map.get\(\$parent, under-extend\)/g,'false')
    .replace('subject: null, scope: (), kind: root, under-extend: false','subject: null, kind: root')
    .replace('subject: $subject, scope: $scope, kind: $kind,\n    under-extend: false or $kind == extend','subject: $subject, kind: $kind'), label:'diagnostic lower bound only; removes two fields and their reads, common only'},
  'stack-singleton': {source:replace(core,'list.append($-context-stack, $context, comma)', '($context,)'),label:'diagnostic lower bound only; retain latest frame, local saved stack restores parents'},
  'stack-pointer': {source:body(replace(replace(core,'$-context-stack: ();','$-context-stack: null;'),
    'list.append($-context-stack, $context, comma)','$context'), '-current-context',
    `  @if $-context-stack == null { @return ${rootLiteral}; }\n  @return $-context-stack;`),label:'diagnostic lower bound only; single current frame with lexical restoration'},
  'inline-stack': {source:replace(replace(core,'@include -push-context($child);',
    '$-context-stack: list.append($-context-stack, $child, comma) !global;'),
    '@include -restore-context($previous);','$-context-stack: $previous !global;'),label:'equivalent push/restore operations, remove mixin dispatch'},
  'append-strings': {source:appendStrings(core),label:'diagnostic lower bound only; simple common selectors'},
  'no-nest': {source:noNest(core),label:'diagnostic lower bound only; common empty scope'},
  'all-selector-strings': {source:noNest(appendStrings(core)).replace("selector.parse('.#{$name}')","'.#{$name}'"),label:'diagnostic lower bound only; common simple classes, no selector APIs'},
  'literal-separators': {source:core.replaceAll('#{$element-separator}','__').replaceAll('#{$modifier-separator}','--'),label:'diagnostic lower bound only; default configuration'},
  'leaf-emission': {source:replace(core,'  @at-root {\n    @if $kind == pending-relation {',
    "  $diagnostic-target: -complete-selector($child);\n  @if $kind == block or ($kind == element and $name == 'title') { @content; } @else {\n  @at-root {\n    @if $kind == pending-relation {")
    .replace('#{-complete-selector($child)}', '#{$diagnostic-target}')
    .replace('  @include -restore-context($previous);','  }\n  @include -restore-context($previous);'),label:'diagnostic lower bound only; skip two empty rule/emission boundaries in common'},
};
// Combined membership is deliberately fixed after inspecting individual results.
variants.combined = {source:nameSplit(staticMap(core)),label:'equivalent static transition map plus string.split name validator'};
const groups = {
  relationship:['stock','static-map','no-relationship'],
  dispatch:['stock','public-direct'],
  names:['stock','name-first','name-type','name-bypass','name-hoist','name-equivalent'],
  'name-alternative':['stock','name-split','name-slices-only','name-loop-only','name-bypass'],
  context:['stock','root-constant','minimal-map','tuple-context','stack-singleton','stack-pointer','inline-stack'],
  selectors:['stock','append-strings','no-nest','all-selector-strings','literal-separators','leaf-emission'],
  combined:['stock','static-map','combined','v2'],
};
const group = args.group ?? 'relationship';
const scale = Number(args.scale ?? 1000), scenario = args.scenario ?? 'common';
assert.ok(Number.isSafeInteger(scale) && scale>0);
assert.ok(['common','mixed'].includes(scenario));
const settings = root => ({url:pathToFileURL(join(root,'__decomposition__.scss')),
  style:'expanded',charset:false,sourceMap:false,logger:sass.Logger.silent});
function virtualOptions(contents, logger=sass.Logger.silent) {
  return {...settings(projectRoot),logger,importers:[{
    canonicalize:url=>url==='diagnostic:core'?new URL(url):null,
    load:()=>({contents,syntax:'scss'}),
  }]};
}
function outcome(contents, text) {
  try {return {css:sass.compileString(`@use 'diagnostic:core' as bem;\n${text}`,virtualOptions(contents)).css};}
  catch(error) {return {error:error.sassMessage ?? error.message.split('\n')[0]};}
}
if(group==='controls') {
  const results={coreSha256:sha(core),nameCases:0,relationshipCases:0,fixtureCases:0};
  const equivalentNames=['name-hoist','name-equivalent','name-split','combined'];
  const values=['null','true','3','()','(x: y)',"''","'a'","'_'","'Z0_-'","'aé'","'é'","'a😀'","'a b'","'a\\a b'",'unquote("abc")'];
  for(let code=32;code<127;code++) {
    const c=String.fromCharCode(code).replaceAll('\\','\\\\').replaceAll("'","\\'");
    values.push(`'${c}'`,`'a${c}'`);
  }
  const exposeName='\n@function diagnostic-name($v) { @return -name($v); }';
  for(const value of values) {
    const test=`.x { value: bem.diagnostic-name(${value}); }`;
    const expected=outcome(core+exposeName,test);
    for(const name of equivalentNames) assert.deepEqual(outcome(variants[name].source+exposeName,test),expected,`${name}/${value}`);
    results.nameCases++;
  }
  const exposeValidate='\n@function diagnostic-validate($kind, $child, $under) { $p: (kind: $kind, under-extend: $under); @return -validate($p, $child); }';
  for(const parent of ['root','block','element','modifier','qualified','pending-relation','extend'])
  for(const child of ['block','element','modifier','qualified','pending-relation','extend'])
  for(const under of [false,true]) {
    const test=`@use 'sass:meta'; .x { value: meta.inspect(bem.diagnostic-validate(${parent},${child},${under})); }`;
    const expected=outcome(core+exposeValidate,test);
    for(const name of ['static-map','combined']) assert.deepEqual(outcome(variants[name].source+exposeValidate,test),expected,`${name}/${parent}/${child}/${under}`);
    results.relationshipCases++;
  }
  for(const name of ['static-map','name-hoist','name-equivalent','name-split','root-constant','inline-stack','combined'])
  for(const s of ['block','common','nested','extend','mixed']) {
    const fixture=workload(s,3);
    assert.deepEqual(outcome(variants[name].source,fixture.body),outcome(core,fixture.body),`${name}/${s}`);
    results.fixtureCases++;
  }
  const publicCases = [
    "@include bem.block('b') { @include bem.modifier('a','z') { @include bem.element('e') { color: red; } } }",
    "@include bem.block('b') { @include bem.element('e') { @include bem.selector('+') { @include bem.element('f') { color: red; } } } }",
    "@include bem.block('b') { @include bem.element('e') { @include bem.selector('[open]:hover') { color: red; } } }",
    "@include bem.css-layers(); @include bem.block('b', $layer: 'molecules') { @include bem.element('e') { color: red; } }",
    "@include bem.block('b') { @include bem.extend('i','a') { @include bem.element('e') { color: red; } } @include bem.element('after') { color: blue; } }",
    "@include bem.block('b') { @include bem.element('e') { @include bem.element('bad') { color: red; } } }",
    "@include bem.block('b') { @include bem.extend('i','a') { @include bem.block('bad') { color: red; } } }",
    "@include bem.block('bad.name') { color: red; }",
  ];
  for (const test of publicCases) {
    assert.deepEqual(outcome(variants.combined.source,test),outcome(core,test));
    results.fixtureCases++;
  }
  // Untimed private-helper counts on exactly one common component.
  const counts={};
  const traced=core.replace(/(@(?:function|mixin) (-[\w-]+)\([^\n]*\) \{)/g,'$1\n  @debug "TRACE:$2";');
  sass.compileString(`@use 'diagnostic:core' as bem;\n${workload('common',1).body}`,
    virtualOptions(traced,{warn:()=>{},debug:message=>{if(message.startsWith('TRACE:'))counts[message.slice(6)]=(counts[message.slice(6)]??0)+1;}}));
  results.helperCountsIncludingStartup=counts;
  results.completedAt=new Date().toISOString();
  assert.equal(sha(readFileSync(corePath)),sha(core));
  writeFileSync(join(output,'controls.json'),JSON.stringify(results,null,2)+'\n');
  console.log(results);process.exit(0);
}
assert.ok(groups[group],`Unknown group ${group}`);
if(scenario!=='common') assert.equal(group,'combined');
const tag=args.tag??`${group}-${scenario}-${scale}`;assert.match(tag,/^[\w-]+$/);
const file=join(output,tag+'.json');
assert.ok(!existsSync(file),`Refusing to overwrite ${file}; use a new --tag`);
const fixture=workload(scenario,scale);
const expected=sass.compileString(`@use './src' as bem;\n${fixture.body}`,settings(projectRoot)).css;
assert.deepEqual(flatRules(expected),flatRules(fixture.expected));
const lanes=groups[group].map(name=>{
  const isV2=name==='v2'; const variant=variants[name];
  if(variant)writeFileSync(join(output,name+'.scss'),variant.source);
  const source=isV2?`@use './src/scss/tools/mixins/tool.beminator.scss' as bem;\n${fixture.body}`:`@use 'diagnostic:core' as bem;\n${fixture.body}`;
  const options=isV2?settings(requireLegacyRoot()):virtualOptions(variant.source);
  assert.equal(sass.compileString(source,options).css,expected,name);
  return {name,source,options,samplesMs:[],label:variant?.label??'legacy file-loaded reference',sourceSha256:variant?sha(variant.source):null};
});
const report={startedAt:new Date().toISOString(),group,scenario,scale,node:process.version,sass:sass.info,
  coreSha256:sha(core),harnessSha256:sha(harness),scriptSha256:sha(readFileSync(new URL(import.meta.url))),cpu:cpus()[0].model,loadAverageStart:loadavg(),
  methodology:{warmups:2,iterations:6,order:'rotate starting lane, reverse alternate rounds; order stored explicitly',
    v3Loading:'identical in-memory importer per variant; fresh compilation every call',v2Loading:'original file entrypoint; fresh compilation',
    timing:'compileString only; fixture generation, transforms, checks, I/O untimed',logger:'silent for all timing lanes',gc:'not forced'},
  cssBytes:Buffer.byteLength(expected),orders:[],results:[]};
const save=()=>{report.results=lanes.map(({name,label,samplesMs,sourceSha256})=>({name,label,samplesMs,sourceSha256,statsMs:samplesMs.length?stats(samplesMs):null}));writeFileSync(file,JSON.stringify(report,null,2)+'\n');};
save();
for(let round=0;round<8;round++) {
  const order=lanes.map((_,i)=>(i+round)%lanes.length);if(round%2)order.reverse();
  report.orders.push({round,warmup:round<2,names:order.map(i=>lanes[i].name)});
  for(const index of order) {
    const lane=lanes[index];const start=performance.now();const result=sass.compileString(lane.source,lane.options);
    const elapsed=performance.now()-start;
    assert.equal(result.css,expected,lane.name);if(round>=2)lane.samplesMs.push(elapsed);
  }
  save();console.log(`${tag}: round ${round+1}/8`);
}
report.completedAt=new Date().toISOString();report.loadAverageEnd=loadavg();
assert.equal(sha(readFileSync(corePath)),sha(core));save();
for(const lane of report.results) console.log(lane.name,lane.statsMs.median.toFixed(2),((lane.statsMs.median/report.results[0].statsMs.median-1)*100).toFixed(2)+'%');
