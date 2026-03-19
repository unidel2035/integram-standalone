/**
 * OntologyAlignmentService — Сопоставление с внешними онтологиями
 *
 * Парсинг OWL/Turtle, сопоставление меток (Levenshtein + нормализация),
 * создание exactMatch/closeMatch связей
 */

import N3 from 'n3'
import { getOntologyService } from './IntegramOntologyService.js'
import { getRdfGraphService, PREFIXES } from './RdfGraphService.js'
import logger from '../../utils/logger.js'

class OntologyAlignmentService {
  constructor() {
    this.lastParsed = null
  }

  /**
   * Парсинг внешнего файла (Turtle/N-Triples)
   */
  async parseExternal(content, format = 'turtle') {
    const parser = new N3.Parser({ format: format === 'ntriples' ? 'N-Triples' : 'Turtle' })

    return new Promise((resolve, reject) => {
      const concepts = []
      const quads = []

      parser.parse(content, (error, quad) => {
        if (error) return reject(error)
        if (!quad) {
          // Извлечь концепты из трипл
          const conceptMap = new Map()
          for (const q of quads) {
            const subj = q.subject.value
            if (!conceptMap.has(subj)) {
              conceptMap.set(subj, { uri: subj, labels: [], types: [] })
            }
            const entry = conceptMap.get(subj)

            if (q.predicate.value === `${PREFIXES.rdf}type`) {
              entry.types.push(q.object.value)
            }
            if (q.predicate.value === `${PREFIXES.rdfs}label` ||
                q.predicate.value === `${PREFIXES.skos}prefLabel`) {
              entry.labels.push({
                value: q.object.value,
                language: q.object.language || null,
              })
            }
          }

          for (const [uri, data] of conceptMap) {
            if (data.labels.length > 0) {
              concepts.push({
                uri,
                labels: data.labels,
                primaryLabel: data.labels[0]?.value || uri,
                types: data.types,
              })
            }
          }

          this.lastParsed = concepts
          resolve({
            conceptCount: concepts.length,
            tripleCount: quads.length,
            concepts,
          })
          return
        }
        quads.push(quad)
      })
    })
  }

  /**
   * Сопоставление внешних концептов с нашей онтологией
   */
  async match(externalConcepts) {
    const svc = getOntologyService()
    await svc.initialize()
    const ourConcepts = await svc.getConcepts({ limit: 10000 })

    const mappings = []

    for (const ext of externalConcepts) {
      const extLabel = (ext.primaryLabel || ext.labels?.[0]?.value || '').toLowerCase().trim()
      if (!extLabel) continue

      let bestMatch = null
      let bestScore = 0

      for (const our of ourConcepts) {
        const ourLabel = (our.val || '').toLowerCase().trim()
        if (!ourLabel) continue

        // Точное совпадение
        if (ourLabel === extLabel) {
          bestMatch = our
          bestScore = 1.0
          break
        }

        // Один содержит другой
        if (ourLabel.includes(extLabel) || extLabel.includes(ourLabel)) {
          const score = Math.min(ourLabel.length, extLabel.length) / Math.max(ourLabel.length, extLabel.length)
          if (score > bestScore) {
            bestScore = score
            bestMatch = our
          }
          continue
        }

        // Levenshtein
        const dist = this._levenshtein(ourLabel, extLabel)
        const maxLen = Math.max(ourLabel.length, extLabel.length)
        const score = 1 - dist / maxLen
        if (score > bestScore && score > 0.5) {
          bestScore = score
          bestMatch = our
        }

        // Проверка EN меток
        const reqs = our.reqs || {}
        for (const [, reqData] of Object.entries(reqs)) {
          const alias = typeof reqData === 'object' ? reqData.alias : ''
          const val = typeof reqData === 'object' ? reqData.value : reqData
          if ((alias === 'prefLabel_en' || alias === 'en_label') && val) {
            const enLabel = val.toLowerCase().trim()
            // Проверка EN vs. все external метки
            for (const extL of (ext.labels || [{ value: extLabel }])) {
              const el = (extL.value || '').toLowerCase().trim()
              if (enLabel === el) {
                bestMatch = our
                bestScore = 0.95
                break
              }
              const enDist = this._levenshtein(enLabel, el)
              const enMaxLen = Math.max(enLabel.length, el.length)
              const enScore = 1 - enDist / enMaxLen
              if (enScore > bestScore && enScore > 0.5) {
                bestScore = enScore
                bestMatch = our
              }
            }
          }
        }
      }

      if (bestMatch && bestScore > 0.5) {
        mappings.push({
          external: {
            uri: ext.uri,
            label: ext.primaryLabel || ext.labels?.[0]?.value,
          },
          internal: {
            id: bestMatch.id,
            label: bestMatch.val,
          },
          score: Math.round(bestScore * 100) / 100,
          type: bestScore >= 0.9 ? 'exactMatch' : 'closeMatch',
          accepted: false,
        })
      }
    }

    // Сортировка по score desc
    mappings.sort((a, b) => b.score - a.score)

    return { mappings, totalExternal: externalConcepts.length, matched: mappings.length }
  }

  /**
   * Применение выбранных маппингов — создание exactMatch/closeMatch связей
   */
  async applyMappings(mappings) {
    const svc = getOntologyService()
    await svc.initialize()
    let created = 0

    for (const m of mappings) {
      if (!m.accepted) continue
      try {
        const relType = m.type === 'exactMatch' ? 'exact_match' : 'close_match'
        await svc.createRelation(m.internal.id, m.external.uri, relType)
        created++
      } catch (error) {
        logger.warn(`[AlignmentService] Не удалось создать связь: ${error.message}`)
      }
    }

    getRdfGraphService().invalidate()
    logger.info(`[AlignmentService] Применено ${created} маппингов`)

    return { applied: created, total: mappings.filter(m => m.accepted).length }
  }

  _levenshtein(a, b) {
    const matrix = []
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b[i - 1] === a[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }
    return matrix[b.length][a.length]
  }
}

let instance = null

export function getOntologyAlignmentService() {
  if (!instance) {
    instance = new OntologyAlignmentService()
  }
  return instance
}

export default OntologyAlignmentService
