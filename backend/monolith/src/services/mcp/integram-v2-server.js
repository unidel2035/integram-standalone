#!/usr/bin/env node
/**
 * Integram V2 MCP Server for VentureOS (Fund project)
 *
 * CRUD tools for Integram DB: create/update/read companies (1155), metrics (126255), etc.
 * Uses V1 REST API under the hood (V2 endpoints delegate to V1 for CRUD).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_USER = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASS = process.env.INTEGRAM_SYSTEM_PASSWORD

let _tokens = {} // db → { token, xsrf }

// ── Auth ────────────────────────────────────────────────────────────

async function auth(db) {
  if (_tokens[db]) return _tokens[db]
  const res = await fetch(`${INTEGRAM_SERVER}/${db}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_USER, pwd: INTEGRAM_PASS })
  })
  const data = await res.json()
  if (data.failed || !data.token) throw new Error('Auth failed for db: ' + db)
  const xRes = await fetch(`${INTEGRAM_SERVER}/${db}/xsrf?JSON_KV`, {
    headers: { 'X-Authorization': data.token }
  })
  const xd = xRes.ok ? await xRes.json() : {}
  _tokens[db] = { token: data.token, xsrf: xd._xsrf || '' }
  return _tokens[db]
}

async function post(db, endpoint, params) {
  const { token, xsrf } = await auth(db)
  params.set('_xsrf', xsrf)
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${INTEGRAM_SERVER}/${db}/${endpoint}${sep}JSON_KV`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Authorization': token,
      Cookie: `${db}=${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  return r.json()
}

async function get(db, endpoint) {
  const { token } = await auth(db)
  // endpoint may contain &params — JSON_KV must come right after ?
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${INTEGRAM_SERVER}/${db}/${endpoint}${sep}JSON_KV`
  const r = await fetch(url, {
    headers: { 'X-Authorization': token }
  })
  return r.json()
}

// ── Tools ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'integram_v2_list_objects',
    description: 'Получить список объектов из таблицы с их полями. Для subordinate-записей укажи parentId.',
    inputSchema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        parentId: { type: 'number', description: 'ID родительского объекта (для subordinate таблиц)' },
        limit: { type: 'number', default: 50 },
        database: { type: 'string', default: 'fst' }
      },
      required: ['typeId']
    }
  },
  {
    name: 'integram_v2_get_object',
    description: 'Получить один объект со всеми полями (включая reference-значения). Если знаешь typeId — укажи для точного результата.',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        typeId: { type: 'number', description: 'ID таблицы (типа) объекта — ускоряет запрос' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['objectId']
    }
  },
  {
    name: 'integram_v2_create_object',
    description: 'Создать объект в таблице. Для subordinate-записей укажи parentId. Для reference-полей значение = ID объекта из справочника.',
    inputSchema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        name: { type: 'string', description: 'Название (основное поле)' },
        parentId: { type: 'number', description: 'ID родителя (для subordinate). Для top-level = 1' },
        fields: {
          type: 'object',
          description: 'Поля: { "reqId": "value" }. Для reference-полей value = ID из справочника.'
        },
        database: { type: 'string', default: 'fst' }
      },
      required: ['typeId', 'name']
    }
  },
  {
    name: 'integram_v2_update_object',
    description: 'Обновить поля объекта. Для reference-полей используй integram_v2_set_reference.',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        fields: { type: 'object', description: 'Поля для обновления: { "reqId": "value" }' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['objectId', 'fields']
    }
  },
  {
    name: 'integram_v2_set_reference',
    description: 'Установить reference-поле (ссылку) для объекта. Используй _m_save для надёжной установки ref-значений.',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        reqId: { type: 'string', description: 'ID реквизита (поля-ссылки)' },
        refObjectId: { type: 'string', description: 'ID объекта из справочника' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['objectId', 'reqId', 'refObjectId']
    }
  },
  {
    name: 'integram_v2_upload_file',
    description: 'Загрузить файл в FILE-поле объекта. Файл передаётся как base64. Сначала создай объект (create_object), потом загрузи файл.',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта куда загружать файл' },
        reqId: { type: 'string', description: 'ID FILE-реквизита (поля)' },
        base64Data: { type: 'string', description: 'Содержимое файла в base64' },
        filename: { type: 'string', description: 'Имя файла с расширением' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['objectId', 'reqId', 'base64Data', 'filename']
    }
  },
  {
    name: 'integram_v2_delete_object',
    description: 'Удалить объект по ID',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['objectId']
    }
  },
  {
    name: 'integram_v2_get_table_structure',
    description: 'Получить структуру таблицы: список полей, типы, алиасы, reference-связи',
    inputSchema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        database: { type: 'string', default: 'fst' }
      },
      required: ['typeId']
    }
  },
  {
    name: 'integram_v2_search',
    description: 'Поиск объектов по имени в таблице',
    inputSchema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        query: { type: 'string', description: 'Строка поиска' },
        limit: { type: 'number', default: 20 },
        database: { type: 'string', default: 'fst' }
      },
      required: ['typeId', 'query']
    }
  },
]

// ── Execute ──────────────────────────────────────────────────────────

async function executeTool(name, args) {
  const db = args.database || 'fst'

  try {
    let result

    switch (name) {
      case 'integram_v2_list_objects': {
        const ep = args.parentId
          ? `object/${args.typeId}?JSON_KV&F_U=${args.parentId}&l=${args.limit || 50}`
          : `object/${args.typeId}?JSON_KV&l=${args.limit || 50}&F_U=1`
        const data = await get(db, ep)
        const objs = (data.object || []).map(o => ({
          id: o.id, name: o.val,
          ...(data.reqs?.[o.id] || {})
        }))
        result = { total: data.cnt || objs.length, objects: objs }
        break
      }

      case 'integram_v2_get_object': {
        // Use object/{typeId}?JSON_KV&F_I={objectId} if typeId known,
        // otherwise try object/{objectId} and parse the response
        let data
        if (args.typeId) {
          data = await get(db, `object/${args.typeId}?JSON_KV&F_I=${args.objectId}`)
        } else {
          // Try using objectId as type (works for subordinate views)
          data = await get(db, `object/${args.objectId}?JSON_KV`)
        }
        const objs = data.object || []
        const obj = objs.find(o => String(o.id) === String(args.objectId)) || objs[0] || {}
        const reqs = data.reqs?.[String(args.objectId)] || data.reqs?.[obj.id] || {}
        result = {
          id: obj.id || args.objectId,
          name: obj.val,
          typeId: args.typeId || obj.base,
          parent: obj.up,
          reqs
        }
        break
      }

      case 'integram_v2_create_object': {
        const params = new URLSearchParams()
        params.set(`t${args.typeId}`, args.name)
        params.set('up', String(args.parentId || 1))
        // Set fields
        for (const [reqId, val] of Object.entries(args.fields || {})) {
          params.set(`t${reqId}`, String(val))
        }
        const data = await post(db, `_m_new/${args.typeId}`, params)
        const newId = data.id || data.obj
        result = { id: newId, name: args.name }
        break
      }

      case 'integram_v2_update_object': {
        // Use _m_save for each field
        for (const [reqId, val] of Object.entries(args.fields || {})) {
          const params = new URLSearchParams()
          params.set(`t${reqId}`, String(val))
          await post(db, `_m_save/${args.objectId}`, params)
        }
        result = { id: args.objectId, updated: Object.keys(args.fields || {}).length }
        break
      }

      case 'integram_v2_set_reference': {
        const params = new URLSearchParams()
        params.set(`t${args.reqId}`, String(args.refObjectId))
        await post(db, `_m_save/${args.objectId}`, params)
        result = { id: args.objectId, reqId: args.reqId, refObjectId: args.refObjectId }
        break
      }

      case 'integram_v2_upload_file': {
        // Upload file via multipart _m_save (Integram pattern for FILE requisites)
        const { token, xsrf } = await auth(db)
        const boundary = '----MCPBoundary' + Date.now()
        const fileBuffer = Buffer.from(args.base64Data, 'base64')

        // Build multipart body manually
        const parts = []
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="_xsrf"\r\n\r\n${xsrf}`)
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="t${args.reqId}"; filename="${args.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`)

        const header = Buffer.from(parts.join('\r\n') + '\r\n')
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
        const body = Buffer.concat([header, fileBuffer, footer])

        const uploadRes = await fetch(`${INTEGRAM_SERVER}/${db}/_m_save/${args.objectId}?JSON_KV`, {
          method: 'POST',
          headers: {
            'X-Authorization': token,
            Cookie: `${db}=${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        })
        const uploadData = await uploadRes.json().catch(() => ({}))
        result = { objectId: args.objectId, uploaded: uploadRes.ok, response: uploadData }
        break
      }

      case 'integram_v2_delete_object': {
        await post(db, `_m_del/${args.objectId}`, new URLSearchParams())
        result = { deleted: args.objectId }
        break
      }

      case 'integram_v2_get_table_structure': {
        const data = await get(db, `object/${args.typeId}?JSON_KV&l=0`)
        const fields = []
        const reqType = data.req_type || {}
        const reqBase = data.req_base || {}
        const reqAttrs = data.req_attrs || {}
        const refType = data.ref_type || {}
        for (const reqId of (data.req_order || Object.keys(reqType))) {
          const aliasMatch = (reqAttrs[reqId] || '').match(/:ALIAS=([^:]+):/)
          fields.push({
            id: reqId,
            name: reqType[reqId] || reqId,
            alias: aliasMatch ? aliasMatch[1] : reqType[reqId],
            type: reqBase[reqId] || 'SHORT',
            refType: refType[reqId] || null,
          })
        }
        result = { typeId: args.typeId, fields }
        break
      }

      case 'integram_v2_search': {
        const data = await get(db, `object/${args.typeId}?JSON_KV&l=${args.limit || 20}&F_U=1&F_${args.typeId}=${encodeURIComponent(args.query)}`)
        const objs = (data.object || []).map(o => ({
          id: o.id, name: o.val,
          ...(data.reqs?.[o.id] || {})
        }))
        result = { total: data.cnt || objs.length, objects: objs }
        break
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
  }
}

// ── Server ──────────────────────────────────────────────────────────

const server = new Server(
  { name: 'integram-v2', version: '2.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return executeTool(req.params.name, req.params.arguments || {})
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[integram-v2] MCP server started (fund)')
