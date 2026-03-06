import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Research Agent Store
 * Manages state for scientific research workflows
 * Based on proven NIR (Scientific Research Work) methodology
 */
export const useResearchAgentStore = defineStore('researchAgent', () => {
  // Research Projects
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)

  // Research Workflow Stages (based on docs/research workflow)
  const workflowStages = ref([
    {
      id: 1,
      name: 'Постановка цели',
      nameEn: 'Goal Setting',
      description: 'Определение темы, целей и задач исследования',
      icon: 'pi-target',
      color: 'blue',
      completed: false
    },
    {
      id: 2,
      name: 'Определение объекта',
      nameEn: 'Object Definition',
      description: 'Определение объекта и предмета исследования',
      icon: 'pi-search',
      color: 'indigo',
      completed: false
    },
    {
      id: 3,
      name: 'Обзор литературы',
      nameEn: 'Literature Review',
      description: 'Анализ существующих исследований и источников',
      icon: 'pi-book',
      color: 'purple',
      completed: false
    },
    {
      id: 4,
      name: 'Сбор данных',
      nameEn: 'Data Collection',
      description: 'Сбор и верификация данных из множественных источников',
      icon: 'pi-database',
      color: 'cyan',
      completed: false
    },
    {
      id: 5,
      name: 'Анализ данных',
      nameEn: 'Data Analysis',
      description: 'Обработка и анализ собранных данных',
      icon: 'pi-chart-line',
      color: 'teal',
      completed: false
    },
    {
      id: 6,
      name: 'Классификация',
      nameEn: 'Classification',
      description: 'Разработка классификаций и таксономий',
      icon: 'pi-sitemap',
      color: 'green',
      completed: false
    },
    {
      id: 7,
      name: 'Моделирование',
      nameEn: 'Modeling',
      description: 'Создание моделей и сценариев',
      icon: 'pi-chart-bar',
      color: 'yellow',
      completed: false
    },
    {
      id: 8,
      name: 'Подготовка отчета',
      nameEn: 'Report Writing',
      description: 'Написание научного отчета по ГОСТ',
      icon: 'pi-file-edit',
      color: 'orange',
      completed: false
    },
    {
      id: 9,
      name: 'Верификация',
      nameEn: 'Verification',
      description: 'Проверка всех данных, цифр и ссылок',
      icon: 'pi-check-circle',
      color: 'red',
      completed: false
    },
    {
      id: 10,
      name: 'Оформление',
      nameEn: 'Formatting',
      description: 'Оформление отчета по стандартам Q1/Q2',
      icon: 'pi-palette',
      color: 'pink',
      completed: false
    },
    {
      id: 11,
      name: 'Финализация',
      nameEn: 'Finalization',
      description: 'Финальная вычитка и подготовка к публикации',
      icon: 'pi-flag',
      color: 'lime',
      completed: false
    }
  ])

  // Bibliography and Sources
  const bibliography = ref([])
  const sourceVerifications = ref([])

  // Data Collection
  const collectedData = ref({
    companies: [],
    statistics: [],
    publications: [],
    patents: [],
    reports: []
  })

  // Report Sections
  const reportSections = ref([
    {
      id: 1,
      title: 'Введение',
      titleEn: 'Introduction',
      content: '',
      order: 1,
      required: true
    },
    {
      id: 2,
      title: 'Обзор литературы',
      titleEn: 'Literature Review',
      content: '',
      order: 2,
      required: true
    },
    {
      id: 3,
      title: 'Методология',
      titleEn: 'Methodology',
      content: '',
      order: 3,
      required: true
    },
    {
      id: 4,
      title: 'Результаты исследования',
      titleEn: 'Research Results',
      content: '',
      order: 4,
      required: true
    },
    {
      id: 5,
      title: 'Обсуждение',
      titleEn: 'Discussion',
      content: '',
      order: 5,
      required: true
    },
    {
      id: 6,
      title: 'Выводы',
      titleEn: 'Conclusions',
      content: '',
      order: 6,
      required: true
    },
    {
      id: 7,
      title: 'Список литературы',
      titleEn: 'References',
      content: '',
      order: 7,
      required: true
    }
  ])

  // Quality Standards (Q1/Q2 journal requirements)
  const qualityStandards = ref({
    minSources: 100,
    minVerificationSources: 3,
    scientificStyle: true,
    directReferences: true,
    GOSTFormatting: true,
    peerReviewed: false,
    targetJournals: ['Q1', 'Q2']
  })

  // Computed
  const totalProjects = computed(() => projects.value.length)
  const activeProjects = computed(() =>
    projects.value.filter(p => p.status === 'active')
  )
  const completedProjects = computed(() =>
    projects.value.filter(p => p.status === 'completed')
  )
  const totalSources = computed(() => bibliography.value.length)
  const verifiedSources = computed(() =>
    bibliography.value.filter(s => s.verified && s.verificationCount >= 3).length
  )

  // Actions
  function createProject(projectData) {
    const newProject = {
      id: Date.now().toString(),
      name: projectData.name,
      topic: projectData.topic,
      goal: projectData.goal,
      object: projectData.object || '',
      subject: projectData.subject || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stages: JSON.parse(JSON.stringify(workflowStages.value)),
      bibliography: [],
      data: {
        companies: [],
        statistics: [],
        publications: [],
        patents: [],
        reports: []
      },
      report: {
        sections: JSON.parse(JSON.stringify(reportSections.value)),
        metadata: {
          title: projectData.name,
          authors: projectData.authors || [],
          keywords: projectData.keywords || [],
          abstract: ''
        }
      },
      settings: {
        aiModel: projectData.aiModel || 'deepseek-chat',
        autoVerification: true,
        targetJournals: ['Q1', 'Q2']
      }
    }

    projects.value.push(newProject)
    currentProject.value = newProject
    return newProject
  }

  function updateProject(projectId, updates) {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      Object.assign(project, updates)
      project.updatedAt = new Date().toISOString()
    }
  }

  function deleteProject(projectId) {
    const index = projects.value.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects.value.splice(index, 1)
      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }
    }
  }

  function setCurrentProject(projectId) {
    currentProject.value = projects.value.find(p => p.id === projectId) || null
  }

  function addSource(projectId, sourceData) {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      const newSource = {
        id: Date.now().toString(),
        ...sourceData,
        addedAt: new Date().toISOString(),
        verified: false,
        verificationCount: 0,
        verificationSources: []
      }
      project.bibliography.push(newSource)
      return newSource
    }
    return null
  }

  function verifySource(projectId, sourceId, verificationData) {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      const source = project.bibliography.find(s => s.id === sourceId)
      if (source) {
        source.verificationSources.push(verificationData)
        source.verificationCount = source.verificationSources.length
        source.verified = source.verificationCount >= 3
        source.verifiedAt = new Date().toISOString()
      }
    }
  }

  function addData(projectId, dataType, dataItem) {
    const project = projects.value.find(p => p.id === projectId)
    if (project && project.data[dataType]) {
      project.data[dataType].push({
        id: Date.now().toString(),
        ...dataItem,
        addedAt: new Date().toISOString()
      })
    }
  }

  function updateReportSection(projectId, sectionId, content) {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      const section = project.report.sections.find(s => s.id === sectionId)
      if (section) {
        section.content = content
        section.updatedAt = new Date().toISOString()
      }
    }
  }

  function completeStage(projectId, stageId) {
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      const stage = project.stages.find(s => s.id === stageId)
      if (stage) {
        stage.completed = true
        stage.completedAt = new Date().toISOString()
      }
    }
  }

  function generateReport(projectId) {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return null

    const report = {
      metadata: project.report.metadata,
      sections: project.report.sections.filter(s => s.content),
      bibliography: project.bibliography.filter(s => s.verified),
      statistics: {
        totalSources: project.bibliography.length,
        verifiedSources: project.bibliography.filter(s => s.verified).length,
        dataPoints: Object.values(project.data).reduce((sum, arr) => sum + arr.length, 0)
      },
      generatedAt: new Date().toISOString()
    }

    return report
  }

  function exportToGOST(projectId) {
    const report = generateReport(projectId)
    if (!report) return null

    // Format report according to GOST 7.32-2017
    // This would need actual GOST formatting implementation
    return {
      format: 'GOST 7.32-2017',
      report,
      formattedAt: new Date().toISOString()
    }
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    workflowStages,
    bibliography,
    sourceVerifications,
    collectedData,
    reportSections,
    qualityStandards,

    // Computed
    totalProjects,
    activeProjects,
    completedProjects,
    totalSources,
    verifiedSources,

    // Actions
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    addSource,
    verifySource,
    addData,
    updateReportSection,
    completeStage,
    generateReport,
    exportToGOST
  }
})
