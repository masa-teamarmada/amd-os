import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseStrategicResources, strategicResourcePoints} from '../src/lib/project-strategic-resources.ts';
import {projectSurfacePageGroups} from '../src/lib/project-page-visibility.ts';
import {projectPageDefinition} from '../src/lib/project-page-registry.ts';
import {projectPageLocation} from '../src/lib/project-page-location.ts';

const raw = JSON.parse(readFileSync(new URL('../../model/cases/2026-11-03_sol-strategic-resource-timeline/page-data.json', import.meta.url), 'utf8'));
const data = parseStrategicResources(raw)!;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1, `${a} != ${b}`);
assert.equal(parseStrategicResources(null), null);
assert.throws(() => parseStrategicResources({...raw, version: 2}));
const invalid = structuredClone(raw); invalid.cases[0].points[0].total += 10;
assert.throws(() => parseStrategicResources(invalid), /不整合/);
const badTimeline = structuredClone(raw); badTimeline.cases[1].points.pop();
assert.throws(() => parseStrategicResources(badTimeline), /時間軸/);
const extra = parseStrategicResources({...raw, secret: 'private-fixture'})!;
assert.equal('secret' in extra, false);
assert.equal(data.cases.length, 6);
assert.equal(data.developmentAchievement, 1);
const base = strategicResourcePoints(data.cases, 1, 'mid');
close(base[0].total, 282333205.6503694);
close(base.at(-1)!.total, 1447783605.091012);
const gains = [89878540.56355475, 260531922.90066677, 151616575.31686014, 89936008.30913746];
base.filter(p => p.kind === 'evidence').forEach((point, i) => close(point.informationGain + point.costRelief, gains[i]));
for (const c of [...data.cases, ...data.baseline]) {
  let last = c.points[0];
  for (const point of c.points) {
    close(point.total, point.cash + point.businessValue);
    if (point.kind === 'seed' || point.kind === 'series_a') {
      close(point.total - last.total, point.funding);
      close(point.businessValue, last.businessValue);
    }
    if (point.kind === 'evidence') {
      close(point.cash, last.cash);
      close(point.total - last.total, point.informationGain + point.costRelief);
    }
    last = point;
  }
  close(c.points.reduce((sum, p) => sum + p.revenue, 0), 15000000);
}
const low = strategicResourcePoints(data.cases, .5, 'mid').at(-1)!.total;
const high = strategicResourcePoints(data.cases, 1.5, 'mid').at(-1)!.total;
assert.ok(low < base.at(-1)!.total && base.at(-1)!.total < high);
assert.equal(projectPageDefinition('strategic-resources')?.operation, null);
for (const type of ['su', 'new_business', 'ecosystem', 'amd'] as const)
  for (const surface of ['cockpit', 'workspace', 'dd'] as const) {
    const groups = projectSurfacePageGroups(surface, type, [], false, true);
    assert.equal(groups.flatMap(g => g.children).filter(c => c.key === 'strategic-resources').length, 1, type + '/' + surface);
  }
assert.equal(projectPageLocation('https://fixture.test/dd/sol?chapter=company', 'dd', 'strategic-resources', [], 'report:source-index'), '/dd/sol?tab=strategic-resources');
assert.equal(projectPageLocation('https://fixture.test/dd/sol?tab=strategic-resources', 'dd', 'company', [{slug:'company'}], 'report:source-index'), '/dd/sol?chapter=company');
console.log(JSON.stringify({passed:true,cases:6,points:base.length,sharedEntrances:12,currentYen:base[0].total,seriesAYen:base.at(-1)!.total,lowYen:low,highYen:high}));
