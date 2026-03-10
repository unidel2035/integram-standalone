import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStartuperStore = defineStore('startuper', () => {
  // Данные из Стартапер-агента для предзаполнения FstApply
  const prefill = ref(null)

  function setPrefill(twin) {
    if (!twin) return
    prefill.value = {
      companyName:  twin.company || '',
      inn:          twin.inn || '',
      description:  twin.description || '',
      trl:          twin.trl ?? 5,
      teamSize:     twin.teamSize ?? null,
      stage:        mapStage(twin.stage),
      sector:       mapSector(twin.sector),
      competitors:  Array.isArray(twin.competitors) ? twin.competitors.join(', ') : (twin.competitors || ''),
      amount:       twin.askRub ? Math.round(twin.askRub / 1_000_000) : null,
      runway:       twin.runway ?? null,
      website:      twin.website || '',
      ceoName:      twin.founderName || '',
      teamDesc:     twin.founderBio ? `Основатель: ${twin.founderBio}` : '',
      irrForecast:  twin.projectedIRR ? Math.round(twin.projectedIRR * 100) : null,
      arr:          null,
    }
  }

  function clear() { prefill.value = null }

  return { prefill, setPrefill, clear }
})

function mapStage(s) {
  if (!s) return ''
  const m = { 'pre-seed': 'Pre-Seed (идея / прототип)', seed: 'Seed (MVP / ранние продажи)', a: 'Серия A (PMF / масштабирование)', b: 'Серия B (рост / экспансия)' }
  return m[s?.toLowerCase()] || s
}

function mapSector(s) {
  if (!s) return ''
  const m = { BAS: 'Беспилотные авиационные системы (БАС)', ROBO: 'Наземная робототехника', ME: 'Малая распределённая энергетика (МЭ)' }
  return m[s] || s
}
