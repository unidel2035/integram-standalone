/**
 * Integram V2 Tools — reusable tool definitions & execution for chat tool-calling.
 * Extracted from MCP server so /api/chat can use the same logic.
 */

// Lazy access — env vars may be set after module load via dotenv
const getConfig = () => ({
  server: process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru',
  user: process.env.INTEGRAM_SYSTEM_USERNAME,
  pass: process.env.INTEGRAM_SYSTEM_PASSWORD,
})

let _tokens = {} // db → { token, xsrf }

// ── Auth ────────────────────────────────────────────────────────────

async function auth(db) {
  if (_tokens[db]) return _tokens[db]
  const { server, user, pass } = getConfig()
  const res = await fetch(`${server}/${db}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: user, pwd: pass })
  })
  const data = await res.json()
  if (data.failed || !data.token) throw new Error('Auth failed for db: ' + db)
  const xRes = await fetch(`${server}/${db}/xsrf?JSON_KV`, {
    headers: { 'X-Authorization': data.token }
  })
  const xd = xRes.ok ? await xRes.json() : {}
  _tokens[db] = { token: data.token, xsrf: xd._xsrf || '' }
  return _tokens[db]
}

async function postReq(db, endpoint, params) {
  const { token, xsrf } = await auth(db)
  const { server } = getConfig()
  params.set('_xsrf', xsrf)
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${server}/${db}/${endpoint}${sep}JSON_KV`
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

async function getReq(db, endpoint) {
  const { token } = await auth(db)
  const { server } = getConfig()
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${server}/${db}/${endpoint}${sep}JSON_KV`
  const r = await fetch(url, {
    headers: { 'X-Authorization': token }
  })
  return r.json()
}

// ── Tool definitions (Anthropic format) ─────────────────────────────

export const INTEGRAM_TOOLS = [
  {
    name: 'integram_v2_list_objects',
    description: 'Получить список объектов из таблицы Integram с их полями. Для subordinate-записей укажи parentId. Ключевые таблицы БД fst: 1155 — Проектные компании, 126255 — Метрики компаний (subordinate к 1155), 53253 — События проекта (subordinate к 1155).',
    input_schema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        parentId: { type: 'number', description: 'ID родительского объекта (для subordinate таблиц)' },
        limit: { type: 'number', description: 'Максимум записей (по умолч. 50)' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['typeId']
    }
  },
  {
    name: 'integram_v2_get_object',
    description: 'Получить один объект со всеми полями. Укажи typeId для точного результата.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        typeId: { type: 'number', description: 'ID таблицы (типа) объекта' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['objectId']
    }
  },
  {
    name: 'integram_v2_create_object',
    description: 'Создать объект в таблице. Для subordinate-записей укажи parentId.',
    input_schema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        name: { type: 'string', description: 'Название (основное поле)' },
        parentId: { type: 'number', description: 'ID родителя (для subordinate). Для top-level = 1' },
        fields: { type: 'object', description: 'Поля: { "reqId": "value" }' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['typeId', 'name']
    }
  },
  {
    name: 'integram_v2_update_object',
    description: 'Обновить поля объекта.',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'number', description: 'ID объекта' },
        fields: { type: 'object', description: 'Поля для обновления: { "reqId": "value" }' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['objectId', 'fields']
    }
  },
  {
    name: 'integram_v2_search',
    description: 'Поиск объектов по имени в таблице Integram.',
    input_schema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        query: { type: 'string', description: 'Строка поиска' },
        limit: { type: 'number', description: 'Максимум результатов (по умолч. 20)' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['typeId', 'query']
    }
  },
  {
    name: 'integram_v2_get_table_structure',
    description: 'Получить структуру таблицы: список полей, типы, алиасы, reference-связи.',
    input_schema: {
      type: 'object',
      properties: {
        typeId: { type: 'number', description: 'ID таблицы' },
        database: { type: 'string', description: 'Имя БД (по умолч. fst)' }
      },
      required: ['typeId']
    }
  },
]

// ── Execute ──────────────────────────────────────────────────────────

export async function executeTool(name, args) {
  const db = args.database || 'fst'

  switch (name) {
    case 'integram_v2_list_objects': {
      const ep = args.parentId
        ? `object/${args.typeId}?JSON_KV&F_U=${args.parentId}&l=${args.limit || 50}`
        : `object/${args.typeId}?JSON_KV&l=${args.limit || 50}&F_U=1`
      const data = await getReq(db, ep)
      const objs = (data.object || []).map(o => ({
        id: o.id, name: o.val,
        ...(data.reqs?.[o.id] || {})
      }))
      return { total: data.cnt || objs.length, objects: objs }
    }

    case 'integram_v2_get_object': {
      let data
      if (args.typeId) {
        data = await getReq(db, `object/${args.typeId}?JSON_KV&F_I=${args.objectId}`)
      } else {
        data = await getReq(db, `object/${args.objectId}?JSON_KV`)
      }
      const objs = data.object || []
      const obj = objs.find(o => String(o.id) === String(args.objectId)) || objs[0] || {}
      const reqs = data.reqs?.[String(args.objectId)] || data.reqs?.[obj.id] || {}
      return {
        id: obj.id || args.objectId,
        name: obj.val,
        typeId: args.typeId || obj.base,
        parent: obj.up,
        reqs
      }
    }

    case 'integram_v2_create_object': {
      const params = new URLSearchParams()
      params.set(`t${args.typeId}`, args.name)
      params.set('up', String(args.parentId || 1))
      for (const [reqId, val] of Object.entries(args.fields || {})) {
        params.set(`t${reqId}`, String(val))
      }
      const data = await postReq(db, `_m_new/${args.typeId}`, params)
      const newId = data.id || data.obj
      return { id: newId, name: args.name }
    }

    case 'integram_v2_update_object': {
      for (const [reqId, val] of Object.entries(args.fields || {})) {
        const params = new URLSearchParams()
        params.set(`t${reqId}`, String(val))
        await postReq(db, `_m_save/${args.objectId}`, params)
      }
      return { id: args.objectId, updated: Object.keys(args.fields || {}).length }
    }

    case 'integram_v2_search': {
      const data = await getReq(db, `object/${args.typeId}?JSON_KV&l=${args.limit || 20}&F_U=1&F_${args.typeId}=${encodeURIComponent(args.query)}`)
      const objs = (data.object || []).map(o => ({
        id: o.id, name: o.val,
        ...(data.reqs?.[o.id] || {})
      }))
      return { total: data.cnt || objs.length, objects: objs }
    }

    case 'integram_v2_get_table_structure': {
      const data = await getReq(db, `object/${args.typeId}?JSON_KV&l=0`)
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
      return { typeId: args.typeId, fields }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
