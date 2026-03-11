import { readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { PDFParse } from 'pdf-parse'

const url = 'https://cloud-api.yandex.net/v1/disk/public/resources/download'
const params = new URLSearchParams({
  public_key: 'https://disk.yandex.ru/d/VTw8mbVspwiFPw',
  path: '/3. 400-772_Сверхлегкая ракета_ООО 3Д Исследования и Разработки/DD/Отчёт DD СВРЛ.pdf'
})
const r = await fetch(url + '?' + params)
const data = await r.json()

const dest = join(tmpdir(), 'test_dd.pdf')
const r2 = await fetch(data.href)
await pipeline(r2.body, createWriteStream(dest))
console.log('Downloaded to:', dest)

const parser = new PDFParse({ url: `file://${dest}` })
const result = await parser.getText({ maxPageCount: 3 })
console.log('Result type:', typeof result)
console.log('Keys:', result ? Object.keys(result) : 'null')
const text = result?.text || ''
console.log('Text length:', text.length)
console.log('First 500:', text.slice(0, 500))
