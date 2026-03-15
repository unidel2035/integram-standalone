#!/usr/bin/env node
/**
 * Extended Reports parity tests.
 * Covers: FR_/TO_/EQ_/LIKE_ filters, ORDER, LIMIT offset, TOTALS, SELECT,
 * field_names, csv, POST action=report, RECORD_COUNT.
 */
import h from './lib/helpers.js';

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  // Get available reports
  const nodeList = await h.http(h.NODE, 'GET', `/${h.DB}/report?JSON=1`, null, h.cookie());
  if (!nodeList.json || !Array.isArray(nodeList.json) || nodeList.json.length === 0) {
    h.skip('reports', 'No reports available');
    h.summary('Reports Extended');
    return;
  }

  const reportId = nodeList.json[0].id || nodeList.json[0].ID;
  console.log(`  Using report: ${reportId}`);

  // First, get report structure to find column names
  const structure = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON=1`, null, h.cookie());
  const columns = structure.json?.columns || [];
  const firstCol = columns[0]?.name || columns[0]?.alias || '';
  console.log(`  Columns: ${columns.map(c => c.name || c.alias).join(', ').slice(0, 80)}`);

  h.section('Reports — Formats');

  // All JSON formats
  for (const [param, name] of [
    ['JSON=1', 'JSON'], ['JSON_DATA', 'JSON_DATA'], ['JSON_KV', 'JSON_KV'],
    ['JSON_CR', 'JSON_CR'], ['JSON_HR', 'JSON_HR'], ['RECORD_COUNT', 'RECORD_COUNT'],
  ]) {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?${param}`, null, h.cookie());
    h.nodeOnly(`report?${name}`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  h.section('Reports — LIMIT & Offset');

  // LIMIT=2
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&LIMIT=2`, null, h.cookie());
    h.nodeOnly('LIMIT=2', n, (n, iss) => {
      if (Array.isArray(n.json) && n.json.length > 2) iss.push(`${n.json.length} rows`);
    });
  }

  // LIMIT=offset,count (e.g. LIMIT=2,3)
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&LIMIT=2,3`, null, h.cookie());
    h.nodeOnly('LIMIT=2,3 offset', n, (n, iss) => {
      if (Array.isArray(n.json) && n.json.length > 3) iss.push(`${n.json.length} rows`);
    });
  }

  // F= offset (paginaton)
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON=1&F=5`, null, h.cookie());
    h.nodeOnly('F=5 offset', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  h.section('Reports — Sorting');

  // ORDER=column
  if (firstCol) {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&ORDER=${firstCol}`, null, h.cookie());
    h.nodeOnly(`ORDER=${firstCol}`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // ORDER=column DESC
  if (firstCol) {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&ORDER=${firstCol}+DESC`, null, h.cookie());
    h.nodeOnly(`ORDER=${firstCol} DESC`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  h.section('Reports — Filters');

  if (firstCol) {
    // FR_ (from)
    {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&FR_${firstCol}=a`, null, h.cookie());
      h.nodeOnly(`FR_${firstCol}=a`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }

    // TO_ (to)
    {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&TO_${firstCol}=z`, null, h.cookie());
      h.nodeOnly(`TO_${firstCol}=z`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }

    // EQ_ (equals)
    {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&EQ_${firstCol}=test`, null, h.cookie());
      h.nodeOnly(`EQ_${firstCol}=test`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }

    // LIKE_ (contains)
    {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&LIKE_${firstCol}=test`, null, h.cookie());
      h.nodeOnly(`LIKE_${firstCol}=test`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }

    // FR_ + TO_ range
    {
      const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&FR_${firstCol}=a&TO_${firstCol}=m`, null, h.cookie());
      h.nodeOnly(`FR+TO range`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
    }
  }

  h.section('Reports — Advanced');

  // SELECT=col1,col2 (subset of columns)
  if (columns.length >= 2) {
    const sel = columns.slice(0, 2).map(c => c.name || c.alias).join(',');
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON_KV&SELECT=${sel}`, null, h.cookie());
    h.nodeOnly(`SELECT=${sel}`, n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // field_names=1
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?JSON=1&field_names=1`, null, h.cookie());
    h.nodeOnly('field_names=1', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // csv format
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?csv`, null, h.cookie());
    h.nodeOnly('report?csv', n, (n, iss) => {
      const ct = n.headers['content-type'] || '';
      if (!ct.includes('text/csv') && !ct.includes('application/') && !ct.includes('text/plain'))
        iss.push(`Content-Type: ${ct}`);
    });
  }

  // format=csv (alternate)
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/${reportId}?format=csv`, null, h.cookie());
    h.nodeOnly('report?format=csv', n, (n, iss) => {
      if (n.status >= 500) iss.push(`Status ${n.status}`);
    });
  }

  h.section('Reports — POST action=report');

  // POST action=report
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}`, `action=report&id=${reportId}&JSON=1&_xsrf=${h.xsrfNode}`, h.cookie());
    h.nodeOnly('POST action=report JSON', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // POST action=report JSON_KV
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}`, `action=report&id=${reportId}&JSON_KV&_xsrf=${h.xsrfNode}`, h.cookie());
    h.nodeOnly('POST action=report JSON_KV', n, (n, iss) => { if (!n.json) iss.push('Not JSON'); });
  }

  // POST action=report LIMIT
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}`, `action=report&id=${reportId}&JSON_KV&LIMIT=3&_xsrf=${h.xsrfNode}`, h.cookie());
    h.nodeOnly('POST action=report LIMIT=3', n, (n, iss) => {
      if (Array.isArray(n.json) && n.json.length > 3) iss.push(`${n.json.length} rows`);
    });
  }

  // Nonexistent report
  {
    const n = await h.http(h.NODE, 'GET', `/${h.DB}/report/999999999?JSON=1`, null, h.cookie());
    h.nodeOnly('report nonexistent', n, (n, iss) => {
      if (n.status === 200 && n.json?.data?.length > 0) iss.push('Got data for nonexistent');
    });
  }

  h.summary('Reports Extended');
}

run().catch(err => { console.error(err); process.exit(1); });
