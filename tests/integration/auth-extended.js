#!/usr/bin/env node
/**
 * Extended Auth & Session parity tests.
 * Covers: tzone, change pwd, validate, jwt, register, secret, getcode/checkcode edge cases.
 */
import h from './lib/helpers.js';
const TS = Date.now();

async function run() {
  await h.setup();
  console.log(`Token: ${h.token.slice(0, 8)}...`);

  h.section('Auth — Extended');

  // Auth with tzone
  {
    const { php, node, skipped } = await h.cmp('auth tzone', 'POST', '/auth',
      `login=${h.USER}&pwd=${h.PASS}&tzone=3&JSON=1`);
    if (!skipped) h.report('auth tzone', php.status !== node.status ? [`Status: PHP=${php.status} Node=${node.status}`] : []);
  }

  // Auth change pwd — mismatched new passwords
  {
    const { php, node, skipped } = await h.cmp('auth change mismatch', 'POST', '/auth',
      `login=${h.USER}&pwd=${h.PASS}&change=1&npw1=newpass1&npw2=different&JSON=1`);
    if (!skipped) h.report('auth change mismatch', php.status !== node.status ? [`Status`] : []);
  }

  // Auth change pwd — short new password
  {
    const { php, node, skipped } = await h.cmp('auth change short', 'POST', '/auth',
      `login=${h.USER}&pwd=${h.PASS}&change=1&npw1=ab&npw2=ab&JSON=1`);
    if (!skipped) h.report('auth change short', php.status !== node.status ? [`Status`] : []);
  }

  // Auth with secret= (invalid)
  {
    const { php, node, skipped } = await h.cmp('auth secret invalid', 'POST', '/auth',
      `secret=invalid_secret_token_${TS}&JSON=1`);
    if (!skipped) h.report('auth secret invalid', php.status !== node.status ? [`Status`] : []);
  }

  // GET auth?secret= (invalid)
  {
    const { php, node, skipped } = await h.cmp('GET auth?secret', 'GET', '/auth?secret=invalid_token');
    if (!skipped) h.report('GET auth?secret', php.status !== node.status ? [`Status`] : []);
  }

  h.section('Validate');

  // Validate with token
  {
    const { php, node, skipped } = await h.cmp('validate', 'GET', '/validate?JSON=1');
    if (!skipped) h.report('validate', php.status !== node.status ? [`Status`] : []);
  }

  // Validate no token
  {
    const { php, node, skipped } = await h.cmp('validate no token', 'GET', '/validate?JSON=1', null, { cookie: '' });
    if (!skipped) h.report('validate no token', php.status !== node.status ? [`Status`] : []);
  }

  // Validate no JSON
  {
    const { php, node, skipped } = await h.cmp('validate no JSON', 'GET', '/validate');
    if (!skipped) h.report('validate no JSON', php.status !== node.status ? [`Status`] : []);
  }

  h.section('JWT');

  // JWT empty
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}/jwt`, 'jwt=&JSON=1');
    h.nodeOnly('jwt empty', n, (n, iss) => {
      if (n.status === 200 && n.json?.token) iss.push('Should not succeed with empty jwt');
    });
  }

  // JWT invalid
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}/jwt`, 'jwt=invalid.token.here&JSON=1');
    h.nodeOnly('jwt invalid', n, (n, iss) => {
      if (n.status === 200 && n.json?.token) iss.push('Should not succeed with invalid jwt');
    });
  }

  // JWT malformed (3 parts but bad)
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}/jwt`, 'jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.invalidsig&JSON=1');
    h.nodeOnly('jwt malformed sig', n, (n, iss) => {
      if (n.status === 200 && n.json?.token) iss.push('Should not succeed');
    });
  }

  // JWT via token= param
  {
    const n = await h.http(h.NODE, 'POST', `/${h.DB}/jwt`, 'token=invalid.jwt&JSON=1');
    h.nodeOnly('jwt via token=', n, (n, iss) => {
      if (n.status === 200 && n.json?.token) iss.push('Should not succeed');
    });
  }

  h.section('Register');

  // Invalid email
  {
    const n = await h.http(h.NODE, 'POST', `/my/register`, 'email=not-an-email&regpwd=password123&regpwd1=password123&agree=1&JSON=1');
    h.nodeOnly('register invalid email', n, (n, iss) => {
      if (!(n.json?.error || n.json?.[0]?.error) && n.status === 200) iss.push('Should reject invalid email');
    });
  }

  // Short password
  {
    const n = await h.http(h.NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=ab&regpwd1=ab&agree=1&JSON=1');
    h.nodeOnly('register short pwd', n, (n, iss) => {
      if (!(n.json?.error || n.json?.[0]?.error) && n.status === 200) iss.push('Should reject short pwd');
    });
  }

  // Password mismatch
  {
    const n = await h.http(h.NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=password1&regpwd1=password2&agree=1&JSON=1');
    h.nodeOnly('register pwd mismatch', n, (n, iss) => {
      if (!(n.json?.error || n.json?.[0]?.error) && n.status === 200) iss.push('Should reject mismatch');
    });
  }

  // No agree
  {
    const n = await h.http(h.NODE, 'POST', `/my/register`, 'email=test@test.com&regpwd=password1&regpwd1=password1&JSON=1');
    h.nodeOnly('register no agree', n, (n, iss) => {
      if (!(n.json?.error || n.json?.[0]?.error) && n.status === 200) iss.push('Should reject no agree');
    });
  }

  h.section('Getcode/Checkcode — Extended');

  // getcode with tzone
  {
    const { php, node, skipped } = await h.cmp('getcode tzone', 'POST', '/getcode', `u=${h.USER}&tzone=3`);
    if (!skipped) h.report('getcode tzone', php.status !== node.status ? [`Status`] : []);
  }

  // checkcode nonexistent user
  {
    const { php, node, skipped } = await h.cmp('checkcode nonexistent', 'POST', '/checkcode', `u=nonexistent_${TS}&c=1234`);
    if (!skipped) h.report('checkcode nonexistent', php.status !== node.status ? [`Status`] : []);
  }

  h.section('Confirm — Extended');

  // confirm GET with JSON
  {
    const { php, node, skipped } = await h.cmp('confirm GET JSON', 'GET', '/confirm?JSON=1');
    if (!skipped) h.report('confirm GET JSON', php.status !== node.status ? [`Status`] : []);
  }

  h.summary('Auth Extended');
}

run().catch(err => { console.error(err); process.exit(1); });
