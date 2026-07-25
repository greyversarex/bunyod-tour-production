/**
 * One-time migration: add data-cfasync="false" to EVERY <script> tag in the
 * frontend HTML pages and shared fragments (_header.html / _footer.html).
 *
 * WHY: production (bunyodtour.tj) sits behind Cloudflare with "Rocket Loader"
 * enabled. Rocket Loader rewrites every <script type="..."> to a non-executable
 * type (e.g. type="3b1cd9b0...-text/javascript") and runs the scripts
 * asynchronously LATER. That breaks the i18n early-boot (it must run
 * synchronously, before the first paint, to hide <body> until translation), so
 * the hardcoded Russian markup flashes before i18n.js translates the page.
 *
 * data-cfasync="false" tells Rocket Loader to leave a script alone, so it runs
 * in its natural order — exactly like the dev environment (which has no flash).
 * We apply it to ALL scripts (not just the boot) so the relative execution order
 * of the whole pipeline is preserved and no script ends up half-deferred.
 *
 * Idempotent: a script that already has data-cfasync is skipped.
 */
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Match the opening <script ...> tag only:
//   (?=[\s>])            -> next char is whitespace or '>', so we never match
//                           string literals like '<script' inside inline JS.
//   (?![^>]*data-cfasync)-> within this opening tag there is no data-cfasync yet
//                           (keeps the migration idempotent).
const SCRIPT_OPEN_RE = /<script(?=[\s>])(?![^>]*data-cfasync)/gi;

function processFile(filePath) {
    const html = fs.readFileSync(filePath, 'utf8');
    let added = 0;
    const updated = html.replace(SCRIPT_OPEN_RE, () => {
        added += 1;
        return '<script data-cfasync="false"';
    });

    if (added > 0) {
        fs.writeFileSync(filePath, updated, 'utf8');
        return { file: path.basename(filePath), status: `updated (+${added})` };
    }
    return { file: path.basename(filePath), status: 'unchanged' };
}

// Recursively collect every .html under frontend/ (pages + subdir dashboards).
function collectHtml(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectHtml(full);
        return entry.isFile() && entry.name.endsWith('.html') ? [full] : [];
    });
}

const files = collectHtml(FRONTEND_DIR);
const results = files.map((f) => processFile(f));

let totalAdded = 0;
results.forEach((r) => {
    const m = r.status.match(/\+(\d+)/);
    if (m) totalAdded += Number(m[1]);
    console.log(`  ${r.status.padEnd(14)} ${r.file}`);
});

console.log(`\nTotal data-cfasync="false" attributes added: ${totalAdded}`);
