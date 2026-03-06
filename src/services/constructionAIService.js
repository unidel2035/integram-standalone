/**
 * Construction AI Service
 * AI-промпты для распознавания узлов металлоконструкций из VSL JSON
 * + детерминистический локальный анализ как основной/fallback метод
 */

const _orchUrl = (import.meta.env.VITE_ORCHESTRATOR_URL || '').trim()
const API_BASE_URL = (_orchUrl && _orchUrl !== 'auto' ? _orchUrl : '') + '/api'

/**
 * Deterministic local analysis of VSL document — no AI needed
 * Identifies connection nodes from bolt hole groups and text annotations
 * @param {Object} vslDocument - VSL document from DXF conversion
 * @returns {Object} { nodes, summary }
 */
export function analyzeVslLocal(vslDocument) {
  const objects = vslDocument?.objects || []
  if (objects.length === 0) {
    return { nodes: [], summary: { totalNodes: 0, totalBolts: 0, profilesFound: [], notes: 'Пустой документ' } }
  }

  // 1. Collect bolt holes
  const boltHoleObjects = objects.filter(o => o.type === 'circle' && o.semantic?.type === 'bolt_hole')

  // 2. Group nearby bolt holes by size
  const boltGroups = _groupBoltHoles(boltHoleObjects)

  // 3. Collect text annotations
  const texts = objects.filter(o => o.type === 'text' && o.text)

  // 4. Collect lines/polylines on PLATES layer (potential flanges/splice plates)
  const plateElements = objects.filter(o =>
    (o.type === 'line' || o.type === 'polyline') && o.layer?.toUpperCase() === 'PLATES'
  )

  // 5. Extract profile names from text annotations
  // Matches: "30Б1", "30B1" (Latin/Cyrillic), "IPE300", "L100x8", "20Ш", "25К1"
  const profilePattern = /(\d+[БBШШКKСC]\d*|IPE?\s*\d+|HE[AB]?\s*\d+|[LЛСCШШУП]\d+[x×]\d+)/gi
  const nodeIdPattern = /[\(\s][УU](\d+)[\)\s,]/i
  const standaloneProfilePattern = /^(\d{2,3}[БBШШКKСC]\d{0,2})$/i
  const allProfiles = new Set()
  const profileTexts = []
  const nodeLabels = []

  for (const t of texts) {
    // Check for standalone profile name (e.g. a text entity that just says "30B1")
    const standaloneMatch = t.text.trim().match(standaloneProfilePattern)
    if (standaloneMatch) {
      allProfiles.add(standaloneMatch[1])
      profileTexts.push({ text: standaloneMatch[1], x: t.position?.x || 0, y: t.position?.y || 0 })
      continue
    }
    const profileMatches = t.text.match(profilePattern)
    if (profileMatches) {
      for (const m of profileMatches) {
        allProfiles.add(m)
        profileTexts.push({ text: m, x: t.position?.x || 0, y: t.position?.y || 0 })
      }
    }
    // Match node ID patterns like "(U1)" or "У2"
    const nodeMatch = t.text.match(nodeIdPattern) || t.text.match(/[УU](\d+)/i)
    if (nodeMatch) {
      nodeLabels.push({ id: `У${nodeMatch[1]}`, x: t.position?.x || 0, y: t.position?.y || 0, fullText: t.text })
    }
  }

  // 6. Detect flange annotations
  const flangePattern = /flange|фланц|t\s*=\s*(\d+)\s*mm/i
  const flangeTexts = texts.filter(t => flangePattern.test(t.text))
  let flangeThickness = 20 // default
  for (const ft of flangeTexts) {
    const m = ft.text.match(/t\s*=\s*(\d+)/i)
    if (m) flangeThickness = parseInt(m[1], 10)
  }

  // 7. Detect bolt count/size from annotations (e.g. "M20 bolts (8 pcs)")
  const boltAnnotPattern = /M(\d+)\s*(?:bolt|болт)[^(]*\((\d+)\s*(?:pcs|шт)/i
  const boltAnnotations = []
  for (const t of texts) {
    const m = t.text.match(boltAnnotPattern)
    if (m) {
      boltAnnotations.push({ diameter: `M${m[1]}`, count: parseInt(m[2], 10), x: t.position?.x || 0, y: t.position?.y || 0 })
    }
  }

  // 8. Build nodes from bolt groups
  const nodes = []
  let nodeCounter = 1

  for (const group of boltGroups) {
    // Determine node type from context
    let nodeType = 'shear'
    let nodeCategory = 'butt_joint'

    // Check if there's a flange nearby (plate elements near the bolt group)
    const hasPlateNearby = plateElements.length > 0
    const hasFlangeText = flangeTexts.some(ft => {
      const dx = (ft.position?.x || 0) - group.centerX
      const dy = (ft.position?.y || 0) - group.centerY
      return Math.sqrt(dx * dx + dy * dy) < 500
    })

    if (hasFlangeText) {
      nodeCategory = 'flange'
      nodeType = 'friction'
    } else if (hasPlateNearby) {
      nodeCategory = 'splice_plate'
      nodeType = 'shear'
    }

    // Find nearby profile annotations
    const nearbyProfiles = profileTexts.filter(pt => {
      const dx = pt.x - group.centerX
      const dy = pt.y - group.centerY
      return Math.sqrt(dx * dx + dy * dy) < 500
    }).map(pt => pt.text)
    const uniqueProfiles = [...new Set(nearbyProfiles)]

    // Find matching node label
    const nearLabel = nodeLabels.find(nl => {
      const dx = nl.x - group.centerX
      const dy = nl.y - group.centerY
      return Math.sqrt(dx * dx + dy * dy) < 600
    })

    const nodeId = nearLabel?.id || `У${nodeCounter}`

    // Package thickness estimate: 2×flange for flange, 30mm default otherwise
    const packageThickness = nodeCategory === 'flange'
      ? flangeThickness * 2
      : (uniqueProfiles.length > 0 ? 30 : 24)

    const nodeTypeLabels = {
      flange: 'Фланцевый узел',
      splice_plate: 'Узел на накладках',
      gusset: 'Узел на фасонке',
      butt_joint: 'Монтажный стык',
      base_plate: 'Опорная плита'
    }

    const profileDesc = uniqueProfiles.length > 0
      ? uniqueProfiles.join(' + ')
      : 'не определён'

    nodes.push({
      id: nodeId,
      name: `${nodeTypeLabels[nodeCategory]} ${profileDesc}`,
      type: nodeCategory,
      profiles: uniqueProfiles.length > 0 ? uniqueProfiles : [],
      bolts: {
        count: group.count,
        diameter: group.boltSize,
        holeD: group.holeDiameter
      },
      packageThickness,
      connectionType: nodeType,
      position: { x: Math.round(group.centerX), y: Math.round(group.centerY) },
      description: `${group.count} болт${group.count > 4 ? 'ов' : 'а'} ${group.boltSize}, d отв. ${group.holeDiameter} мм, пакет ${packageThickness} мм`
    })

    nodeCounter++
  }

  // If no bolt groups found but we have bolt annotations from text, use them
  if (nodes.length === 0 && boltAnnotations.length > 0) {
    for (const ba of boltAnnotations) {
      const uniqueProfiles = [...allProfiles]
      nodes.push({
        id: `У${nodeCounter}`,
        name: `Узел ${uniqueProfiles.join(' + ') || 'по аннотации'}`,
        type: flangeTexts.length > 0 ? 'flange' : 'butt_joint',
        profiles: uniqueProfiles,
        bolts: { count: ba.count, diameter: ba.diameter, holeD: parseInt(ba.diameter.replace('M', ''), 10) + 2 },
        packageThickness: flangeTexts.length > 0 ? flangeThickness * 2 : 30,
        connectionType: flangeTexts.length > 0 ? 'friction' : 'shear',
        position: { x: Math.round(ba.x), y: Math.round(ba.y) },
        description: `${ba.count} болтов ${ba.diameter} (по аннотации чертежа)`
      })
      nodeCounter++
    }
  }

  const totalBolts = nodes.reduce((s, n) => s + (n.bolts?.count || 0), 0)

  return {
    nodes,
    summary: {
      totalNodes: nodes.length,
      totalBolts,
      profilesFound: [...allProfiles],
      notes: nodes.length > 0
        ? `Распознано ${nodes.length} узл${nodes.length === 1 ? '' : 'ов'} детерминистическим методом`
        : 'Узлы не обнаружены. Загрузите чертёж с болтовыми отверстиями.'
    }
  }
}

function _groupBoltHoles(boltHoleObjects, maxDistance = 300) {
  const groups = []
  const used = new Set()
  for (let i = 0; i < boltHoleObjects.length; i++) {
    if (used.has(i)) continue
    const group = [boltHoleObjects[i]]
    used.add(i)
    for (let j = i + 1; j < boltHoleObjects.length; j++) {
      if (used.has(j)) continue
      if (boltHoleObjects[j].semantic.boltSize !== boltHoleObjects[i].semantic.boltSize) continue
      const dx = boltHoleObjects[j].position.x - boltHoleObjects[i].position.x
      const dy = boltHoleObjects[j].position.y - boltHoleObjects[i].position.y
      if (Math.sqrt(dx * dx + dy * dy) < maxDistance) {
        group.push(boltHoleObjects[j])
        used.add(j)
      }
    }
    if (group.length >= 2) {
      groups.push({
        boltSize: group[0].semantic.boltSize,
        holeDiameter: group[0].semantic.holeDiameter,
        count: group.length,
        centerX: group.reduce((s, h) => s + h.position.x, 0) / group.length,
        centerY: group.reduce((s, h) => s + h.position.y, 0) / group.length
      })
    }
  }
  return groups
}

export class ConstructionAIService {
  constructor() {
    this.defaultModel = null
    this.accessToken = null
  }

  async init(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-tokens/default-token/${userId}`)
      if (!response.ok) throw new Error('Failed to get AI access token')
      const result = await response.json()
      this.accessToken = result.data.token
      this.defaultModel = result.data.defaultModel
    } catch (e) {
      console.warn('AI token init failed, will use local analysis:', e.message)
      this.accessToken = null
      this.defaultModel = null
    }
    return this
  }

  /**
   * Analyze VSL JSON to find connection nodes in steel structure drawings.
   * Uses deterministic local analysis as primary method.
   * Falls back to AI analysis if explicitly requested and token is available.
   * @param {Object} vslDocument - VSL document from DXF conversion
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Recognized nodes with bolt specs
   */
  async analyzeNodes(vslDocument, options = {}) {
    // Always start with deterministic local analysis (reliable, fast)
    const localResult = analyzeVslLocal(vslDocument)

    // If AI is available and user wants enrichment, try AI
    if (this.accessToken && options.useAI) {
      try {
        const aiResult = await this._analyzeWithAI(vslDocument, options)
        return aiResult
      } catch (e) {
        console.warn('AI analysis failed, using local result:', e.message)
      }
    }

    return localResult
  }

  async _analyzeWithAI(vslDocument, options = {}) {
    const { temperature = 0.1 } = options

    const systemPrompt = `Ты — инженер-конструктор КМД (конструкции металлические деталировочные).
Получаешь VSL JSON из чертежа металлоконструкций.

Задача: Найди ВСЕ узлы соединений и для каждого определи:
1. Тип узла (flange — фланцевый, splice_plate — на накладках, gusset — на фасонке, butt_joint — монтажный стык, base_plate — опорная плита)
2. Соединяемые профили (двутавр 30Б1 + двутавр 30Б1, и т.п.)
3. Количество болтов (по количеству отверстий — элементов type="circle" с semantic.type="bolt_hole")
4. Диаметр болтов (по диаметру отверстий: d_отв = d_болт + 2мм для обычных, +3мм для увеличенных)
5. Толщина пакета (сумма толщин соединяемых элементов в мм)
6. Тип соединения (shear — срезное, friction — фрикционное, tension — на растяжение)

Верни ТОЛЬКО валидный JSON (без markdown, без комментариев):
{
  "nodes": [
    {
      "id": "У1",
      "name": "Описание узла на русском",
      "type": "flange|splice_plate|gusset|butt_joint|base_plate",
      "profiles": ["30Б1", "30Б1"],
      "bolts": { "count": 8, "diameter": "M20", "holeD": 22 },
      "packageThickness": 34,
      "connectionType": "friction|shear|tension",
      "position": { "x": 0, "y": 0 },
      "description": "Подробное описание узла"
    }
  ],
  "summary": {
    "totalNodes": 1,
    "totalBolts": 8,
    "profilesFound": ["30Б1"],
    "notes": "Примечания по чертежу"
  }
}`

    const vslSummary = this._prepareVslSummary(vslDocument)

    const userPrompt = `Анализируй VSL JSON чертежа металлоконструкций.

Статистика чертежа:
- Всего объектов: ${vslDocument.objects?.length || 0}
- Окружности (потенциальные отверстия): ${vslSummary.circleCount}
- Болтовые отверстия (по диаметру): ${JSON.stringify(vslSummary.boltHoles)}
- Группы болтовых отверстий: ${JSON.stringify(vslSummary.boltGroups)}
- Текстовые аннотации: ${JSON.stringify(vslSummary.texts)}
- Размеры: ${JSON.stringify(vslSummary.dimensions)}
- Слои: ${JSON.stringify(vslDocument.metadata?.layers || [])}

Полный VSL JSON:
${JSON.stringify(vslDocument.objects?.slice(0, 500), null, 1)}

Найди и опиши все узлы соединений. Верни JSON.`

    const result = await this._callAI(systemPrompt, userPrompt, { temperature })
    return typeof result === 'string' ? JSON.parse(result) : result
  }

  /**
   * Generate a detailed description of a specific node for documentation
   * @param {Object} node - Node data from analyzeNodes
   * @returns {Promise<string>} Russian-language description for documentation
   */
  async describeNodeForDoc(node) {
    const systemPrompt = `Ты — инженер-конструктор. Напиши краткое техническое описание узла соединения металлоконструкций для акта исполнительной документации. Используй профессиональную терминологию. Ответ на русском языке, 2-4 предложения.`

    const userPrompt = `Узел: ${node.name}
Тип: ${node.type}
Профили: ${(node.profiles || []).join(' + ')}
Болты: ${node.bolts?.count} шт. ${node.bolts?.diameter}
Тип соединения: ${node.connectionType}
Толщина пакета: ${node.packageThickness} мм`

    return await this._callAI(systemPrompt, userPrompt, { temperature: 0.3 })
  }

  _prepareVslSummary(vslDocument) {
    const objects = vslDocument.objects || []

    const circles = objects.filter(o => o.type === 'circle')
    const boltHoles = {}
    const boltHoleObjects = []

    for (const c of circles) {
      if (c.semantic?.type === 'bolt_hole') {
        const size = c.semantic.boltSize
        boltHoles[size] = (boltHoles[size] || 0) + 1
        boltHoleObjects.push(c)
      }
    }

    const boltGroups = _groupBoltHoles(boltHoleObjects)

    const texts = objects
      .filter(o => o.type === 'text' && o.text)
      .slice(0, 50)
      .map(o => ({ text: o.text, x: Math.round(o.position?.x || 0), y: Math.round(o.position?.y || 0) }))

    const dimensions = objects
      .filter(o => o.type === 'dimension' && o.text)
      .slice(0, 30)
      .map(o => o.text)

    return {
      circleCount: circles.length,
      boltHoles,
      boltGroups,
      texts,
      dimensions
    }
  }

  async _callAI(systemPrompt, userPrompt, options = {}) {
    const { temperature = 0.2 } = options

    if (!this.accessToken) throw new Error('AI service not initialized. Call init() first.')

    const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken.id}`
      },
      body: JSON.stringify({
        modelId: this.defaultModel,
        prompt: userPrompt,
        systemPrompt,
        temperature,
        application: 'ConstructionDocAgent'
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'AI call failed' }))
      throw new Error(err.error || 'AI call failed')
    }

    const result = await response.json()
    let content = result.data?.content || result.content || result.data?.choices?.[0]?.message?.content || ''

    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    return content
  }
}
