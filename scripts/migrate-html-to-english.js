/**
 * One-time migration: bake ENGLISH (the project's default language) directly into
 * the static frontend HTML, so English visitors paint the correct text on first
 * render WITHOUT the early-boot script having to hide <body> and wait for the large
 * i18n.js dictionary to download + translate. (That hide-and-wait is what made the
 * site feel slow / blank on slow connections.)
 *
 * Strategy (SAFE — no full re-serialization):
 *   1. Load the canonical translation dictionary by executing /public/js/i18n.js in
 *      a sandbox (so this script and the runtime share ONE source of truth).
 *   2. Parse each HTML file with node-html-parser ONLY to locate nodes and their exact
 *      source ranges. We never re-serialize the document — we splice the original file
 *      string at those ranges, so everything else stays byte-for-byte identical.
 *   3. For each translated node we reproduce EXACTLY what i18n.js does at runtime:
 *        - [data-translate]/[data-i18n], no element children  -> element.textContent = EN
 *          (replace the whole inner content with the escaped EN string)
 *        - [data-translate]/[data-i18n] WITH element children -> updateTextNodes():
 *          replace ONLY the first non-empty text node with EN (keep nested <span>/<strong>)
 *        - [data-translate-placeholder]/[data-i18n-placeholder] -> placeholder = EN
 *
 * Intentionally SKIPPED (left for the runtime to handle, exactly as today — no regression):
 *   - data-translate-attr elements (handled as attributes; the only one is already EN)
 *   - empty elements (nothing to flash; runtime fills them)
 *   - dictionary values that contain raw HTML ("<") — would be unsafe to escape
 *   - keys missing from the dictionary or with empty EN
 *   - nodes already in English
 *
 * Usage:
 *   node scripts/migrate-html-to-english.js          # DRY RUN (no writes) — prints a report
 *   node scripts/migrate-html-to-english.js --apply  # writes the changes
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parse, NodeType } = require('node-html-parser');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const I18N_JS = path.join(FRONTEND_DIR, 'public', 'js', 'i18n.js');
const APPLY = process.argv.includes('--apply');

// --- Load the dictionary from i18n.js (single source of truth) ---
function loadDictionary() {
  const code = fs.readFileSync(I18N_JS, 'utf8');
  const makeEl = () => ({
    style: {}, children: [], childNodes: [],
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementsByTagName() { return []; }, classList: { add() {}, remove() {}, contains() { return false; } },
  });
  const storage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
  const doc = {
    createElement: makeEl, head: makeEl(), body: makeEl(), documentElement: makeEl(),
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, getElementsByTagName() { return [makeEl()]; },
  };
  const win = {};
  Object.assign(win, {
    window: win, document: doc, localStorage: storage(), sessionStorage: storage(),
    navigator: { language: 'en' }, location: { href: '', search: '' },
    setTimeout: () => 0, clearTimeout: () => {}, addEventListener() {}, console: { log() {}, warn() {}, error() {} },
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
    getComputedStyle: () => ({}), fetch: () => Promise.resolve({}),
  });
  const ctx = vm.createContext(win);
  try { vm.runInContext(code, ctx, { timeout: 8000 }); } catch (e) { /* late DOM errors after the dict is defined are irrelevant */ }
  if (!win.translations || Object.keys(win.translations).length === 0) {
    throw new Error('Failed to load window.translations from i18n.js');
  }
  return win.translations;
}

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s, q) => {
  let out = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  out = q === '"' ? out.replace(/"/g, '&quot;') : out.replace(/'/g, '&#39;');
  return out;
};

// scan from the '<' at `start`, return the index right AFTER the open tag's '>'
function findOpenTagEnd(src, start) {
  let q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return i + 1;
  }
  return src.length;
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || p === path.join(FRONTEND_DIR, 'public', 'js')) continue; out = out.concat(walk(p)); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const T = loadDictionary();
const stats = {
  files: 0, changedFiles: 0,
  textChange: 0, nestedChange: 0, placeholderChange: 0, placeholderInsert: 0,
  alreadyEn: 0, skipEmpty: 0, skipHtmlValue: 0, skipAttrDirective: 0,
  missingEn: 0, keyNotFound: 0, skipNestedNoText: 0,
};
const knfKeys = new Set();
const examples = [];

for (const file of walk(FRONTEND_DIR)) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('data-translate') && !html.includes('data-i18n')) continue;
  stats.files++;
  const root = parse(html, { comment: false });
  const repls = [];

  // 1) MAIN TEXT: [data-translate] / [data-i18n]
  for (const el of root.querySelectorAll('[data-translate], [data-i18n]')) {
    const key = el.getAttribute('data-translate') || el.getAttribute('data-i18n');
    if (el.getAttribute('data-translate-attr')) { stats.skipAttrDirective++; continue; }
    const entry = T[key];
    if (!entry) { stats.keyNotFound++; knfKeys.add(key); continue; }
    const en = entry.en;
    if (en == null || en === '') { stats.missingEn++; continue; }
    if (String(en).includes('<')) { stats.skipHtmlValue++; continue; }
    const childNodes = el.childNodes;
    if (childNodes.length === 0) { stats.skipEmpty++; continue; }
    const elemChildren = el.children; // HTMLElements only
    if (elemChildren.length === 0) {
      if (el.text.trim() === String(en).trim()) { stats.alreadyEn++; continue; }
      const start = childNodes[0].range[0];
      const end = childNodes[childNodes.length - 1].range[1];
      repls.push({ start, end, text: escapeText(en), key, kind: 'text' });
      stats.textChange++;
    } else {
      const tn = childNodes.find((n) => n.nodeType === NodeType.TEXT_NODE && n.text.trim() !== '');
      if (!tn) { stats.skipNestedNoText++; continue; }
      if (tn.text.trim() === String(en).trim()) { stats.alreadyEn++; continue; }
      repls.push({ start: tn.range[0], end: tn.range[1], text: escapeText(en), key, kind: 'nested' });
      stats.nestedChange++;
    }
    if (examples.length < 12) examples.push(`[${path.basename(file)}] ${key} -> "${String(en).slice(0, 45)}"`);
  }

  // 2) PLACEHOLDERS: [data-translate-placeholder] / [data-i18n-placeholder]
  for (const d of ['data-translate-placeholder', 'data-i18n-placeholder']) {
    for (const el of root.querySelectorAll(`[${d}]`)) {
      const key = el.getAttribute(d);
      const entry = T[key];
      if (!entry || entry.en == null || entry.en === '') { stats.missingEn++; if (!entry) knfKeys.add(key); continue; }
      const en = String(entry.en);
      if (en.includes('<')) { stats.skipHtmlValue++; continue; }
      if (el.getAttribute('placeholder') === en) { stats.alreadyEn++; continue; }
      const ots = el.range[0];
      const ote = findOpenTagEnd(html, ots);
      const openTag = html.slice(ots, ote);
      const m = openTag.match(/(\splaceholder\s*=\s*)(["'])([\s\S]*?)\2/i);
      if (m) {
        const q = m[2];
        const absStart = ots + m.index;
        repls.push({ start: absStart, end: absStart + m[0].length, text: m[1] + q + escapeAttr(en, q) + q, key, kind: 'placeholder' });
        stats.placeholderChange++;
      } else {
        let insAt = ote - 1;
        if (html[ote - 2] === '/') insAt = ote - 2;
        repls.push({ start: insAt, end: insAt, text: ` placeholder="${escapeAttr(en, '"')}"`, key, kind: 'placeholder-insert' });
        stats.placeholderInsert++;
      }
    }
  }

  if (repls.length === 0) continue;

  // apply: descending by start so earlier offsets stay valid; assert no overlaps
  repls.sort((a, b) => b.start - a.start);
  for (let i = 0; i < repls.length - 1; i++) {
    if (repls[i].start < repls[i + 1].end) {
      throw new Error(`Overlapping replacements in ${file}: ${JSON.stringify(repls[i])} vs ${JSON.stringify(repls[i + 1])}`);
    }
  }
  let out = html;
  for (const r of repls) out = out.slice(0, r.start) + r.text + out.slice(r.end);
  if (out !== html) {
    stats.changedFiles++;
    if (APPLY) fs.writeFileSync(file, out, 'utf8');
  }
}

console.log(`\n=== migrate-html-to-english.js (${APPLY ? 'APPLY — writing files' : 'DRY RUN — no writes'}) ===`);
console.log('Files scanned with i18n:', stats.files, '| files that change:', stats.changedFiles);
console.log('\nCHANGES:');
console.log('  text (replace inner)      :', stats.textChange);
console.log('  nested (first text node)  :', stats.nestedChange);
console.log('  placeholder (replace)     :', stats.placeholderChange);
console.log('  placeholder (insert)      :', stats.placeholderInsert);
console.log('\nSKIPPED (no change, by design):');
console.log('  already English           :', stats.alreadyEn);
console.log('  empty element             :', stats.skipEmpty);
console.log('  value contains HTML "<"   :', stats.skipHtmlValue);
console.log('  data-translate-attr       :', stats.skipAttrDirective);
console.log('  missing/empty EN          :', stats.missingEn);
console.log('  key not in dictionary     :', stats.keyNotFound, knfKeys.size ? `(unique: ${[...knfKeys].join(', ')})` : '');
console.log('  nested w/o text node      :', stats.skipNestedNoText);
console.log('\nEXAMPLES:');
examples.forEach((e) => console.log('  ' + e));
if (!APPLY) console.log('\nRun with --apply to write these changes.');
