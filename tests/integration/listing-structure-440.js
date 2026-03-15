#!/usr/bin/env node
/**
 * Regression tests for issue #440:
 * Object listing JSON has extra fields, wrong uni_obj structure.
 *
 * Verifies that Node.js object listing responses match PHP structure:
 *   - base.unique: empty string when type ord !== 1
 *   - type.up: uses F_U param (>1 → F_U, else 1)
 *   - &uni_obj.f_i: reflects F_I param
 *   - &uni_obj.lnx: reflects lnx param
 *   - &uni_obj.up: matches type.up
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // Create test type (base_type=3=SHORT, ord defaults to something)
  const [pt, nt] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=__440_p_${TS}&t=3&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=__440_n_${TS}&t=3&JSON=1`, h.cookie()),
  ]);
  const typeP = Number(pt.json?.obj), typeN = Number(nt.json?.obj);
  if (typeP > 0) created.php.types.push(typeP);
  if (typeN > 0) created.node.types.push(typeN);
  if (!typeP || !typeN) { console.error('Type creation failed'); process.exit(1); }

  // Create 2 objects
  for (const val of ['Obj_A', 'Obj_B']) {
    const [po, no] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=1&t${typeP}=${val}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=1&t${typeN}=${val}&JSON=1`, h.cookie()),
    ]);
    if (Number(po.json?.id) > 0) created.php.objects.push(Number(po.json.id));
    if (Number(no.json?.id) > 0) created.node.objects.push(Number(no.json.id));
  }

  h.section('#440 — base.unique value');

  // Test 1: base.unique should be "" for normal type (ord != 1)
  {
    const res = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie());
    const issues = [];
    if (!res.json) { issues.push('No JSON response'); }
    else {
      const baseUnique = res.json?.base?.unique;
      if (baseUnique !== '') {
        issues.push(`base.unique: expected "" got "${baseUnique}"`);
      }
    }
    h.report('#440-1 base.unique is empty string for normal type', issues);
  }

  // Test 2: PHP and Node base.unique match
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      const phpUnique = php.json?.base?.unique;
      const nodeUnique = node.json?.base?.unique;
      if (phpUnique !== nodeUnique) {
        issues.push(`base.unique: PHP="${phpUnique}" Node="${nodeUnique}"`);
      }
    }
    h.report('#440-2 base.unique matches PHP', issues);
  }

  h.section('#440 — type.up value');

  // Test 3: type.up defaults to 1 (no F_U)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      const phpUp = php.json?.type?.up;
      const nodeUp = node.json?.type?.up;
      if (phpUp !== nodeUp) {
        issues.push(`type.up: PHP=${phpUp} Node=${nodeUp}`);
      }
      if (nodeUp !== 1) {
        issues.push(`type.up: expected 1 (default) got ${nodeUp}`);
      }
    }
    h.report('#440-3 type.up defaults to 1', issues);
  }

  // Test 4: type.up = 1 when F_U=0
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_U=0`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_U=0`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      const phpUp = php.json?.type?.up;
      const nodeUp = node.json?.type?.up;
      if (phpUp !== nodeUp) {
        issues.push(`type.up F_U=0: PHP=${phpUp} Node=${nodeUp}`);
      }
    }
    h.report('#440-4 type.up with F_U=0', issues);
  }

  // Test 5: type.up = 1 when F_U=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1&F_U=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_U=1`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      if (node.json?.type?.up !== 1) {
        issues.push(`type.up F_U=1: expected 1 got ${node.json?.type?.up}`);
      }
    }
    h.report('#440-5 type.up with F_U=1', issues);
  }

  h.section('#440 — &uni_obj structure');

  // Test 6: &uni_obj.up matches type.up
  {
    const res = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie());
    const issues = [];
    if (!res.json) { issues.push('No JSON'); }
    else {
      const uniObj = res.json['&main.a.&uni_obj'];
      const typeUp = res.json?.type?.up;
      if (!uniObj) { issues.push('No &uni_obj block'); }
      else {
        if (uniObj.up?.[0] !== String(typeUp)) {
          issues.push(`&uni_obj.up: "${uniObj.up?.[0]}" vs type.up "${typeUp}"`);
        }
      }
    }
    h.report('#440-6 &uni_obj.up matches type.up', issues);
  }

  // Test 7: &uni_obj.unique matches base.unique
  {
    const res = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie());
    const issues = [];
    if (!res.json) { issues.push('No JSON'); }
    else {
      const uniObj = res.json['&main.a.&uni_obj'];
      const baseUnique = res.json?.base?.unique;
      if (uniObj?.unique?.[0] !== baseUnique) {
        issues.push(`&uni_obj.unique: "${uniObj?.unique?.[0]}" vs base.unique "${baseUnique}"`);
      }
    }
    h.report('#440-7 &uni_obj.unique matches base.unique', issues);
  }

  // Test 8: &uni_obj.f_i reflects F_I param
  {
    const objId = created.node.objects[0];
    if (objId) {
      const res = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1&F_I=${objId}`, null, h.cookie());
      const issues = [];
      if (!res.json) { issues.push('No JSON'); }
      else {
        const uniObj = res.json['&main.a.&uni_obj'];
        if (!uniObj) { issues.push('No &uni_obj block'); }
        else if (uniObj.f_i?.[0] !== String(objId)) {
          issues.push(`&uni_obj.f_i: expected "${objId}" got "${uniObj.f_i?.[0]}"`);
        }
      }
      h.report('#440-8 &uni_obj.f_i reflects F_I param', issues);
    } else {
      h.skip('#440-8 &uni_obj.f_i reflects F_I param', 'no objects created');
    }
  }

  // Test 9: &uni_obj.lnx defaults to "0"
  {
    const res = await h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie());
    const issues = [];
    if (!res.json) { issues.push('No JSON'); }
    else {
      const uniObj = res.json['&main.a.&uni_obj'];
      if (!uniObj) { issues.push('No &uni_obj block'); }
      else if (uniObj.lnx?.[0] !== '0') {
        issues.push(`&uni_obj.lnx: expected "0" got "${uniObj.lnx?.[0]}"`);
      }
    }
    h.report('#440-9 &uni_obj.lnx defaults to 0', issues);
  }

  // Test 10: type object has expected keys (id, up, val, base)
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      const phpTypeKeys = Object.keys(php.json.type || {}).sort();
      const nodeTypeKeys = Object.keys(node.json.type || {}).sort();
      if (JSON.stringify(phpTypeKeys) !== JSON.stringify(nodeTypeKeys)) {
        issues.push(`type keys: PHP=${phpTypeKeys} Node=${nodeTypeKeys}`);
      }
      const phpBaseKeys = Object.keys(php.json.base || {}).sort();
      const nodeBaseKeys = Object.keys(node.json.base || {}).sort();
      if (JSON.stringify(phpBaseKeys) !== JSON.stringify(nodeBaseKeys)) {
        issues.push(`base keys: PHP=${phpBaseKeys} Node=${nodeBaseKeys}`);
      }
    }
    h.report('#440-10 type/base keys match PHP', issues);
  }

  // Test 11: &uni_obj has same keys as PHP
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${typeP}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${typeN}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json || !node.json) { issues.push('No JSON'); }
    else {
      const phpUni = php.json['&main.a.&uni_obj'];
      const nodeUni = node.json['&main.a.&uni_obj'];
      if (!phpUni) { issues.push('PHP missing &uni_obj'); }
      else if (!nodeUni) { issues.push('Node missing &uni_obj'); }
      else {
        const phpKeys = Object.keys(phpUni).sort();
        const nodeKeys = Object.keys(nodeUni).sort();
        if (JSON.stringify(phpKeys) !== JSON.stringify(nodeKeys)) {
          issues.push(`&uni_obj keys: PHP=[${phpKeys}] Node=[${nodeKeys}]`);
        }
      }
    }
    h.report('#440-11 &uni_obj keys match PHP', issues);
  }

  // Cleanup
  h.section('Cleanup');
  for (const id of created.node.objects) {
    await h.http(h.NODE, 'POST', `/${h.DB}/`, `_xsrf=${h.xsrfNode}&_m_del=${id}&JSON=1`, h.cookie());
  }
  for (const id of created.php.objects) {
    await h.http(h.PHP, 'POST', `/${h.DB}/`, `_xsrf=${h.xsrfPhp}&_m_del=${id}&JSON=1`, h.cookie());
  }
  for (const id of created.node.types) {
    await h.http(h.NODE, 'POST', `/${h.DB}/`, `_xsrf=${h.xsrfNode}&_d_del=${id}&JSON=1`, h.cookie());
  }
  for (const id of created.php.types) {
    await h.http(h.PHP, 'POST', `/${h.DB}/`, `_xsrf=${h.xsrfPhp}&_d_del=${id}&JSON=1`, h.cookie());
  }
  console.log('  Cleanup done');

  h.summary('#440 — Object listing structure');
}

run().catch(e => { console.error(e); process.exit(1); });
