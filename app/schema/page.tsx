import fs from 'node:fs/promises'
import path from 'node:path'

export default async function SchemaPage() {
  const htmlPath = path.join(process.cwd(), '..', 'clawd', 'plans', 'oracle-boxing-app-workout-table-visual.html')
  const rawHtml = await fs.readFile(htmlPath, 'utf8')

  return (
    <div className="min-h-screen bg-white">
      <iframe
        title="Oracle Boxing workout table structure"
        srcDoc={rawHtml}
        className="h-[calc(100vh-80px)] w-full border-0"
        sandbox="allow-same-origin"
      />
    </div>
  )
}
