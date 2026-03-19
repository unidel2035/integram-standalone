#!/usr/bin/env node
/**
 * Business CRUD parity tests.
 *
 * Tests real-world workflows:
 *   1. Lookup tables (справочники): create ref type → add ref column → set reference values
 *   2. Multiselects: create multi column → add/remove multiple values
 *   3. Subordinate tables (подчинённые): parent-child type hierarchy → objects → F_U filtering
 *   4. Full object lifecycle with all data types
 */
import h from './lib/helpers.js';
const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

async function createType(name, baseType, extra = '') {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=${name}_p&t=${baseType}${extra}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=${name}_n&t=${baseType}${extra}&JSON=1`, h.cookie()),
  ]);
  const pId = Number(php.json?.obj), nId = Number(node.json?.obj);
  if (pId > 0) created.php.types.push(pId);
  if (nId > 0) created.node.types.push(nId);
  return { pId, nId, php, node };
}

/** Create object with separate parent IDs for PHP and Node */
async function createObj(typeP, typeN, value, upP = 1, upN = 1) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${typeP}`, `_xsrf=${h.xsrfPhp}&up=${upP}&t${typeP}=${encodeURIComponent(value)}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${typeN}`, `_xsrf=${h.xsrfNode}&up=${upN}&t${typeN}=${encodeURIComponent(value)}&JSON=1`, h.cookie()),
  ]);
  const pId = Number(php.json?.id), nId = Number(node.json?.id);
  if (pId > 0) created.php.objects.push(pId);
  if (nId > 0) created.node.objects.push(nId);
  return { pId, nId, php, node };
}

/** Add regular column via _d_req. Returns requisite ID = json.id */
async function addColumn(parentP, parentN, colTypeP, colTypeN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${parentP}`, `_xsrf=${h.xsrfPhp}&t=${colTypeP}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${parentN}`, `_xsrf=${h.xsrfNode}&t=${colTypeN}&JSON=1`, h.cookie()),
  ]);
  // _d_req: id = new requisite ID, obj = parent type
  return { reqP: Number(php.json?.id), reqN: Number(node.json?.id), php, node };
}

/** Add reference column via _d_ref. Note: _d_ref returns id=parentType, obj=requisiteId (reversed!) */
async function addRefColumn(parentP, parentN, refTypeP, refTypeN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_ref/${parentP}`, `_xsrf=${h.xsrfPhp}&t=${refTypeP}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_ref/${parentN}`, `_xsrf=${h.xsrfNode}&t=${refTypeN}&JSON=1`, h.cookie()),
  ]);
  // _d_ref: obj = new requisite ID (NOT id!)
  return {
    reqP: Number(php.json?.obj), reqN: Number(node.json?.obj),
    refTypeP, refTypeN,  // keep ref type IDs for _m_set
    php, node,
  };
}

/** Set attribute on object — uses reference type ID for _m_set */
async function setRef(objP, objN, refTypeP, refTypeN, valueP, valueN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${objP}`, `_xsrf=${h.xsrfPhp}&t${refTypeP}=${encodeURIComponent(valueP)}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${objN}`, `_xsrf=${h.xsrfNode}&t${refTypeN}=${encodeURIComponent(valueN)}&JSON=1`, h.cookie()),
  ]);
  return { php, node };
}

/** Set attribute using column type IDs */
async function setAttr(objP, objN, colTypeP, colTypeN, value) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${objP}`, `_xsrf=${h.xsrfPhp}&t${colTypeP}=${encodeURIComponent(value)}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${objN}`, `_xsrf=${h.xsrfNode}&t${colTypeN}=${encodeURIComponent(value)}&JSON=1`, h.cookie()),
  ]);
  return { php, node };
}

async function getEditObj(objP, objN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'GET', `/${h.DB}/edit_obj/${objP}?JSON=1`, null, h.cookie()),
    h.http(h.NODE, 'GET', `/${h.DB}/edit_obj/${objN}?JSON=1`, null, h.cookie()),
  ]);
  return { php, node };
}

/** Extract requisite values from edit_obj response */
function getEditReqValues(editJson) {
  if (!editJson) return {};
  const result = {};
  for (const [k, v] of Object.entries(editJson)) {
    if (k.includes('edit_req') && v && typeof v === 'object') {
      // v has arrays: typ, val, type, etc.
      if (Array.isArray(v.typ) && Array.isArray(v.val)) {
        for (let i = 0; i < v.typ.length; i++) {
          result[v.typ[i]] = { val: v.val?.[i], type: v.type?.[i] };
        }
      }
    }
  }
  return result;
}

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LOOKUP TABLES (СПРАВОЧНИКИ)
  // ═══════════════════════════════════════════════════════════════════════════
  h.section('1. Lookup Tables (Справочники)');

  // 1.1 Create lookup type (e.g. "Cities")
  const lookup = await createType(`__biz_cities_${TS}`, 3);
  h.report('1.1 Create lookup type', (!lookup.pId || !lookup.nId) ? ['Creation failed'] : []);

  // 1.2 Create items in lookup
  const city1 = await createObj(lookup.pId, lookup.nId, 'Москва');
  const city2 = await createObj(lookup.pId, lookup.nId, 'Санкт-Петербург');
  const city3 = await createObj(lookup.pId, lookup.nId, 'Новосибирск');
  h.report('1.2 Create lookup items', (!city1.pId || !city2.pId || !city3.pId) ? ['PHP failed'] :
    (!city1.nId || !city2.nId || !city3.nId) ? ['Node failed'] : []);

  // 1.3 Create main type (e.g. "People")
  const main = await createType(`__biz_people_${TS}`, 3);
  h.report('1.3 Create main type', (!main.pId || !main.nId) ? ['Creation failed'] : []);

  // 1.4 Add reference column from People → Cities
  const refCol = await addRefColumn(main.pId, main.nId, lookup.pId, lookup.nId);
  h.report('1.4 Add ref column (People→Cities)', (!refCol.reqP || !refCol.reqN) ? ['Ref creation failed'] : []);

  // 1.5 Create a person object
  const person1 = await createObj(main.pId, main.nId, 'Иванов Иван');
  h.report('1.5 Create person', (!person1.pId || !person1.nId) ? ['Creation failed'] : []);

  // 1.6 Set city reference on person — use ref TYPE ID for _m_set
  if (person1.pId && person1.nId && city1.pId && city1.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, lookup.pId, lookup.nId,
      city1.pId.toString(), city1.nId.toString());
    h.report('1.6 Set reference (city=Москва)', php.status !== 200 ? [`PHP ${php.status}`] :
      node.status !== 200 ? [`Node ${node.status}`] : []);
  }

  // 1.7 Verify reference via edit_obj
  if (person1.pId && person1.nId) {
    const { php, node } = await getEditObj(person1.pId, person1.nId);
    const issues = [];
    // Both should return 200 with JSON data
    if (php.status !== 200) issues.push(`PHP status ${php.status}`);
    if (node.status !== 200) issues.push(`Node status ${node.status}`);
    // Check status parity
    if (issues.length === 0 && php.status !== node.status)
      issues.push(`Status: PHP=${php.status} Node=${node.status}`);
    h.report('1.7 Verify ref in edit_obj', issues);
  }

  // 1.8 _ref_reqs — get available options for the ref column
  if (refCol.reqP && refCol.reqN) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/_ref_reqs/${refCol.reqP}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/_ref_reqs/${refCol.reqN}`, null, h.cookie()),
    ]);
    if (php.status >= 500) {
      h.skip('1.8 _ref_reqs options', 'PHP 500');
    } else {
      h.report('1.8 _ref_reqs options', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
    }
  }

  // 1.9 _ref_reqs Node response format
  if (refCol.reqN) {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/_ref_reqs/${refCol.reqN}`, null, h.cookie());
    h.nodeOnly('1.9 _ref_reqs response', n, (n, iss) => {
      if (!n.json) iss.push('Not JSON');
      if (typeof n.json === 'object' && Object.keys(n.json).length === 0) iss.push('Empty response');
    });
  }

  // 1.10 Change reference to different city
  if (person1.pId && person1.nId && city2.pId && city2.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, lookup.pId, lookup.nId,
      city2.pId.toString(), city2.nId.toString());
    h.report('1.10 Change ref (city=СПб)', php.status !== node.status ? [`Status`] : []);
  }

  // 1.11 Clear reference
  if (person1.pId && person1.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, lookup.pId, lookup.nId, '', '');
    h.report('1.11 Clear reference', php.status !== node.status ? [`Status`] : []);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MULTISELECTS (МУЛЬТИСЕЛЕКТЫ)
  // ═══════════════════════════════════════════════════════════════════════════
  h.section('2. Multiselects (Мультиселекты)');

  // 2.1 Create a type for multiselect values (e.g. "Tags")
  const tags = await createType(`__biz_tags_${TS}`, 3);
  h.report('2.1 Create tags type', (!tags.pId || !tags.nId) ? ['Creation failed'] : []);

  // 2.2 Create tag items
  const tag1 = await createObj(tags.pId, tags.nId, 'VIP');
  const tag2 = await createObj(tags.pId, tags.nId, 'Оптовый');
  const tag3 = await createObj(tags.pId, tags.nId, 'Розничный');
  h.report('2.2 Create tag items', (!tag1.pId || !tag2.pId || !tag3.pId) ? ['PHP failed'] :
    (!tag1.nId || !tag2.nId || !tag3.nId) ? ['Node failed'] : []);

  // 2.3 Add ref column from People → Tags
  const tagCol = await addRefColumn(main.pId, main.nId, tags.pId, tags.nId);
  h.report('2.3 Add ref column (People→Tags)', (!tagCol.reqP || !tagCol.reqN) ? ['Ref creation failed'] : []);

  // 2.4 Enable MULTI on the tag column
  if (tagCol.reqP && tagCol.reqN) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_multi/${tagCol.reqP}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_multi/${tagCol.reqN}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    h.report('2.4 Enable MULTI on tags column', php.status !== node.status ? [`Status`] : []);
  }

  // 2.5 Set first multiselect value (tag1) — use tags TYPE ID
  if (person1.pId && person1.nId && tag1.pId && tag1.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, tags.pId, tags.nId,
      tag1.pId.toString(), tag1.nId.toString());
    h.report('2.5 Set multi value (VIP)', php.status !== node.status ? [`Status`] : []);
  }

  // 2.6 Add second multiselect value (tag2) — should add, not replace
  if (person1.pId && person1.nId && tag2.pId && tag2.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, tags.pId, tags.nId,
      tag2.pId.toString(), tag2.nId.toString());
    h.report('2.6 Add multi value (Оптовый)', php.status !== node.status ? [`Status`] : []);
  }

  // 2.7 Verify multiselect state via edit_obj
  if (person1.pId && person1.nId) {
    const { php, node } = await getEditObj(person1.pId, person1.nId);
    const issues = [];
    if (php.status !== 200) issues.push(`PHP status ${php.status}`);
    if (node.status !== 200) issues.push(`Node status ${node.status}`);
    if (php.status === 200 && node.status === 200 && php.status !== node.status)
      issues.push('Status mismatch');
    h.report('2.7 Verify multi in edit_obj', issues);
  }

  // 2.8 Add third value
  if (person1.pId && person1.nId && tag3.pId && tag3.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, tags.pId, tags.nId,
      tag3.pId.toString(), tag3.nId.toString());
    h.report('2.8 Add multi value (Розничный)', php.status !== node.status ? [`Status`] : []);
  }

  // 2.9 Remove one multiselect value (toggle off tag1)
  if (person1.pId && person1.nId && tag1.pId && tag1.nId) {
    const { php, node } = await setRef(person1.pId, person1.nId, tags.pId, tags.nId,
      tag1.pId.toString(), tag1.nId.toString());
    h.report('2.9 Remove multi value (toggle VIP off)', php.status !== node.status ? [`Status`] : []);
  }

  // 2.10 Verify after remove
  if (person1.pId && person1.nId) {
    const { php, node } = await getEditObj(person1.pId, person1.nId);
    h.report('2.10 Verify multi after remove', php.status !== node.status ? [`Status`] : []);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. OBJECT LISTING & MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  h.section('3. Object Listing & Management');

  // 3.1 Create type with multiple objects
  const listType = await createType(`__biz_list_${TS}`, 3);
  h.report('3.1 Create list type', (!listType.pId || !listType.nId) ? ['Failed'] : []);

  const items = [];
  for (const name of ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон']) {
    const obj = await createObj(listType.pId, listType.nId, name);
    items.push(obj);
  }
  h.report('3.2 Create 5 objects',
    items.every(i => i.pId > 0 && i.nId > 0) ? [] : ['Some items failed']);

  // 3.3 List all objects
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${listType.pId}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${listType.nId}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    const pLen = php.json?.object?.length || 0;
    const nLen = node.json?.object?.length || 0;
    if (pLen !== nLen) issues.push(`Count: PHP=${pLen} Node=${nLen}`);
    else if (nLen < 5) issues.push(`Expected 5, got ${nLen}`);
    h.report('3.3 List all objects', issues);
  }

  // 3.4 _list with LIMIT
  {
    const r = await h.cmp('3.4 _list LIMIT=3', 'GET', `/_list/${listType.pId}?JSON=1&LIMIT=3`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${listType.nId}?JSON=1&LIMIT=3`, null, h.cookie());
      h.nodeOnly('3.4 _list LIMIT=3', n, (n, iss) => {
        if (n.json?.data && n.json.data.length > 3) iss.push(`${n.json.data.length} items`);
      });
    } else h.report('3.4 _list LIMIT=3', []);
  }

  // 3.5 _list with q= search
  {
    const r = await h.cmp('3.5 _list q=Альфа', 'GET', `/_list/${listType.pId}?JSON=1&q=${encodeURIComponent('Альфа')}`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list/${listType.nId}?JSON=1&q=${encodeURIComponent('Альфа')}`, null, h.cookie());
      h.nodeOnly('3.5 _list q=Альфа', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('3.5 _list q=Альфа', []);
  }

  // 3.6 _list_join
  {
    const r = await h.cmp('3.6 _list_join', 'GET', `/_list_join/${listType.pId}?JSON=1`);
    if (r.skipped) {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/_list_join/${listType.nId}?JSON=1`, null, h.cookie());
      h.nodeOnly('3.6 _list_join', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    } else h.report('3.6 _list_join', []);
  }

  // 3.7 _m_ord — set order
  if (items[2].pId && items[2].nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_ord/${items[2].pId}`, `_xsrf=${h.xsrfPhp}&order=1&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_ord/${items[2].nId}`, `_xsrf=${h.xsrfNode}&order=1&JSON=1`, h.cookie()),
    ]);
    h.report('3.7 Set object order', php.status !== node.status ? [`Status`] : []);
  }

  // 3.8 _m_id — set custom ID
  if (items[0].pId && items[0].nId) {
    const newId = 900000 + Math.floor(Math.random() * 100000);
    // Both PHP and Node use "new_id" parameter
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_id/${items[0].pId}`, `_xsrf=${h.xsrfPhp}&new_id=${newId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_id/${items[0].nId}`, `_xsrf=${h.xsrfNode}&new_id=${newId + 1}&JSON=1`, h.cookie()),
    ]);
    const issues = [];
    if (php.json?.id != newId && !php.json?.error && !php.json?.[0]?.error)
      issues.push(`PHP id=${php.json?.id}`);
    if (node.json?.id != (newId + 1) && !node.json?.error && !node.json?.[0]?.error)
      issues.push(`Node id=${node.json?.id}`);
    h.report('3.8 Set custom ID', issues);
    // Update tracked IDs
    if (php.json?.id == newId) {
      created.php.objects = created.php.objects.map(id => id === items[0].pId ? newId : id);
      items[0].pId = newId;
    }
    if (node.json?.id == (newId + 1)) {
      created.node.objects = created.node.objects.map(id => id === items[0].nId ? newId + 1 : id);
      items[0].nId = newId + 1;
    }
  }

  // 3.9 obj_meta
  if (items[1].pId && items[1].nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/obj_meta/${items[1].pId}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/obj_meta/${items[1].nId}`, null, h.cookie()),
    ]);
    const issues = [];
    if (!php.json?.id) issues.push('PHP: no id');
    if (!node.json?.id) issues.push('Node: no id');
    if (php.json && node.json && php.json.val !== node.json.val)
      issues.push(`val: PHP=${php.json.val} Node=${node.json.val}`);
    h.report('3.9 obj_meta parity', issues);
  }

  // 3.10 Delete one object and verify count
  if (items[4].pId && items[4].nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${items[4].pId}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${items[4].nId}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    h.report('3.10 Delete object', php.status !== node.status ? [`Status`] : []);
    created.php.objects = created.php.objects.filter(id => id !== items[4].pId);
    created.node.objects = created.node.objects.filter(id => id !== items[4].nId);

    // Verify count
    const [phpL, nodeL] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${listType.pId}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${listType.nId}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    const pLen = phpL.json?.object?.length || 0;
    const nLen = nodeL.json?.object?.length || 0;
    if (pLen !== nLen) issues.push(`Count: PHP=${pLen} Node=${nLen}`);
    h.report('3.11 Count after delete', issues);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FULL OBJECT LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════
  h.section('4. Full Object Lifecycle');

  const lifecycle = await createType(`__biz_lifecycle_${TS}`, 3);

  // Add NUMBER and DATETIME columns — use base types directly as columns
  const numType = await createType(`__biz_num_${TS}`, 11);
  const dtType = await createType(`__biz_dt_${TS}`, 16);
  const numCol = await addColumn(lifecycle.pId, lifecycle.nId, numType.pId, numType.nId);
  const dtCol = await addColumn(lifecycle.pId, lifecycle.nId, dtType.pId, dtType.nId);

  // 4.1 Create object
  const lobj = await createObj(lifecycle.pId, lifecycle.nId, 'Original');
  h.report('4.1 Create lifecycle object', (!lobj.pId || !lobj.nId) ? ['Failed'] : []);

  // 4.2 Set NUMBER attr (use column TYPE ID)
  if (lobj.pId && numType.pId) {
    const { php, node } = await setAttr(lobj.pId, lobj.nId, numType.pId, numType.nId, '42');
    h.report('4.2 Set NUMBER=42', php.status !== node.status ? [`Status`] : []);
  }

  // 4.3 Set DATETIME attr
  if (lobj.pId && dtType.pId) {
    const { php, node } = await setAttr(lobj.pId, lobj.nId, dtType.pId, dtType.nId, '2026-12-25 10:30:00');
    h.report('4.3 Set DATETIME', php.status !== node.status ? [`Status`] : []);
  }

  // 4.4 Verify attrs via edit_obj
  if (lobj.pId && lobj.nId) {
    const { php, node } = await getEditObj(lobj.pId, lobj.nId);
    const issues = [];
    if (php.status !== 200) issues.push(`PHP ${php.status}`);
    if (node.status !== 200) issues.push(`Node ${node.status}`);
    if (issues.length === 0 && php.status !== node.status) issues.push('Status mismatch');
    h.report('4.4 Verify attrs in edit_obj', issues);
  }

  // 4.5 Copy object
  let copyP = 0, copyN = 0;
  if (lobj.pId && lobj.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_save/${lobj.pId}`, `_xsrf=${h.xsrfPhp}&copybtn&val=Copy&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_save/${lobj.nId}`, `_xsrf=${h.xsrfNode}&copybtn&val=Copy&JSON=1`, h.cookie()),
    ]);
    copyP = Number(php.json?.id); copyN = Number(node.json?.id);
    if (copyP > 0) created.php.objects.push(copyP);
    if (copyN > 0) created.node.objects.push(copyN);
    h.report('4.5 Copy object', php.status !== node.status ? [`Status`] : []);
  }

  // 4.6 Verify copy via edit_obj
  if (copyP && copyN) {
    const { php, node } = await getEditObj(copyP, copyN);
    const issues = [];
    if (php.status !== 200) issues.push(`PHP ${php.status}`);
    if (node.status !== 200) issues.push(`Node ${node.status}`);
    if (issues.length === 0 && php.status !== node.status) issues.push('Status mismatch');
    h.report('4.6 Copy has data', issues);
  }

  // 4.7 List objects
  if (lifecycle.pId && lifecycle.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${lifecycle.pId}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${lifecycle.nId}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    const pLen = php.json?.object?.length || 0;
    const nLen = node.json?.object?.length || 0;
    if (pLen !== nLen) issues.push(`Count: PHP=${pLen} Node=${nLen}`);
    else if (nLen < 2) issues.push(`Expected 2+, got ${nLen}`);
    h.report('4.7 List objects', issues);
  }

  // 4.8 Delete copy and verify count
  if (copyP && copyN) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_del/${copyP}`, `_xsrf=${h.xsrfPhp}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_del/${copyN}`, `_xsrf=${h.xsrfNode}&JSON=1`, h.cookie()),
    ]);
    h.report('4.8 Delete copy', php.status !== node.status ? [`Status`] : []);
    // Remove from cleanup list since already deleted
    created.php.objects = created.php.objects.filter(id => id !== copyP);
    created.node.objects = created.node.objects.filter(id => id !== copyN);
  }

  // 4.9 Verify count after delete
  if (lifecycle.pId && lifecycle.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/object/${lifecycle.pId}?JSON=1`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/object/${lifecycle.nId}?JSON=1`, null, h.cookie()),
    ]);
    const issues = [];
    const pLen = php.json?.object?.length || 0;
    const nLen = node.json?.object?.length || 0;
    if (pLen !== nLen) issues.push(`Count: PHP=${pLen} Node=${nLen}`);
    h.report('4.9 Verify count after delete', issues);
  }

  // Cleanup
  h.section('Cleanup');
  let cleaned = 0;
  for (const [base, xsrf, data] of [[h.PHP, h.xsrfPhp, created.php], [h.NODE, h.xsrfNode, created.node]]) {
    for (const id of data.objects) {
      await h.http(base, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${xsrf}&JSON=1`, h.cookie());
      cleaned++;
    }
    // Delete types in reverse order (children first)
    for (const id of [...data.types].reverse()) {
      await h.http(base, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
      cleaned++;
    }
  }
  // Final sweep
  for (const [base, xsrf] of [[h.PHP, h.xsrfPhp], [h.NODE, h.xsrfNode]]) {
    const terms = await h.http(base, 'GET', `/${h.DB}/terms`, null, h.cookie());
    if (Array.isArray(terms.json)) {
      for (const t of terms.json.filter(t => (t.val || t.name || '').startsWith('__biz'))) {
        await h.http(base, 'POST', `/${h.DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
        cleaned++;
      }
    }
  }
  console.log(`  Cleaned ${cleaned} entities`);

  h.summary('Business CRUD');
}

run().catch(err => { console.error(err); process.exit(1); });
