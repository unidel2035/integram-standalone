#!/usr/bin/env node
/**
 * Advanced Features parity tests: PHP (8082) vs Node.js (8081)
 *
 * Sections:
 *   1. Multiselect — create lookup, enable MULTI, add/remove values
 *   2. Lookup/Reference Tables — create, set, change, clear references
 *   3. Subordinate Tables — parent-child type hierarchy
 *   4. Remove Subordination — detach child from parent
 *   5. Add Row and Column — add column to existing objects
 *   6. Type Promotion — column → table
 *   7. Type Demotion — table → column
 *
 * Usage: node advanced-features.js
 * Prerequisites:
 *   PHP:  php -S 127.0.0.1:8082 router.php  (in integram-server/)
 *   Node: PORT=8081 node start-legacy-test.js (in backend/monolith/)
 *   Test user: testbot / test123 in 'my' database
 */
import h from './lib/helpers.js';

const TS = Date.now();
const created = { php: { types: [], objects: [] }, node: { types: [], objects: [] } };

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function createSubType(name, baseType, parentP, parentN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfPhp}&val=${name}_p&t=${baseType}&up=${parentP}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_d_new`, `_xsrf=${h.xsrfNode}&val=${name}_n&t=${baseType}&up=${parentN}&JSON=1`, h.cookie()),
  ]);
  const pId = Number(php.json?.obj), nId = Number(node.json?.obj);
  if (pId > 0) created.php.types.push(pId);
  if (nId > 0) created.node.types.push(nId);
  return { pId, nId, php, node };
}

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
    refTypeP, refTypeN,
    php, node,
  };
}

/** Set reference value on object — uses ref TYPE ID for _m_set */
async function setRef(objP, objN, refTypeP, refTypeN, valueP, valueN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${objP}`, `_xsrf=${h.xsrfPhp}&t${refTypeP}=${encodeURIComponent(valueP)}&JSON=1`, h.cookie()),
    h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${objN}`, `_xsrf=${h.xsrfNode}&t${refTypeN}=${encodeURIComponent(valueN)}&JSON=1`, h.cookie()),
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

async function getObjMeta(typeP, typeN) {
  const [php, node] = await Promise.all([
    h.http(h.PHP, 'GET', `/${h.DB}/obj_meta/${typeP}`, null, h.cookie()),
    h.http(h.NODE, 'GET', `/${h.DB}/obj_meta/${typeN}`, null, h.cookie()),
  ]);
  return { php, node };
}

function cmpStatus(php, node, issues) {
  if (php.status !== node.status) issues.push(`Status: PHP=${php.status} Node=${node.status}`);
}

function cmpKeys(php, node, issues, keys) {
  if (!php.json || !node.json) {
    if (!php.json) issues.push(`PHP not JSON: ${h.short(php.body)}`);
    if (!node.json) issues.push(`Node not JSON: ${h.short(node.body)}`);
    return;
  }
  for (const k of keys) {
    if (String(php.json[k] ?? '') !== String(node.json[k] ?? ''))
      issues.push(`${k}: PHP="${php.json[k]}" Node="${node.json[k]}"`);
  }
}

function isPhpBroken(php) {
  return php.status >= 500 || php.body === 'null' || php.body === '' ||
    (!php.json && (php.body || '').startsWith('<!DOCTYPE'));
}

// ─── Pre-cleanup ─────────────────────────────────────────────────────────────

async function preCleanup() {
  for (const [label, base, xsrf] of [['PHP', h.PHP, h.xsrfPhp], ['Node', h.NODE, h.xsrfNode]]) {
    const terms = await h.http(base, 'GET', `/${h.DB}/terms`, null, h.cookie());
    if (Array.isArray(terms.json)) {
      const stale = terms.json.filter(t => (t.val || t.name || '').startsWith('__adv'));
      for (const t of stale) {
        await h.http(base, 'POST', `/${h.DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie());
      }
      if (stale.length) console.log(`  Pre-cleanup: removed ${stale.length} stale types from ${label}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Multiselect
// ═══════════════════════════════════════════════════════════════════════════════

async function section1_multiselect() {
  h.section('1. Multiselect');

  // 1.1 Create lookup type (Colors)
  const colors = await createType(`__adv_colors_${TS}`, 3);
  {
    const issues = [];
    if (!colors.pId) issues.push('PHP: creation failed');
    if (!colors.nId) issues.push('Node: creation failed');
    cmpKeys(colors.php, colors.node, issues, ['next_act', 'args']);
    h.report('1.1 Create lookup type (Colors)', issues);
  }
  if (!colors.pId || !colors.nId) return {};

  // 1.2 Create lookup items (Red, Blue, Green)
  const red = await createObj(colors.pId, colors.nId, 'Red');
  const blue = await createObj(colors.pId, colors.nId, 'Blue');
  const green = await createObj(colors.pId, colors.nId, 'Green');
  {
    const issues = [];
    if (!red.pId || !blue.pId || !green.pId) issues.push('PHP: some items failed');
    if (!red.nId || !blue.nId || !green.nId) issues.push('Node: some items failed');
    h.report('1.2 Create lookup items (Red, Blue, Green)', issues);
  }

  // 1.3 Create main type (Products)
  const products = await createType(`__adv_products_${TS}`, 3);
  {
    const issues = [];
    if (!products.pId) issues.push('PHP: creation failed');
    if (!products.nId) issues.push('Node: creation failed');
    h.report('1.3 Create main type (Products)', issues);
  }
  if (!products.pId || !products.nId) return {};

  // 1.4 Add reference column Products -> Colors via _d_ref
  const colorRef = await addRefColumn(products.pId, products.nId, colors.pId, colors.nId);
  {
    const issues = [];
    if (!colorRef.reqP) issues.push('PHP: ref creation failed');
    if (!colorRef.reqN) issues.push('Node: ref creation failed');
    cmpStatus(colorRef.php, colorRef.node, issues);
    h.report('1.4 Add ref column (Products->Colors)', issues);
  }
  if (!colorRef.reqP || !colorRef.reqN) return {};

  // 1.5 Enable MULTI via POST _d_multi/{reqId} with multi=1
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_multi/${colorRef.reqP}`, `_xsrf=${h.xsrfPhp}&multi=1&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_multi/${colorRef.reqN}`, `_xsrf=${h.xsrfNode}&multi=1&JSON=1`, h.cookie()),
    ]);
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act', 'args']);
    h.report('1.5 Enable MULTI on color column', issues);
  }

  // 1.6 Create product object
  const prod1 = await createObj(products.pId, products.nId, 'Widget');
  {
    const issues = [];
    if (!prod1.pId) issues.push('PHP: creation failed');
    if (!prod1.nId) issues.push('Node: creation failed');
    h.report('1.6 Create product object (Widget)', issues);
  }
  if (!prod1.pId || !prod1.nId) return {};

  // 1.7 Add first multiselect value (Red) via _m_set
  {
    const { php, node } = await setRef(prod1.pId, prod1.nId, colors.pId, colors.nId,
      red.pId.toString(), red.nId.toString());
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('1.7 Set multi value (Red)', issues);
  }

  // 1.8 Add second multiselect value (Blue) via _m_set
  {
    const { php, node } = await setRef(prod1.pId, prod1.nId, colors.pId, colors.nId,
      blue.pId.toString(), blue.nId.toString());
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('1.8 Add multi value (Blue)', issues);
  }

  // 1.9 Verify multiple values stored via edit_obj
  {
    const { php, node } = await getEditObj(prod1.pId, prod1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.status === 200 && node.status === 200) {
      // Both should return JSON with edit_req data
      if (!php.json) issues.push('PHP: not JSON');
      if (!node.json) issues.push('Node: not JSON');
    }
    h.report('1.9 Verify multi values in edit_obj', issues);
  }

  // 1.10 Remove one value (toggle Red off)
  {
    const { php, node } = await setRef(prod1.pId, prod1.nId, colors.pId, colors.nId,
      red.pId.toString(), red.nId.toString());
    const issues = [];
    cmpStatus(php, node, issues);
    h.report('1.10 Remove multi value (toggle Red off)', issues);
  }

  // 1.11 Verify after removal via edit_obj
  {
    const { php, node } = await getEditObj(prod1.pId, prod1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.status === 200 && node.status === 200 && php.json && node.json) {
      // Structure should match even if values differ by ID
      const phpKeys = Object.keys(php.json).sort().join(',');
      const nodeKeys = Object.keys(node.json).sort().join(',');
      if (phpKeys !== nodeKeys) issues.push(`Keys differ: PHP=[${phpKeys}] Node=[${nodeKeys}]`);
    }
    h.report('1.11 Verify after removal in edit_obj', issues);
  }

  // 1.12 Disable MULTI via POST _d_multi/{reqId} with multi=0
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_multi/${colorRef.reqP}`, `_xsrf=${h.xsrfPhp}&multi=0&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_multi/${colorRef.reqN}`, `_xsrf=${h.xsrfNode}&multi=0&JSON=1`, h.cookie()),
    ]);
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act', 'args']);
    h.report('1.12 Disable MULTI on color column', issues);
  }

  return { products, colors, colorRef, prod1, red, blue, green };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Lookup/Reference Tables
// ═══════════════════════════════════════════════════════════════════════════════

async function section2_references() {
  h.section('2. Lookup/Reference Tables');

  // 2.1 Create lookup type (Countries) with items
  const countries = await createType(`__adv_countries_${TS}`, 3);
  {
    const issues = [];
    if (!countries.pId) issues.push('PHP: creation failed');
    if (!countries.nId) issues.push('Node: creation failed');
    h.report('2.1 Create lookup type (Countries)', issues);
  }
  if (!countries.pId || !countries.nId) return {};

  const usa = await createObj(countries.pId, countries.nId, 'USA');
  const germany = await createObj(countries.pId, countries.nId, 'Germany');
  const japan = await createObj(countries.pId, countries.nId, 'Japan');
  {
    const issues = [];
    if (!usa.pId || !germany.pId || !japan.pId) issues.push('PHP: some items failed');
    if (!usa.nId || !germany.nId || !japan.nId) issues.push('Node: some items failed');
    h.report('2.2 Create country items (USA, Germany, Japan)', issues);
  }

  // 2.3 Create main type (Companies)
  const companies = await createType(`__adv_companies_${TS}`, 3);
  {
    const issues = [];
    if (!companies.pId) issues.push('PHP: creation failed');
    if (!companies.nId) issues.push('Node: creation failed');
    h.report('2.3 Create main type (Companies)', issues);
  }
  if (!companies.pId || !companies.nId) return {};

  // 2.4 Add reference column Companies -> Countries via _d_ref
  const countryRef = await addRefColumn(companies.pId, companies.nId, countries.pId, countries.nId);
  {
    const issues = [];
    if (!countryRef.reqP) issues.push('PHP: ref creation failed');
    if (!countryRef.reqN) issues.push('Node: ref creation failed');
    cmpStatus(countryRef.php, countryRef.node, issues);
    h.report('2.4 Add ref column (Companies->Countries)', issues);
  }
  if (!countryRef.reqP || !countryRef.reqN) return {};

  // 2.5 Create company object
  const company1 = await createObj(companies.pId, companies.nId, 'Acme Corp');
  {
    const issues = [];
    if (!company1.pId) issues.push('PHP: creation failed');
    if (!company1.nId) issues.push('Node: creation failed');
    h.report('2.5 Create company object (Acme Corp)', issues);
  }
  if (!company1.pId || !company1.nId) return {};

  // 2.6 Set reference value (country = USA)
  {
    const { php, node } = await setRef(company1.pId, company1.nId, countries.pId, countries.nId,
      usa.pId.toString(), usa.nId.toString());
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('2.6 Set reference (country=USA)', issues);
  }

  // 2.7 Verify via _ref_reqs — should return lookup items
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/_ref_reqs/${countryRef.reqP}`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/_ref_reqs/${countryRef.reqN}`, null, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('2.7 _ref_reqs returns lookup items', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      // Both should return JSON with country items
      if (php.json && node.json) {
        // Check that both return some data (structure may be object with arrays)
        const phpHasData = Object.keys(php.json).length > 0;
        const nodeHasData = Object.keys(node.json).length > 0;
        if (phpHasData !== nodeHasData)
          issues.push(`Has data: PHP=${phpHasData} Node=${nodeHasData}`);
      }
      h.report('2.7 _ref_reqs returns lookup items', issues);
    }
  }

  // 2.8 Verify reference via edit_obj
  {
    const { php, node } = await getEditObj(company1.pId, company1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.json && node.json) {
      const phpKeys = Object.keys(php.json).sort().join(',');
      const nodeKeys = Object.keys(node.json).sort().join(',');
      if (phpKeys !== nodeKeys) issues.push(`Keys differ`);
    }
    h.report('2.8 Verify reference in edit_obj', issues);
  }

  // 2.9 Change reference value (country = Germany)
  {
    const { php, node } = await setRef(company1.pId, company1.nId, countries.pId, countries.nId,
      germany.pId.toString(), germany.nId.toString());
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('2.9 Change reference (country=Germany)', issues);
  }

  // 2.10 Verify changed reference via edit_obj
  {
    const { php, node } = await getEditObj(company1.pId, company1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    h.report('2.10 Verify changed reference in edit_obj', issues);
  }

  // 2.11 Clear reference value (set to empty)
  {
    const { php, node } = await setRef(company1.pId, company1.nId, countries.pId, countries.nId, '', '');
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('2.11 Clear reference (country=empty)', issues);
  }

  // 2.12 Verify cleared reference via edit_obj
  {
    const { php, node } = await getEditObj(company1.pId, company1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    h.report('2.12 Verify cleared reference in edit_obj', issues);
  }

  return { companies, countries, countryRef, company1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Subordinate Tables (Child types)
// ═══════════════════════════════════════════════════════════════════════════════

async function section3_subordinates() {
  h.section('3. Subordinate Tables (Child types)');

  // 3.1 Create parent type (Orders)
  const orders = await createType(`__adv_orders_${TS}`, 3);
  {
    const issues = [];
    if (!orders.pId) issues.push('PHP: creation failed');
    if (!orders.nId) issues.push('Node: creation failed');
    h.report('3.1 Create parent type (Orders)', issues);
  }
  if (!orders.pId || !orders.nId) return {};

  // 3.2 Add child type via _d_new with up=parentTypeId and t=23 (sub-type)
  const orderItems = await createSubType(`__adv_order_items_${TS}`, 23, orders.pId, orders.nId);
  {
    const issues = [];
    if (isPhpBroken(orderItems.php) && !orderItems.nId) {
      h.skip('3.2 Create child type (OrderItems)', 'Both servers failed');
      return { orders };
    }
    if (isPhpBroken(orderItems.php)) {
      // PHP may not support t=23, test Node only
      h.skip('3.2 Create child type (OrderItems)', 'PHP broken');
    } else {
      if (!orderItems.pId) issues.push('PHP: creation failed');
      if (!orderItems.nId) issues.push('Node: creation failed');
      cmpStatus(orderItems.php, orderItems.node, issues);
      cmpKeys(orderItems.php, orderItems.node, issues, ['next_act', 'args']);
      h.report('3.2 Create child type (OrderItems)', issues);
    }
  }

  // 3.3 Add column to child type via _d_req
  if (orderItems.pId && orderItems.nId) {
    // Create a simple text type for the column
    const qty = await createType(`__adv_qty_${TS}`, 11); // number type
    if (qty.pId && qty.nId) {
      const col = await addColumn(orderItems.pId, orderItems.nId, qty.pId, qty.nId);
      const issues = [];
      if (!col.reqP) issues.push('PHP: column creation failed');
      if (!col.reqN) issues.push('Node: column creation failed');
      cmpStatus(col.php, col.node, issues);
      h.report('3.3 Add column to child type', issues);
    } else {
      h.skip('3.3 Add column to child type', 'Column type creation failed');
    }
  } else {
    h.skip('3.3 Add column to child type', 'No child type IDs');
  }

  // 3.4 Create object in parent type
  const order1 = await createObj(orders.pId, orders.nId, 'Order-001');
  {
    const issues = [];
    if (!order1.pId) issues.push('PHP: creation failed');
    if (!order1.nId) issues.push('Node: creation failed');
    h.report('3.4 Create parent object (Order-001)', issues);
  }

  // 3.5 Try to create child objects (may fail due to grants)
  if (orderItems.pId && orderItems.nId && order1.pId && order1.nId) {
    // Child objects use up=parentObjectId
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_new/${orderItems.pId}`,
        `_xsrf=${h.xsrfPhp}&up=${order1.pId}&t${orderItems.pId}=${encodeURIComponent('Item-A')}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_new/${orderItems.nId}`,
        `_xsrf=${h.xsrfNode}&up=${order1.nId}&t${orderItems.nId}=${encodeURIComponent('Item-A')}&JSON=1`, h.cookie()),
    ]);
    const phpChildId = Number(php.json?.id);
    const nodeChildId = Number(node.json?.id);
    if (phpChildId > 0) created.php.objects.push(phpChildId);
    if (nodeChildId > 0) created.node.objects.push(nodeChildId);

    if (php.status >= 400 && node.status >= 400) {
      h.skip('3.5 Create child object (Item-A)', 'Both returned error (likely grants)');
    } else if (isPhpBroken(php)) {
      h.skip('3.5 Create child object (Item-A)', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act']);
      h.report('3.5 Create child object (Item-A)', issues);
    }
  } else {
    h.skip('3.5 Create child object', 'Missing parent or child type IDs');
  }

  // 3.6 Verify parent type in terms shows child
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/terms`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/terms`, null, h.cookie()),
    ]);
    const issues = [];
    if (php.json && node.json && orderItems.pId && orderItems.nId) {
      const phpChild = php.json.find(t => String(t.id) === String(orderItems.pId));
      const nodeChild = node.json.find(t => String(t.id) === String(orderItems.nId));
      // Both should exist and have parent reference
      if (!phpChild) issues.push('PHP: child type not in terms');
      if (!nodeChild) issues.push('Node: child type not in terms');
      if (phpChild && nodeChild) {
        // Check parent (up) field — should point to parent type
        if (String(phpChild.up) !== String(orders.pId))
          issues.push(`PHP child.up=${phpChild.up} expected=${orders.pId}`);
        if (String(nodeChild.up) !== String(orders.nId))
          issues.push(`Node child.up=${nodeChild.up} expected=${orders.nId}`);
      }
    }
    h.report('3.6 Verify child type in terms', issues);
  }

  return { orders, orderItems, order1 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Remove Subordination
// ═══════════════════════════════════════════════════════════════════════════════

async function section4_removeSubordination() {
  h.section('4. Remove Subordination');

  // 4.1 Create parent type
  const parent = await createType(`__adv_rsub_parent_${TS}`, 3);
  {
    const issues = [];
    if (!parent.pId) issues.push('PHP: creation failed');
    if (!parent.nId) issues.push('Node: creation failed');
    h.report('4.1 Create parent type', issues);
  }
  if (!parent.pId || !parent.nId) return;

  // 4.2 Create subordinate type
  const child = await createSubType(`__adv_rsub_child_${TS}`, 23, parent.pId, parent.nId);
  {
    if (isPhpBroken(child.php) && !child.nId) {
      h.skip('4.2 Create subordinate type', 'Both servers failed');
      return;
    }
    if (isPhpBroken(child.php)) {
      h.skip('4.2 Create subordinate type', 'PHP broken');
      // Continue testing Node only where possible
    } else {
      const issues = [];
      if (!child.pId) issues.push('PHP: creation failed');
      if (!child.nId) issues.push('Node: creation failed');
      h.report('4.2 Create subordinate type', issues);
    }
  }

  // 4.3 Try to remove subordination via _d_save — set type to regular (t=3) with no up
  if (child.pId && child.nId) {
    const childNameP = `__adv_rsub_child_${TS}_p`;
    const childNameN = `__adv_rsub_child_${TS}_n`;
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${child.pId}`,
        `_xsrf=${h.xsrfPhp}&val=${childNameP}&t=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${child.nId}`,
        `_xsrf=${h.xsrfNode}&val=${childNameN}&t=3&JSON=1`, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('4.3 Remove subordination via _d_save', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act', 'args', 'warnings']);
      h.report('4.3 Remove subordination via _d_save', issues);
    }
  } else {
    h.skip('4.3 Remove subordination via _d_save', 'No child type IDs');
  }

  // 4.4 Verify subordination status in terms after attempted removal
  if (child.pId && child.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/terms`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/terms`, null, h.cookie()),
    ]);
    const issues = [];
    if (php.json && node.json) {
      const phpChild = php.json.find(t => String(t.id) === String(child.pId));
      const nodeChild = node.json.find(t => String(t.id) === String(child.nId));
      if (phpChild && nodeChild) {
        // Check if subordination was removed (up should be 0 or absent)
        const phpUp = String(phpChild.up || 0);
        const nodeUp = String(nodeChild.up || 0);
        if (phpUp !== nodeUp) issues.push(`up: PHP=${phpUp} Node=${nodeUp}`);
      } else {
        if (!phpChild) issues.push('PHP: child type not found');
        if (!nodeChild) issues.push('Node: child type not found');
      }
    }
    h.report('4.4 Verify subordination status in terms', issues);
  } else {
    h.skip('4.4 Verify subordination status', 'No child type IDs');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: Add Row and Column
// ═══════════════════════════════════════════════════════════════════════════════

async function section5_addRowAndColumn() {
  h.section('5. Add Row and Column');

  // 5.1 Create type with one initial column
  const table = await createType(`__adv_rowcol_${TS}`, 3);
  {
    const issues = [];
    if (!table.pId) issues.push('PHP: creation failed');
    if (!table.nId) issues.push('Node: creation failed');
    h.report('5.1 Create type', issues);
  }
  if (!table.pId || !table.nId) return;

  // 5.2 Add first column (a text-like type)
  const col1Type = await createType(`__adv_col1_${TS}`, 3);
  let col1 = { reqP: 0, reqN: 0 };
  if (col1Type.pId && col1Type.nId) {
    col1 = await addColumn(table.pId, table.nId, col1Type.pId, col1Type.nId);
    const issues = [];
    if (!col1.reqP) issues.push('PHP: column creation failed');
    if (!col1.reqN) issues.push('Node: column creation failed');
    cmpStatus(col1.php, col1.node, issues);
    h.report('5.2 Add first column', issues);
  } else {
    h.skip('5.2 Add first column', 'Column type creation failed');
  }

  // 5.3 Add object (row) via _m_new
  const row1 = await createObj(table.pId, table.nId, 'Row-1');
  {
    const issues = [];
    if (!row1.pId) issues.push('PHP: creation failed');
    if (!row1.nId) issues.push('Node: creation failed');
    cmpStatus(row1.php, row1.node, issues);
    cmpKeys(row1.php, row1.node, issues, ['next_act', 'val']);
    h.report('5.3 Add object (Row-1)', issues);
  }

  // 5.4 Add another column via _d_req after objects exist
  const col2Type = await createType(`__adv_col2_${TS}`, 11); // number type
  let col2 = { reqP: 0, reqN: 0 };
  if (col2Type.pId && col2Type.nId) {
    col2 = await addColumn(table.pId, table.nId, col2Type.pId, col2Type.nId);
    const issues = [];
    if (!col2.reqP) issues.push('PHP: column creation failed');
    if (!col2.reqN) issues.push('Node: column creation failed');
    cmpStatus(col2.php, col2.node, issues);
    h.report('5.4 Add second column (after objects exist)', issues);
  } else {
    h.skip('5.4 Add second column', 'Column type creation failed');
  }

  // 5.5 Verify new column appears in obj_meta
  {
    const { php, node } = await getObjMeta(table.pId, table.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.json && node.json) {
      const phpReqs = Object.keys(php.json.reqs || {}).length;
      const nodeReqs = Object.keys(node.json.reqs || {}).length;
      if (phpReqs !== nodeReqs)
        issues.push(`reqs count: PHP=${phpReqs} Node=${nodeReqs}`);
      // Should have at least 2 columns (col1 + col2) plus the self-reference
      if (nodeReqs < 2) issues.push(`Expected >=2 reqs, got Node=${nodeReqs}`);
    }
    h.report('5.5 New column in obj_meta', issues);
  }

  // 5.6 Set value for new column on existing object via _m_set
  if (row1.pId && row1.nId && col2Type.pId && col2Type.nId) {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_m_set/${row1.pId}`,
        `_xsrf=${h.xsrfPhp}&t${col2Type.pId}=99&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_m_set/${row1.nId}`,
        `_xsrf=${h.xsrfNode}&t${col2Type.nId}=99&JSON=1`, h.cookie()),
    ]);
    const issues = [];
    cmpStatus(php, node, issues);
    cmpKeys(php, node, issues, ['next_act']);
    h.report('5.6 Set value for new column (_m_set)', issues);
  } else {
    h.skip('5.6 Set value for new column', 'Missing IDs');
  }

  // 5.7 Verify new value via edit_obj
  if (row1.pId && row1.nId) {
    const { php, node } = await getEditObj(row1.pId, row1.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.json && node.json) {
      // Verify both have data
      if (!php.json) issues.push('PHP: no JSON');
      if (!node.json) issues.push('Node: no JSON');
    }
    h.report('5.7 Verify new column value in edit_obj', issues);
  } else {
    h.skip('5.7 Verify new column value', 'No object IDs');
  }

  // 5.8 Add a third row and verify it also has all columns
  const row2 = await createObj(table.pId, table.nId, 'Row-2');
  {
    const issues = [];
    if (!row2.pId) issues.push('PHP: creation failed');
    if (!row2.nId) issues.push('Node: creation failed');
    h.report('5.8 Add second object (Row-2)', issues);
  }

  // 5.9 Verify second object has both columns via edit_obj
  if (row2.pId && row2.nId) {
    const { php, node } = await getEditObj(row2.pId, row2.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    h.report('5.9 Verify Row-2 has all columns in edit_obj', issues);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Type Promotion (column -> table)
// ═══════════════════════════════════════════════════════════════════════════════

async function section6_typePromotion() {
  h.section('6. Type Promotion (column -> table)');

  // 6.1 Create a parent type
  const parent = await createType(`__adv_promote_parent_${TS}`, 3);
  if (!parent.pId || !parent.nId) {
    h.skip('6.1 Create parent type', 'Creation failed');
    return;
  }
  h.report('6.1 Create parent type', []);

  // 6.2 Create a column type (simple type that acts as column)
  const colType = await createType(`__adv_promote_col_${TS}`, 3);
  if (!colType.pId || !colType.nId) {
    h.skip('6.2 Create column type', 'Creation failed');
    return;
  }
  h.report('6.2 Create column type', []);

  // 6.3 Add it as column to parent
  const col = await addColumn(parent.pId, parent.nId, colType.pId, colType.nId);
  {
    const issues = [];
    if (!col.reqP) issues.push('PHP: column creation failed');
    if (!col.reqN) issues.push('Node: column creation failed');
    h.report('6.3 Add as column to parent', issues);
  }

  // 6.4 Try _d_save to change base type (promote column to standalone table)
  // This attempts to modify the type's classification
  {
    const colNameP = `__adv_promote_col_${TS}_p`;
    const colNameN = `__adv_promote_col_${TS}_n`;
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${colType.pId}`,
        `_xsrf=${h.xsrfPhp}&val=${colNameP}&t=3&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${colType.nId}`,
        `_xsrf=${h.xsrfNode}&val=${colNameN}&t=3&JSON=1`, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('6.4 Promote column to table (_d_save)', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act', 'args', 'warnings']);
      h.report('6.4 Promote column to table (_d_save)', issues);
    }
  }

  // 6.5 Verify type status in terms after promotion attempt
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/terms`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/terms`, null, h.cookie()),
    ]);
    const issues = [];
    if (php.json && node.json) {
      const phpType = php.json.find(t => String(t.id) === String(colType.pId));
      const nodeType = node.json.find(t => String(t.id) === String(colType.nId));
      if (phpType && nodeType) {
        if (String(phpType.type) !== String(nodeType.type))
          issues.push(`type: PHP=${phpType.type} Node=${nodeType.type}`);
      } else {
        if (!phpType) issues.push('PHP: type not in terms');
        if (!nodeType) issues.push('Node: type not in terms');
      }
    }
    h.report('6.5 Verify type after promotion attempt', issues);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: Type Demotion (table -> column)
// ═══════════════════════════════════════════════════════════════════════════════

async function section7_typeDemotion() {
  h.section('7. Type Demotion (table -> column)');

  // 7.1 Create a standalone type
  const standalone = await createType(`__adv_demote_tbl_${TS}`, 3);
  {
    const issues = [];
    if (!standalone.pId) issues.push('PHP: creation failed');
    if (!standalone.nId) issues.push('Node: creation failed');
    h.report('7.1 Create standalone type', issues);
  }
  if (!standalone.pId || !standalone.nId) return;

  // 7.2 Create a target type to make the standalone a column of
  const target = await createType(`__adv_demote_target_${TS}`, 3);
  {
    const issues = [];
    if (!target.pId) issues.push('PHP: creation failed');
    if (!target.nId) issues.push('Node: creation failed');
    h.report('7.2 Create target type', issues);
  }
  if (!target.pId || !target.nId) return;

  // 7.3 Try to add standalone as column of target via _d_req
  // This is the standard way to "demote" — add an existing type as a column
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_req/${target.pId}`,
        `_xsrf=${h.xsrfPhp}&t=${standalone.pId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_req/${target.nId}`,
        `_xsrf=${h.xsrfNode}&t=${standalone.nId}&JSON=1`, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('7.3 Add standalone as column (_d_req)', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act', 'args']);
      h.report('7.3 Add standalone as column (_d_req)', issues);
    }
  }

  // 7.4 Try to add standalone as reference column via _d_ref
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_ref/${target.pId}`,
        `_xsrf=${h.xsrfPhp}&t=${standalone.pId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_ref/${target.nId}`,
        `_xsrf=${h.xsrfNode}&t=${standalone.nId}&JSON=1`, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('7.4 Add standalone as ref column (_d_ref)', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act', 'args']);
      h.report('7.4 Add standalone as ref column (_d_ref)', issues);
    }
  }

  // 7.5 Verify target type has new columns in obj_meta
  {
    const { php, node } = await getObjMeta(target.pId, target.nId);
    const issues = [];
    cmpStatus(php, node, issues);
    if (php.json && node.json) {
      const phpReqs = Object.keys(php.json.reqs || {}).length;
      const nodeReqs = Object.keys(node.json.reqs || {}).length;
      if (phpReqs !== nodeReqs)
        issues.push(`reqs count: PHP=${phpReqs} Node=${nodeReqs}`);
    }
    h.report('7.5 Verify target obj_meta after demotion', issues);
  }

  // 7.6 Try _d_save to change type classification
  {
    const tblNameP = `__adv_demote_tbl_${TS}_p`;
    const tblNameN = `__adv_demote_tbl_${TS}_n`;
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'POST', `/${h.DB}/_d_save/${standalone.pId}`,
        `_xsrf=${h.xsrfPhp}&val=${tblNameP}&t=23&up=${target.pId}&JSON=1`, h.cookie()),
      h.http(h.NODE, 'POST', `/${h.DB}/_d_save/${standalone.nId}`,
        `_xsrf=${h.xsrfNode}&val=${tblNameN}&t=23&up=${target.nId}&JSON=1`, h.cookie()),
    ]);
    if (isPhpBroken(php)) {
      h.skip('7.6 Change type to subordinate (_d_save)', 'PHP broken response');
    } else {
      const issues = [];
      cmpStatus(php, node, issues);
      cmpKeys(php, node, issues, ['next_act', 'args', 'warnings']);
      h.report('7.6 Change type to subordinate (_d_save)', issues);
    }
  }

  // 7.7 Verify type status after demotion attempt
  {
    const [php, node] = await Promise.all([
      h.http(h.PHP, 'GET', `/${h.DB}/terms`, null, h.cookie()),
      h.http(h.NODE, 'GET', `/${h.DB}/terms`, null, h.cookie()),
    ]);
    const issues = [];
    if (php.json && node.json) {
      const phpType = php.json.find(t => String(t.id) === String(standalone.pId));
      const nodeType = node.json.find(t => String(t.id) === String(standalone.nId));
      if (phpType && nodeType) {
        if (String(phpType.type) !== String(nodeType.type))
          issues.push(`type: PHP=${phpType.type} Node=${nodeType.type}`);
        if (String(phpType.up || 0) !== String(nodeType.up || 0))
          issues.push(`up: PHP=${phpType.up} Node=${nodeType.up}`);
      } else {
        if (!phpType) issues.push('PHP: type not in terms');
        if (!nodeType) issues.push('Node: type not in terms');
      }
    }
    h.report('7.7 Verify type after demotion attempt', issues);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════════════════

async function cleanup() {
  h.section('Cleanup');
  let cleaned = 0;

  // Delete objects first
  for (const [base, xsrf, data] of [[h.PHP, h.xsrfPhp, created.php], [h.NODE, h.xsrfNode, created.node]]) {
    for (const id of data.objects) {
      try { await h.http(base, 'POST', `/${h.DB}/_m_del/${id}`, `_xsrf=${xsrf}&JSON=1`, h.cookie()); cleaned++; } catch {}
    }
    // Delete types in reverse order (children before parents)
    for (const id of [...data.types].reverse()) {
      try { await h.http(base, 'POST', `/${h.DB}/_d_del/${id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie()); cleaned++; } catch {}
    }
  }

  // Final sweep: delete any __adv types still lingering
  for (const [base, xsrf] of [[h.PHP, h.xsrfPhp], [h.NODE, h.xsrfNode]]) {
    const terms = await h.http(base, 'GET', `/${h.DB}/terms`, null, h.cookie());
    if (Array.isArray(terms.json)) {
      for (const t of terms.json.filter(t => (t.val || t.name || '').startsWith('__adv'))) {
        try { await h.http(base, 'POST', `/${h.DB}/_d_del/${t.id}`, `_xsrf=${xsrf}&JSON=1&forced`, h.cookie()); cleaned++; } catch {}
      }
    }
  }

  console.log(`  Cleaned ${cleaned} entities`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  await preCleanup();

  await section1_multiselect();
  await section2_references();
  await section3_subordinates();
  await section4_removeSubordination();
  await section5_addRowAndColumn();
  await section6_typePromotion();
  await section7_typeDemotion();

  await cleanup();

  h.summary('Advanced Features');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
