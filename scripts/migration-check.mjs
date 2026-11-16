import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const mustInclude = (file, fragments) => {
  const source = read(file)
  for (const fragment of fragments) {
    if (!source.includes(fragment)) throw new Error(`${file} missing: ${fragment}`)
  }
}
const hash = (file) => crypto.createHash('sha256').update(read(file)).digest('hex')

const referenceFiles = ['index.html', 'app.js', 'style.css', 'rentals.html', 'sales.html', 'customers.html', 'office.html', '브리핑.html']
for (const file of referenceFiles) {
  if (!fs.existsSync(path.join(root, 'docs/reference-html', file))) throw new Error(`reference missing: ${file}`)
}
for (const file of ['index.html', 'app.js', 'style.css']) {
  const original = path.join(root, file)
  if (fs.existsSync(original) && hash(`docs/reference-html/${file}`) !== hash(file)) {
    throw new Error(`reference copy changed: ${file}`)
  }
}

mustInclude('next-app/app/components/ManagementShell.tsx', [
  'export function Sidebar()',
  'export function TopBar',
  'href="/rentals"',
  'href="/sales"',
  'href="/customers"',
  'className="rental-table"',
  'className="property-detail-modal"',
  'briefing-button',
])
mustInclude('next-app/app/customers/page.tsx', ['import { Sidebar, TopBar }', '<TopBar/>'])
mustInclude('next-app/app/globals.css', ['.sidebar', '.topbar', '.rental-filter-panel', '.rental-table', '.property-detail-modal', '@media(max-width:700px)'])
for (const route of ['page.tsx', 'rentals/page.tsx', 'sales/page.tsx', 'customers/page.tsx', 'briefing/[id]/page.tsx']) {
  if (!fs.existsSync(path.join(root, 'next-app/app', route))) throw new Error(`route missing: ${route}`)
}

console.log(`migration-check: PASS (${referenceFiles.length} reference files, route/style markers verified)`)
