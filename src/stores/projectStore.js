/**
 * Project Store — сквозной контекст активного проекта.
 *
 * Позволяет передавать проект между страницами без query-params.
 * Все страницы (Factor, Committee, Deal, Portfolio) читают этот store при монтировании.
 *
 * Нормализованный формат projectStore:
 *   id, name, company, subfund, trl, stage, askMln, sovereignty, _source
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const LS_KEY = 'fst_active_project'

export const useProjectStore = defineStore('project', () => {
  const activeProject = ref(JSON.parse(localStorage.getItem(LS_KEY) || 'null'))

  const hasProject = computed(() => activeProject.value !== null)

  function setActive(project) {
    // Нормализуем под единый формат из любого источника
    const normalized = {
      id:          project.id   || project.inn || String(Date.now()),
      name:        project.name || project.company || project.companyName || '',
      company:     project.company || project.companyName || project.name || '',
      subfund:     project.subfund || project.subFund || 'БАС',
      trl:         project.trl ?? 5,
      stage:       project.stage || '',
      askMln:      project.askMln || project.totalAmount || 0,
      sovereignty: project.sovereignty || project.sovereigntyScore || 0,
      // Дополнительные поля, если есть
      description: project.description || '',
      inn:         project.inn || '',
      _source:     project._source || 'unknown',
      _raw:        project,   // исходный объект для тех кому нужны детали
    }
    activeProject.value = normalized
    localStorage.setItem(LS_KEY, JSON.stringify(normalized))
  }

  function clearActive() {
    activeProject.value = null
    localStorage.removeItem(LS_KEY)
  }

  return { activeProject, hasProject, setActive, clearActive }
})
