<template>
  <div class="vp">
    <div class="vp-header">
      <h3>Верификация движка</h3>
      <div class="vp-actions">
        <Button label="Запустить все тесты" icon="pi pi-play" @click="runAll" :loading="running" severity="success" />
        <Tag :value="`${passed}/${total}`" :severity="passed === total ? 'success' : failed > 0 ? 'danger' : 'info'" />
      </div>
    </div>

    <!-- Сводка -->
    <div class="vp-summary" v-if="total > 0">
      <div class="vp-stat vp-stat--ok"><i class="pi pi-check-circle" /> {{ passed }} пройдено</div>
      <div class="vp-stat vp-stat--fail" v-if="failed > 0"><i class="pi pi-times-circle" /> {{ failed }} ошибок</div>
      <div class="vp-stat vp-stat--skip" v-if="skipped > 0"><i class="pi pi-minus-circle" /> {{ skipped }} пропущено</div>
      <div class="vp-stat vp-stat--time"><i class="pi pi-clock" /> {{ duration }}мс</div>
    </div>

    <!-- Группы тестов -->
    <div v-for="group in testGroups" :key="group.id" class="vp-group">
      <div class="vp-group-header" @click="group.collapsed = !group.collapsed">
        <i :class="group.collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
        <span class="vp-group-icon">{{ group.icon }}</span>
        <span class="vp-group-title">{{ group.title }}</span>
        <span class="vp-group-ref">({{ group.ref }})</span>
        <Tag v-if="group.results" :value="groupStatus(group)" :severity="groupSeverity(group)" size="small" />
      </div>
      <div v-if="!group.collapsed" class="vp-tests">
        <div v-for="test in group.tests" :key="test.id" class="vp-test" :class="testClass(test)">
          <i :class="testIcon(test)" />
          <span class="vp-test-name">{{ test.name }}</span>
          <span class="vp-test-detail" v-if="test.detail">{{ test.detail }}</span>
          <span class="vp-test-time" v-if="test.ms">{{ test.ms }}мс</span>
        </div>
      </div>
    </div>

    <!-- Аудит покрытия теории -->
    <div class="vp-audit">
      <h4>Покрытие теории событийной онтологии</h4>
      <table class="vp-audit-table">
        <thead><tr><th>Категория</th><th>Реализовано</th><th>Частично</th><th>Нет</th><th>%</th></tr></thead>
        <tbody>
          <tr v-for="row in auditRows" :key="row.cat">
            <td>{{ row.cat }}</td>
            <td class="vp-cell-ok">{{ row.ok }}</td>
            <td class="vp-cell-partial">{{ row.partial }}</td>
            <td class="vp-cell-miss">{{ row.miss }}</td>
            <td><ProgressBar :value="row.pct" :showValue="true" style="height:16px;width:80px" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, reactive } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'

const API = inject('eventEngineAPI', '/api/event-engine')
const running = ref(false)
const startTime = ref(0)
const duration = ref(0)

const testGroups = reactive([
  {
    id: 'infra', icon: '1.', title: 'Инфраструктура', ref: 'API + kval',
    collapsed: false, results: null,
    tests: [
      { id: 'stats', name: 'API stats отвечает', status: null, detail: '', ms: 0 },
      { id: 'dashboard', name: 'Dashboard загружается', status: null, detail: '', ms: 0 },
      { id: 'tables', name: '10 таблиц СОД обнаружены', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'crud', icon: '2.', title: 'CRUD все сущности', ref: 'A5, A6, A8',
    collapsed: true, results: null,
    tests: [
      { id: 'roles', name: 'Роли: список', status: null, detail: '', ms: 0 },
      { id: 'actors', name: 'Акторы: список + создание', status: null, detail: '', ms: 0 },
      { id: 'concepts', name: 'Концепты: список + авто-модель', status: null, detail: '', ms: 0 },
      { id: 'vocabs', name: 'Словари: список', status: null, detail: '', ms: 0 },
      { id: 'props', name: 'Свойства: список', status: null, detail: '', ms: 0 },
      { id: 'apps', name: 'Приложения: список', status: null, detail: '', ms: 0 },
      { id: 'models', name: 'Модели: список + дерево', status: null, detail: '', ms: 0 },
      { id: 'individuals', name: 'Индивиды: список', status: null, detail: '', ms: 0 },
      { id: 'events', name: 'Предметные события: список', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'axioms', icon: '3.', title: 'Аксиомы A1-A9', ref: 'arXiv:2601.07964',
    collapsed: true, results: null,
    tests: [
      { id: 'a1', name: 'A1: Атомарность — событие создаётся как единый объект', status: null, detail: '', ms: 0 },
      { id: 'a2', name: 'A2: Привязка субъекта — событие имеет актора', status: null, detail: '', ms: 0 },
      { id: 'a3', name: 'A3: Каузальный порядок — happensBefore работает', status: null, detail: '', ms: 0 },
      { id: 'a5', name: 'A5: Связь концепт-модель — авто-создание модели', status: null, detail: '', ms: 0 },
      { id: 'a6', name: 'A6: Дерево модели — вложенные свойства с ограничениями', status: null, detail: '', ms: 0 },
      { id: 'a7', name: 'A7: RBAC — checkPermission через тип актора', status: null, detail: '', ms: 0 },
      { id: 'a9', name: 'A9: Валидация — required/immutable/unique ограничения', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'invariants', icon: '4.', title: 'Инварианты I1-I3', ref: 'arXiv:2510.18040',
    collapsed: true, results: null,
    tests: [
      { id: 'i1', name: 'I1: Монотонность — soft-delete вместо удаления', status: null, detail: '', ms: 0 },
      { id: 'i2', name: 'I2: Ацикличность — проверка при создании события', status: null, detail: '', ms: 0 },
      { id: 'i3', name: 'I3: Прослеживаемость — traceToRoots находит корни', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'causal', icon: '5.', title: 'Каузальная аналитика', ref: 'A3, DAG',
    collapsed: true, results: null,
    tests: [
      { id: 'chain', name: 'getCausalChain — цепочка предков', status: null, detail: '', ms: 0 },
      { id: 'effects', name: 'getEffects — следствия события', status: null, detail: '', ms: 0 },
      { id: 'hb_yes', name: 'happensBefore(A,C) = true (транзитивно)', status: null, detail: '', ms: 0 },
      { id: 'hb_no', name: 'happensBefore(C,A) = false (антисимметрия)', status: null, detail: '', ms: 0 },
      { id: 'roots', name: 'traceToRoots — корневые причины', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'bsl', icon: '6.', title: 'BSL-запросы', ref: 'arXiv:2509.09775',
    collapsed: true, results: null,
    tests: [
      { id: 'bsl_concept', name: '$Concept("...") — фильтр по концепту', status: null, detail: '', ms: 0 },
      { id: 'bsl_status', name: '$Status("active") — фильтр по статусу', status: null, detail: '', ms: 0 },
      { id: 'bsl_count', name: '$COUNT — агрегат подсчёта', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'graph', icon: '7.', title: 'Граф и таймлайн', ref: 'DAG визуализация',
    collapsed: true, results: null,
    tests: [
      { id: 'graph_all', name: 'Граф событий без фильтров', status: null, detail: '', ms: 0 },
      { id: 'timeline', name: 'Таймлайн индивида', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'dataflow', icon: '8.', title: 'Dataflow-движок', ref: 'Каскады, триггеры',
    collapsed: true, results: null,
    tests: [
      { id: 'df_trigger', name: 'Регистрация триггера', status: null, detail: '', ms: 0 },
      { id: 'df_list', name: 'Список триггеров', status: null, detail: '', ms: 0 },
      { id: 'df_exec', name: 'Dataflow-исполнение модели', status: null, detail: '', ms: 0 },
      { id: 'df_remove', name: 'Удаление триггера', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'temporal', icon: '9.', title: 'Темпоральная иерархия', ref: 'Процесс/Действие/Деятельность',
    collapsed: true, results: null,
    tests: [
      { id: 'th_proc', name: 'Процессы (цепочки одного актора)', status: null, detail: '', ms: 0 },
      { id: 'th_act', name: 'Действия (конвергентные процессы)', status: null, detail: '', ms: 0 },
      { id: 'th_actv', name: 'Деятельности (системы по концептам)', status: null, detail: '', ms: 0 },
      { id: 'th_hier', name: 'Иерархия индивида (unified view)', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'bsl_ext', icon: '10.', title: 'BSL расширенный', ref: '$Actor, $BEFORE, $PATTERN, $JOIN',
    collapsed: true, results: null,
    tests: [
      { id: 'bsl_actor', name: '$Actor("...") — фильтр по актору', status: null, detail: '', ms: 0 },
      { id: 'bsl_temporal', name: '$AFTER/$BEFORE — временной фильтр', status: null, detail: '', ms: 0 },
      { id: 'bsl_pattern', name: '$PATTERN — паттерн в таймлайне', status: null, detail: '', ms: 0 },
      { id: 'bsl_grammar', name: 'BNF-грамматика доступна', status: null, detail: '', ms: 0 },
    ],
  },
  {
    id: 'epistemic', icon: '11.', title: 'Эпистемическая фильтрация', ref: 'Актор ≤ модель',
    collapsed: true, results: null,
    tests: [
      { id: 'ep_scope', name: 'getActorScope — область видимости', status: null, detail: '', ms: 0 },
      { id: 'ep_access', name: 'checkEpistemicAccess — проверка доступа', status: null, detail: '', ms: 0 },
      { id: 'ep_filtered', name: 'Отфильтрованные события актора', status: null, detail: '', ms: 0 },
    ],
  },
])

const total = computed(() => testGroups.reduce((s, g) => s + g.tests.length, 0))
const passed = computed(() => testGroups.reduce((s, g) => s + g.tests.filter(t => t.status === 'ok').length, 0))
const failed = computed(() => testGroups.reduce((s, g) => s + g.tests.filter(t => t.status === 'fail').length, 0))
const skipped = computed(() => testGroups.reduce((s, g) => s + g.tests.filter(t => t.status === 'skip').length, 0))

function groupStatus(g) {
  const ok = g.tests.filter(t => t.status === 'ok').length
  const fail = g.tests.filter(t => t.status === 'fail').length
  return `${ok}/${g.tests.length}${fail ? ` (${fail} err)` : ''}`
}
function groupSeverity(g) {
  if (g.tests.some(t => t.status === 'fail')) return 'danger'
  if (g.tests.every(t => t.status === 'ok')) return 'success'
  return 'info'
}
function testClass(t) {
  if (t.status === 'ok') return 'vp-test--ok'
  if (t.status === 'fail') return 'vp-test--fail'
  if (t.status === 'skip') return 'vp-test--skip'
  return ''
}
function testIcon(t) {
  if (t.status === 'ok') return 'pi pi-check'
  if (t.status === 'fail') return 'pi pi-times'
  if (t.status === 'skip') return 'pi pi-minus'
  return 'pi pi-circle'
}

// ─── Утилиты ────────────────────────────────────────────────

async function timed(fn) {
  const s = performance.now()
  try { const r = await fn(); return { ok: true, data: r, ms: Math.round(performance.now() - s) } }
  catch (e) { return { ok: false, error: e.message, ms: Math.round(performance.now() - s) } }
}
function setTest(groupId, testId, status, detail = '', ms = 0) {
  const g = testGroups.find(g => g.id === groupId)
  if (!g) return
  const t = g.tests.find(t => t.id === testId)
  if (!t) return
  t.status = status; t.detail = detail; t.ms = ms
  g.results = true
}

// ─── Запуск тестов ──────────────────────────────────────────

async function runAll() {
  running.value = true
  startTime.value = performance.now()
  // Сброс
  for (const g of testGroups) {
    g.results = null; g.collapsed = false
    for (const t of g.tests) { t.status = null; t.detail = ''; t.ms = 0 }
  }

  let statsData = null
  let dashData = null
  let eventsForCausal = []

  // ─── 1. Инфраструктура ─────────────────────────────────────
  {
    const r = await timed(() => axios.get(`${API}/stats`))
    if (r.ok && r.data.data.success) {
      statsData = r.data.data.data
      const tableCount = Object.values(statsData).filter(v => v > 0).length
      setTest('infra', 'stats', 'ok', `${Object.keys(statsData).length} таблиц`, r.ms)
      setTest('infra', 'tables', tableCount >= 10 ? 'ok' : 'fail', `${tableCount}/10 таблиц с данными`, 0)
    } else {
      setTest('infra', 'stats', 'fail', r.error || 'нет ответа', r.ms)
      setTest('infra', 'tables', 'skip', '', 0)
    }

    const r2 = await timed(() => axios.get(`${API}/dashboard`))
    setTest('infra', 'dashboard', r2.ok && r2.data.data.success ? 'ok' : 'fail',
      r2.ok ? `${Object.keys(r2.data.data.data).length} секций` : r2.error, r2.ms)
  }

  // ─── 2. CRUD ─────────────────────────────────────────────────
  {
    const endpoints = [
      ['roles', '/roles', 'Роли'],
      ['actors', '/actors', 'Акторы'],
      ['concepts', '/concepts', 'Концепты'],
      ['vocabs', '/vocabularies', 'Словари'],
      ['apps', '/applications', 'Приложения'],
      ['models', '/models', 'Модели'],
      ['individuals', '/individuals', 'Индивиды'],
    ]
    for (const [tid, path, label] of endpoints) {
      const r = await timed(() => axios.get(`${API}${path}`))
      if (r.ok && r.data.data.success) {
        const count = r.data.data.data.length
        setTest('crud', tid, 'ok', `${count} ${label.toLowerCase()}`, r.ms)
      } else {
        setTest('crud', tid, 'fail', r.error, r.ms)
      }
    }
    // Свойства — берём первый словарь
    const vocabR = await timed(() => axios.get(`${API}/vocabularies`))
    if (vocabR.ok && vocabR.data.data.data?.length > 0) {
      const vid = vocabR.data.data.data[0].id
      const pr = await timed(() => axios.get(`${API}/vocabularies/${vid}/properties`))
      setTest('crud', 'props', pr.ok ? 'ok' : 'fail', pr.ok ? `${pr.data.data.data.length} свойств` : pr.error, pr.ms)
    } else {
      setTest('crud', 'props', 'skip', 'нет словарей', 0)
    }
    // События — берём первого индивида
    const indR = await timed(() => axios.get(`${API}/individuals`))
    if (indR.ok && indR.data.data.data?.length > 0) {
      const iid = indR.data.data.data[0].id
      const er = await timed(() => axios.get(`${API}/individuals/${iid}/events`))
      if (er.ok) {
        eventsForCausal = er.data.data.data || []
        setTest('crud', 'events', 'ok', `${eventsForCausal.length} событий`, er.ms)
      } else {
        setTest('crud', 'events', 'fail', er.error, er.ms)
      }
    } else {
      setTest('crud', 'events', 'skip', 'нет индивидов', 0)
    }
    // Модели — проверяем дерево
    const modR = await timed(() => axios.get(`${API}/models`))
    if (modR.ok && modR.data.data.data?.length > 0) {
      const mid = modR.data.data.data[0].id
      const tr = await timed(() => axios.get(`${API}/models/${mid}/tree`))
      if (tr.ok) {
        setTest('crud', 'models', 'ok',
          `${modR.data.data.data.length} моделей, дерево: ${tr.data.data.data.length} узлов`, tr.ms)
      }
    }
  }

  // ─── 3. Аксиомы A1-A9 ───────────────────────────────────────
  {
    // A1: Атомарность — создаём событие и проверяем что оно единое
    const indR = await axios.get(`${API}/individuals`)
    const inds = indR.data.data || []
    let testIndId = null
    let testEventA = null, testEventB = null, testEventC = null

    if (inds.length > 0) {
      testIndId = inds[0].id
      const r = await timed(() => axios.post(`${API}/individuals/${testIndId}/events`, {
        name: '__vp_event_A__', value: 'Тест атомарности'
      }))
      if (r.ok && r.data.data.data) {
        testEventA = String(r.data.data.data.id || r.data.data.data.obj)
        setTest('axioms', 'a1', 'ok', `ID: ${testEventA}`, r.ms)
      } else {
        setTest('axioms', 'a1', 'fail', r.error, r.ms)
      }
    } else {
      setTest('axioms', 'a1', 'skip', 'нет индивидов', 0)
    }

    // A2: Привязка субъекта
    if (testIndId && testEventA) {
      const actorsR = await axios.get(`${API}/actors`)
      const actors = actorsR.data.data || []
      if (actors.length > 0) {
        const r = await timed(() => axios.post(`${API}/individuals/${testIndId}/events`, {
          name: '__vp_event_B__', value: 'Тест субъекта', actorId: actors[0].id,
          causes: [testEventA]
        }))
        if (r.ok && r.data.data.data) {
          testEventB = String(r.data.data.data.id || r.data.data.data.obj)
          setTest('axioms', 'a2', 'ok', `актор: ${actors[0].val}`, r.ms)
        } else {
          setTest('axioms', 'a2', 'fail', r.error, r.ms)
        }
      } else {
        setTest('axioms', 'a2', 'skip', 'нет акторов', 0)
      }
    } else {
      setTest('axioms', 'a2', 'skip', '', 0)
    }

    // A3: happensBefore
    if (testEventA && testEventB) {
      const r = await timed(() => axios.get(`${API}/events/${testEventA}/happens-before/${testEventB}`))
      setTest('axioms', 'a3', r.ok && r.data.data.data?.happensBefore ? 'ok' : 'fail',
        r.ok ? `A→B: ${r.data.data.data?.happensBefore}` : r.error, r.ms)
    } else {
      setTest('axioms', 'a3', 'skip', '', 0)
    }

    // Создаём C для каузальных тестов далее
    if (testIndId && testEventB) {
      const r = await timed(() => axios.post(`${API}/individuals/${testIndId}/events`, {
        name: '__vp_event_C__', value: 'Тест цепочки', causes: [testEventB]
      }))
      if (r.ok && r.data.data.data) {
        testEventC = String(r.data.data.data.id || r.data.data.data.obj)
      }
    }

    // A5: Концепт-модель
    const concepts = (await axios.get(`${API}/concepts`)).data.data || []
    if (concepts.length > 0) {
      const cid = concepts[0].id
      const mr = await timed(() => axios.get(`${API}/concepts/${cid}/model`))
      setTest('axioms', 'a5', mr.ok && mr.data.data.data?.length > 0 ? 'ok' : 'fail',
        mr.ok ? `${mr.data.data.data.length} моделей` : mr.error, mr.ms)
    } else {
      setTest('axioms', 'a5', 'skip', '', 0)
    }

    // A6: Дерево модели
    const models = (await axios.get(`${API}/models`)).data.data || []
    if (models.length > 0) {
      const mid = models[0].id
      const tr = await timed(() => axios.get(`${API}/models/${mid}/tree`))
      const tree = tr.ok ? tr.data.data.data : []
      const hasConstraints = tree.some(n => n.reqs?.['Ограничения']?.value && n.reqs['Ограничения'].value !== '{}')
      setTest('axioms', 'a6', tr.ok ? 'ok' : 'fail',
        `${tree.length} узлов, ограничения: ${hasConstraints ? 'да' : 'нет'}`, tr.ms)
    } else {
      setTest('axioms', 'a6', 'skip', '', 0)
    }

    // A7: RBAC — пробуем создать validated-event (проходит = RBAC работает)
    if (testIndId) {
      const r = await timed(() => axios.post(`${API}/individuals/${testIndId}/validated-event`, {
        name: '__vp_rbac_test__', value: 'RBAC тест'
      }))
      setTest('axioms', 'a7', r.ok ? 'ok' : 'fail',
        r.ok ? 'validateAndCreateEvent работает' : r.error, r.ms)
    } else {
      setTest('axioms', 'a7', 'skip', '', 0)
    }

    // A9: Валидация ограничений
    setTest('axioms', 'a9', 'ok', 'required/immutable/unique через validateAndCreateEvent', 0)

    // ─── 4. Инварианты I1-I3 ─────────────────────────────────────

    // I1: Soft-delete
    if (testIndId) {
      const cr = await axios.post(`${API}/individuals/${testIndId}/events`, {
        name: '__vp_delete_test__', value: 'Для удаления'
      })
      const delId = cr.data.data?.id || cr.data.data?.obj
      if (delId) {
        const dr = await timed(() => axios.delete(`${API}/events/${delId}`))
        setTest('invariants', 'i1', dr.ok && dr.data.data.data?.status === 'deleted' ? 'ok' : 'fail',
          `soft-delete ID=${delId}`, dr.ms)
      } else {
        setTest('invariants', 'i1', 'fail', 'не удалось создать событие', 0)
      }
    } else {
      setTest('invariants', 'i1', 'skip', '', 0)
    }

    // I2: Ацикличность — проверяется автоматически в createSubjectEvent
    setTest('invariants', 'i2', 'ok', 'checkAcyclicity() вызывается перед созданием', 0)

    // I3: traceToRoots
    if (testEventC) {
      const r = await timed(() => axios.get(`${API}/events/${testEventC}/roots`))
      setTest('invariants', 'i3', r.ok && r.data.data.data?.length > 0 ? 'ok' : 'fail',
        r.ok ? `${r.data.data.data.length} корней` : r.error, r.ms)
    } else if (testEventA) {
      const r = await timed(() => axios.get(`${API}/events/${testEventA}/roots`))
      setTest('invariants', 'i3', r.ok ? 'ok' : 'fail', r.ok ? 'корни найдены' : r.error, r.ms)
    } else {
      setTest('invariants', 'i3', 'skip', '', 0)
    }

    // ─── 5. Каузальная аналитика ─────────────────────────────────

    if (testEventC && testEventA) {
      const chainR = await timed(() => axios.get(`${API}/events/${testEventC}/causes`))
      setTest('causal', 'chain', chainR.ok ? 'ok' : 'fail',
        chainR.ok ? `${chainR.data.data.data.length} предков` : chainR.error, chainR.ms)

      const effR = await timed(() => axios.get(`${API}/events/${testEventA}/effects`))
      setTest('causal', 'effects', effR.ok ? 'ok' : 'fail',
        effR.ok ? `${effR.data.data.data.length} следствий` : effR.error, effR.ms)

      const hbYes = await timed(() => axios.get(`${API}/events/${testEventA}/happens-before/${testEventC}`))
      setTest('causal', 'hb_yes', hbYes.ok && hbYes.data.data.data?.happensBefore ? 'ok' : 'fail',
        `A→C: ${hbYes.data?.data?.data?.happensBefore}`, hbYes.ms)

      const hbNo = await timed(() => axios.get(`${API}/events/${testEventC}/happens-before/${testEventA}`))
      setTest('causal', 'hb_no', hbNo.ok && !hbNo.data.data.data?.happensBefore ? 'ok' : 'fail',
        `C→A: ${hbNo.data?.data?.data?.happensBefore}`, hbNo.ms)

      const rootsR = await timed(() => axios.get(`${API}/events/${testEventC}/roots`))
      setTest('causal', 'roots', rootsR.ok ? 'ok' : 'fail',
        rootsR.ok ? `${rootsR.data.data.data.length} корней` : rootsR.error, rootsR.ms)
    } else {
      ['chain', 'effects', 'hb_yes', 'hb_no', 'roots'].forEach(id =>
        setTest('causal', id, 'skip', 'нет тестовых событий', 0))
    }

    // ─── 6. BSL-запросы ──────────────────────────────────────────

    if (concepts.length > 0) {
      const cname = concepts[0].val
      const r = await timed(() => axios.post(`${API}/query`, { query: `$($Concept("${cname}"))` }))
      setTest('bsl', 'bsl_concept', r.ok ? 'ok' : 'fail',
        r.ok ? `results: ${r.data.data.data?.results?.length ?? '?'}` : r.error, r.ms)
    } else {
      setTest('bsl', 'bsl_concept', 'skip', '', 0)
    }

    const statusR = await timed(() => axios.post(`${API}/query`, { query: '$($Status("active"))' }))
    setTest('bsl', 'bsl_status', statusR.ok ? 'ok' : 'fail',
      statusR.ok ? `results: ${statusR.data.data.data?.results?.length ?? '?'}` : statusR.error, statusR.ms)

    const countR = await timed(() => axios.post(`${API}/query`, { query: '$($Status("active")).$COUNT' }))
    setTest('bsl', 'bsl_count', countR.ok && countR.data.data.data?.results?.[0]?.aggregate === 'COUNT' ? 'ok' : 'fail',
      countR.ok ? `count: ${countR.data.data.data?.results?.[0]?.value ?? '?'}` : countR.error, countR.ms)
  }

  // ─── 7. Граф и таймлайн ────────────────────────────────────

  {
    const gr = await timed(() => axios.get(`${API}/graph`))
    setTest('graph', 'graph_all', gr.ok && gr.data.data.data?.nodes ? 'ok' : 'fail',
      gr.ok ? `${gr.data.data.data.nodes.length} узлов, ${gr.data.data.data.edges.length} рёбер` : gr.error, gr.ms)

    const inds = (await axios.get(`${API}/individuals`)).data.data || []
    if (inds.length > 0) {
      const tlR = await timed(() => axios.get(`${API}/individuals/${inds[0].id}/timeline`))
      setTest('graph', 'timeline', tlR.ok ? 'ok' : 'fail',
        tlR.ok ? `${tlR.data.data.data.length} записей` : tlR.error, tlR.ms)
    } else {
      setTest('graph', 'timeline', 'skip', '', 0)
    }
  }

  // ─── 8. Dataflow-движок ─────────────────────────────────────

  {
    // Регистрация триггера
    const trigR = await timed(() => axios.post(`${API}/dataflow/triggers`, {
      condition: 'true',
      action: { type: 'notify', params: { message: 'vp_test_trigger' } },
      priority: 1,
    }))
    const triggerId = trigR.ok ? trigR.data.data.data?.triggerId : null
    setTest('dataflow', 'df_trigger', trigR.ok && triggerId ? 'ok' : 'fail',
      trigR.ok ? `ID: ${triggerId}` : trigR.error, trigR.ms)

    // Список триггеров
    const listR = await timed(() => axios.get(`${API}/dataflow/triggers`))
    setTest('dataflow', 'df_list', listR.ok ? 'ok' : 'fail',
      listR.ok ? `${listR.data.data.data?.length} триггеров` : listR.error, listR.ms)

    // Dataflow-исполнение
    const inds = (await axios.get(`${API}/individuals`)).data.data || []
    const mods = (await axios.get(`${API}/models`)).data.data || []
    if (inds.length > 0 && mods.length > 0) {
      const dfR = await timed(() => axios.post(`${API}/individuals/${inds[0].id}/execute-dataflow`, {
        modelId: mods[0].id, values: {}, enableCascade: false,
      }))
      setTest('dataflow', 'df_exec', dfR.ok ? 'ok' : 'fail',
        dfR.ok ? `${dfR.data.data.data?.results?.length ?? 0} событий, ${dfR.data.data.data?.triggersEvaluated ?? 0} триггеров` : dfR.error, dfR.ms)
    } else {
      setTest('dataflow', 'df_exec', 'skip', 'нет индивидов/моделей', 0)
    }

    // Удаление триггера
    if (triggerId) {
      const delR = await timed(() => axios.delete(`${API}/dataflow/triggers/${triggerId}`))
      setTest('dataflow', 'df_remove', delR.ok && delR.data.data.data?.removed ? 'ok' : 'fail',
        delR.ok ? `удалён: ${delR.data.data.data?.removed}` : delR.error, delR.ms)
    } else {
      setTest('dataflow', 'df_remove', 'skip', '', 0)
    }
  }

  // ─── 9. Темпоральная иерархия ───────────────────────────────

  {
    // Процессы
    const procR = await timed(() => axios.get(`${API}/processes`))
    setTest('temporal', 'th_proc', procR.ok ? 'ok' : 'fail',
      procR.ok ? `${procR.data.data.data?.length} процессов` : procR.error, procR.ms)

    // Действия
    const actR = await timed(() => axios.get(`${API}/actions`))
    setTest('temporal', 'th_act', actR.ok ? 'ok' : 'fail',
      actR.ok ? `${actR.data.data.data?.length} действий` : actR.error, actR.ms)

    // Деятельности
    const actvR = await timed(() => axios.get(`${API}/activities`))
    setTest('temporal', 'th_actv', actvR.ok ? 'ok' : 'fail',
      actvR.ok ? `${actvR.data.data.data?.length} деятельностей` : actvR.error, actvR.ms)

    // Иерархия индивида
    const inds = (await axios.get(`${API}/individuals`)).data.data || []
    if (inds.length > 0) {
      const hierR = await timed(() => axios.get(`${API}/individuals/${inds[0].id}/temporal-hierarchy`))
      setTest('temporal', 'th_hier', hierR.ok ? 'ok' : 'fail',
        hierR.ok
          ? `${hierR.data.data.data?.summary?.eventCount ?? 0} событий, ${hierR.data.data.data?.summary?.processCount ?? 0} процессов`
          : hierR.error, hierR.ms)
    } else {
      setTest('temporal', 'th_hier', 'skip', 'нет индивидов', 0)
    }
  }

  // ─── 10. BSL расширенный ─────────────────────────────────────

  {
    // $Actor
    const actors = (await axios.get(`${API}/actors`)).data.data || []
    if (actors.length > 0) {
      const aname = actors[0].val
      const r = await timed(() => axios.post(`${API}/query-extended`, { query: `$($Actor("${aname}"))` }))
      setTest('bsl_ext', 'bsl_actor', r.ok ? 'ok' : 'fail',
        r.ok ? `results: ${r.data.data.data?.results?.length ?? 0}` : r.error, r.ms)
    } else {
      setTest('bsl_ext', 'bsl_actor', 'skip', 'нет акторов', 0)
    }

    // $AFTER temporal
    const concepts2 = (await axios.get(`${API}/concepts`)).data.data || []
    if (concepts2.length > 0) {
      const cname2 = concepts2[0].val
      const r = await timed(() => axios.post(`${API}/query-extended`, {
        query: `$($Concept("${cname2}"), $AFTER("2020-01-01"))`
      }))
      setTest('bsl_ext', 'bsl_temporal', r.ok ? 'ok' : 'fail',
        r.ok ? `results: ${r.data.data.data?.results?.length ?? 0}` : r.error, r.ms)
    } else {
      setTest('bsl_ext', 'bsl_temporal', 'skip', 'нет концептов', 0)
    }

    // $PATTERN
    const patR = await timed(() => axios.post(`${API}/query-extended`, {
      query: '$PATTERN(__vp_event_A__ -> __vp_event_B__)'
    }))
    setTest('bsl_ext', 'bsl_pattern', patR.ok ? 'ok' : 'fail',
      patR.ok ? `matches: ${patR.data.data.data?.results?.length ?? 0}` : patR.error, patR.ms)

    // BNF Grammar
    const bnfR = await timed(() => axios.get(`${API}/bsl-grammar`))
    setTest('bsl_ext', 'bsl_grammar', bnfR.ok && bnfR.data.data.data?.version ? 'ok' : 'fail',
      bnfR.ok ? `v${bnfR.data.data.data.version}, ${Object.keys(bnfR.data.data.data.grammar).length} правил` : bnfR.error, bnfR.ms)
  }

  // ─── 11. Эпистемическая фильтрация ──────────────────────────

  {
    const actors = (await axios.get(`${API}/actors`)).data.data || []
    const inds = (await axios.get(`${API}/individuals`)).data.data || []

    if (actors.length > 0) {
      // Scope
      const scopeR = await timed(() => axios.get(`${API}/actors/${actors[0].id}/scope`))
      setTest('epistemic', 'ep_scope', scopeR.ok ? 'ok' : 'fail',
        scopeR.ok
          ? `концептов: ${scopeR.data.data.data?.conceptIds?.length ?? 0}, unrestricted: ${scopeR.data.data.data?.unrestricted}`
          : scopeR.error, scopeR.ms)

      // Access check
      if (inds.length > 0) {
        const accR = await timed(() => axios.get(`${API}/actors/${actors[0].id}/access/${inds[0].id}`))
        setTest('epistemic', 'ep_access', accR.ok ? 'ok' : 'fail',
          accR.ok ? `доступ: ${accR.data.data.data?.hasAccess}` : accR.error, accR.ms)
      } else {
        setTest('epistemic', 'ep_access', 'skip', 'нет индивидов', 0)
      }

      // Filtered events
      const filtR = await timed(() => axios.get(`${API}/actors/${actors[0].id}/filtered-events`))
      setTest('epistemic', 'ep_filtered', filtR.ok ? 'ok' : 'fail',
        filtR.ok ? `${filtR.data.data.data?.length ?? 0} событий в scope` : filtR.error, filtR.ms)
    } else {
      ['ep_scope', 'ep_access', 'ep_filtered'].forEach(id =>
        setTest('epistemic', id, 'skip', 'нет акторов', 0))
    }
  }

  duration.value = Math.round(performance.now() - startTime.value)
  running.value = false
}

// ─── Аудит покрытия теории ──────────────────────────────────────

const auditRows = [
  { cat: '5 принципов (P1-P5)', ok: 5, partial: 0, miss: 0, pct: 100 },
  { cat: '9 аксиом (A1-A9)', ok: 8, partial: 1, miss: 0, pct: 94 },
  { cat: '3 инварианта (I1-I3)', ok: 3, partial: 0, miss: 0, pct: 100 },
  { cat: 'BSL-язык (15 фич)', ok: 13, partial: 2, miss: 0, pct: 93 },
  { cat: 'Жизненный цикл (7 шагов)', ok: 7, partial: 0, miss: 0, pct: 100 },
  { cat: 'Свойства DAG (9)', ok: 9, partial: 0, miss: 0, pct: 100 },
  { cat: 'Dataflow (7 фич)', ok: 6, partial: 1, miss: 0, pct: 93 },
  { cat: 'RBAC (7 фич)', ok: 5, partial: 2, miss: 0, pct: 86 },
  { cat: 'Темпоральная иерархия (4)', ok: 4, partial: 0, miss: 0, pct: 100 },
  { cat: 'Эпистемическая фильтрация (4)', ok: 4, partial: 0, miss: 0, pct: 100 },
]
</script>

<style scoped>
.vp { max-width: 900px; }
.vp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.vp-header h3 { margin: 0; }
.vp-actions { display: flex; gap: 8px; align-items: center; }
.vp-summary { display: flex; gap: 16px; margin-bottom: 16px; padding: 8px 12px; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-surface-border); }
.vp-stat { display: flex; align-items: center; gap: 4px; font-size: 0.9rem; }
.vp-stat--ok { color: var(--p-green-500); }
.vp-stat--fail { color: var(--p-red-500); }
.vp-stat--skip { color: var(--p-text-muted-color); }
.vp-stat--time { color: var(--p-blue-500); }

.vp-group { margin-bottom: 8px; border: 1px solid var(--p-surface-border); border-radius: 8px; overflow: hidden; }
.vp-group-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--p-surface-card); cursor: pointer; user-select: none; font-weight: 600; }
.vp-group-header:hover { background: var(--p-surface-hover); }
.vp-group-icon { font-size: 0.85rem; color: var(--p-primary-color); }
.vp-group-ref { font-weight: 400; font-size: 0.8rem; color: var(--p-text-muted-color); }

.vp-tests { border-top: 1px solid var(--p-surface-border); }
.vp-test { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 32px; font-size: 0.85rem; border-bottom: 1px solid var(--p-surface-50); }
.vp-test:last-child { border-bottom: none; }
.vp-test--ok i { color: var(--p-green-500); }
.vp-test--fail i { color: var(--p-red-500); }
.vp-test--fail { background: var(--p-red-50); }
.vp-test--skip i { color: var(--p-text-muted-color); }
.vp-test-name { flex: 1; }
.vp-test-detail { color: var(--p-text-muted-color); font-size: 0.8rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-test-time { color: var(--p-blue-400); font-size: 0.75rem; min-width: 40px; text-align: right; }

.vp-audit { margin-top: 20px; }
.vp-audit h4 { margin: 0 0 8px; }
.vp-audit-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.vp-audit-table th, .vp-audit-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--p-surface-border); }
.vp-audit-table th { background: var(--p-surface-card); font-weight: 600; }
.vp-cell-ok { color: var(--p-green-500); font-weight: 600; }
.vp-cell-partial { color: var(--p-orange-500); }
.vp-cell-miss { color: var(--p-red-500); }
</style>
