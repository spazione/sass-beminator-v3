// Contemporaneous file-loaded v2 / frozen old v3 / current production v3.
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
  assert.match(arg, /^--[\w-]+=.+$/);const i=arg.indexOf('=');return [arg.slice(2,i),arg.slice(i+1)];
}));
for (const key of Object.keys(args)) assert.ok(['scenario','scale','tag'].includes(key));
const scenario=args.scenario??'common', scale=Number(args.scale??1000);
assert.ok(['common','mixed'].includes(scenario));assert.ok(Number.isSafeInteger(scale)&&scale>0);
const tag=args.tag??`${scenario}-${scale}`;assert.match(tag,/^[\w-]+$/);
const output=join(projectRoot,'tmp/benchmarks/production-optimizations');mkdirSync(output,{recursive:true});
const file=join(output,`${tag}.json`);assert.ok(!existsSync(file),'Choose a new --tag; existing results are preserved');
const sha=text=>createHash('sha256').update(text).digest('hex');
const baseline=readFileSync(join(projectRoot,'benchmarks/references/v3-before-validation.scss'),'utf8');
assert.equal(sha(baseline),'805b444631498f9f5ba634605b289ab10fc6fee8a6083af1588a0338070346e7');
const oldRoot=join(output,'old-v3');mkdirSync(join(oldRoot,'src/core'),{recursive:true});
writeFileSync(join(oldRoot,'src/core/_bem.scss'),baseline);
writeFileSync(join(oldRoot,'src/_index.scss'),readFileSync(join(projectRoot,'src/_index.scss')));
const harness=readFileSync(join(projectRoot,'benchmarks/compile-performance.mjs'),'utf8');
const from=harness.indexOf('const wrap = '),to=harness.indexOf('const output = ');assert.ok(from>0&&to>from);
const {workload,flatRules,stats}=runInNewContext(harness.slice(from,to)+'\n({workload,flatRules,stats})',{assert});
const fixture=workload(scenario,scale);
const lanes=[['v2',requireLegacyRoot(),'./src/scss/tools/mixins/tool.beminator.scss'],
  ['old-v3',oldRoot,'./src'],['production-v3',projectRoot,'./src']].map(([name,root,entry])=>({
    name,source:`@use '${entry}' as bem;\n${fixture.body}`,samplesMs:[],
    options:{url:pathToFileURL(join(root,'__benchmark__.scss')),style:'expanded',charset:false,sourceMap:false,logger:sass.Logger.silent},
  }));
// Audit warnings outside timing; identical quiet logging keeps I/O out of all lanes.
const warningAudit={};
const css=lanes.map(l=>{
  const warnings=[]; warningAudit[l.name]=warnings;
  return sass.compileString(l.source,{...l.options,logger:{
    warn(message,options){warnings.push({message,deprecation:options.deprecation});},
    debug(message){warnings.push({debug:message});},
  }}).css;
});
for(const c of css){assert.equal(c,css[0]);assert.deepEqual(flatRules(c),flatRules(fixture.expected));}
const report={startedAt:new Date().toISOString(),scenario,scale,node:process.version,sass:sass.info,cpu:cpus()[0].model,
  sourceHashes:{oldV3:sha(baseline),productionV3:sha(readFileSync(join(projectRoot,'src/core/_bem.scss'))),
    entry:sha(readFileSync(join(projectRoot,'src/_index.scss'))),legacyEntry:sha(readFileSync(join(requireLegacyRoot(),'src/scss/tools/mixins/tool.beminator.scss'))),
    harness:sha(harness),script:sha(readFileSync(new URL(import.meta.url)))},loadAverageStart:loadavg(),
  methodology:{warmups:3,iterations:10,api:'sass.compileString',unit:'ms',loading:'all lanes use real file imports; old and new v3 have identical entry/core layout',
    order:'rotate first lane; reverse alternate rounds; stored explicitly',logger:'silent for all lanes',p95:'nearest rank',stddev:'population',
    timing:'compile only; generation, correctness, statistics and I/O excluded',gc:'not forced'},
  warningAudit,totalCalls:fixture.calls,cssBytes:css.map(c=>Buffer.byteLength(c)),orders:[],results:[]};
const save=()=>{report.results=lanes.map(({name,samplesMs})=>({name,samplesMs,statsMs:samplesMs.length?stats(samplesMs):null}));writeFileSync(file,JSON.stringify(report,null,2)+'\n');};save();
for(let round=0;round<13;round++){
  const order=lanes.map((_,i)=>(i+round)%lanes.length);if(round%2)order.reverse();report.orders.push({round,warmup:round<3,names:order.map(i=>lanes[i].name)});
  for(const index of order){const lane=lanes[index];const start=performance.now();const result=sass.compileString(lane.source,lane.options);const elapsed=performance.now()-start;
    assert.equal(result.css,css[index]);if(round>=3)lane.samplesMs.push(elapsed);}
  save();console.log(`${scenario}/${scale}: round ${round+1}/13`);
}
report.pairedRatios={};
for(const [numerator,denominator,key] of [[2,1,'productionToOld'],[2,0,'productionToV2']]){
  const samples=lanes[numerator].samplesMs.map((n,i)=>n/lanes[denominator].samplesMs[i]);
  report.pairedRatios[key]={samples,stats:stats(samples),fasterPairs:samples.filter(n=>n<1).length};
}
report.completedAt=new Date().toISOString();report.loadAverageEnd=loadavg();
assert.equal(sha(readFileSync(join(projectRoot,'src/core/_bem.scss'))),report.sourceHashes.productionV3);save();
console.log(JSON.stringify(report.results.map(r=>({name:r.name,...r.statsMs})),null,2));
