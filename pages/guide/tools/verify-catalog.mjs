import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const catalog = JSON.parse(await readFile(new URL('../../../shared/finance/products.json', import.meta.url), 'utf8'));
const products = catalog.products;
const legacyIds = ['kb-regional-guarantee', 'kb-soho-credit', 'kb-owner-overdraft', 'kb-119plus', 'kb-soho-collateral', 'kb-general-working-capital', 'kb-growth-business', 'semas-policy-2026'];
const categories = ['business', 'corporate', 'property', 'policy'];
const officialHosts = new Set(['obiz.kbstar.com', 'obizapi.kbstar.com', 'zloan.kbstar.com', 'obank.kbstar.com', 'www.mss.go.kr', 'ols.semas.or.kr', 'www.bizinfo.go.kr']);

test('catalog retains stable existing IDs and has no duplicate IDs or product records', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.verifiedAt, '2026-10-26');
  assert.ok(Array.isArray(products) && products.length > legacyIds.length);
  const ids = new Set(products.map(p => p.id));
  assert.equal(ids.size, products.length);
  for (const id of legacyIds) assert.ok(ids.has(id), id);
  const bankSourceKeys = products.filter(p => p.entryType === 'product').map(p => {
    const url = new URL(p.sourceUrl);
    return `${url.hostname}:${url.searchParams.get('prcode') || url.searchParams.get('page')}`;
  });
  assert.equal(new Set(bankSourceKeys).size, bankSourceKeys.length, 'same official product must not be listed twice');
});

test('every item contains inspectable conditions and only official HTTPS source links', () => {
  const required = ['id', 'name', 'provider', 'summary', 'rateText', 'limitText', 'termText', 'repaymentText', 'sourceTitle', 'sourceUrl', 'status'];
  function verifyUrl(value) {
    const url = new URL(value);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.username + url.password + url.port, '');
    assert.ok(officialHosts.has(url.hostname), value);
  }
  for (const p of products) {
    for (const field of required) assert.ok(typeof p[field] === 'string' && p[field].trim(), `${p.id}: ${field}`);
    for (const field of ['purposes', 'eligibility', 'documents', 'checks', 'tags']) {
      assert.ok(Array.isArray(p[field]), `${p.id}: ${field}`);
      assert.ok(p[field].every(value => typeof value === 'string' && value.trim()), `${p.id}: ${field}`);
      if (field !== 'documents') assert.ok(p[field].length, `${p.id}: ${field}`);
    }
    assert.ok(categories.includes(p.category), p.id);
    assert.ok(p.roles.length && p.roles.every(role => ['tenant', 'landlord'].includes(role)), p.id);
    assert.equal(new Set(p.roles).size, p.roles.length);
    assert.equal(p.verifiedAt, catalog.verifiedAt, p.id);
    assert.ok(p.referenceDate === null || typeof p.referenceDate === 'string', p.id);
    verifyUrl(p.sourceUrl);
    for (const source of p.additionalSources || []) { assert.ok(source.title?.trim()); verifyUrl(source.url); }
  }
});

test('overview and actual funds are distinct, and published scope matches actual data', () => {
  const byId = new Map(products.map(p => [p.id, p]));
  for (const p of products) {
    assert.ok(['product', 'fund', 'overview'].includes(p.entryType), p.id);
    if (p.entryType === 'fund') {
      assert.equal(p.category, 'policy');
      assert.equal(byId.get(p.parentId)?.entryType, 'overview', p.id);
      assert.notEqual(p.id, p.parentId);
    } else assert.equal(p.parentId, undefined, p.id);
    if (p.entryType === 'overview') assert.equal(p.category, 'policy');
    if (p.entryType === 'product') assert.notEqual(p.category, 'policy');
  }
  assert.equal(catalog.scope.bankProducts, products.filter(p => p.entryType === 'product').length);
  assert.equal(catalog.scope.policyFunds, products.filter(p => p.entryType === 'fund').length);
  assert.equal(catalog.scope.policyOverviews, products.filter(p => p.entryType === 'overview').length);
  assert.equal(catalog.scope.automaticEligibility, false);
});

test('landlord routes preserve industry and borrower limitations', () => {
  const landlord = products.filter(p => p.roles.includes('landlord'));
  assert.ok(landlord.length > 2);
  assert.equal(landlord.filter(p => p.category === 'policy').length, 0, 'real estate industry exclusion remains in force');
  for (const p of landlord.filter(p => ['business', 'corporate'].includes(p.category))) {
    const conditions = [...p.eligibility, ...p.checks].join(' ');
    assert.match(conditions, /임대업/);
    assert.match(conditions, /확인/);
    assert.match(conditions, /용도|목적/);
  }
  for (const p of products.filter(p => p.category === 'property')) {
    assert.match(p.summary, /개인/);
    assert.match(p.summary, /주택 외/);
    assert.deepEqual(p.roles, ['landlord']);
    assert.ok(p.checks.some(text => /자금용도/.test(text)));
  }
  for (const p of products.filter(p => p.entryType === 'fund')) {
    assert.match(p.eligibility.join(' '), /부동산업.*제외/);
    assert.match(p.status, /접수.*예산.*재확인/);
  }
});

test('role and category totals reconcile without counting an overview as a product', () => {
  const count = selected => ({
    guides: selected.length,
    productsAndFunds: selected.filter(p => p.entryType !== 'overview').length,
    byCategory: Object.fromEntries(categories.map(category => [category, selected.filter(p => p.category === category).length]))
  });
  const overview = Object.fromEntries(['tenant', 'landlord'].map(role => [role, count(products.filter(p => p.roles.includes(role)))]));
  for (const role of Object.values(overview)) assert.equal(Object.values(role.byCategory).reduce((a, b) => a + b, 0), role.guides);
  assert.equal(count(products).productsAndFunds + catalog.scope.policyOverviews, products.length);
  console.log(JSON.stringify({ all: count(products), ...overview }));
});
