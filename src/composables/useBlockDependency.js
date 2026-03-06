/**
 * useBlockDependency — composable для интеграции блоков с BlockDependencyStore
 *
 * Автоматически регистрирует/дерегистрирует блок при mount/unmount,
 * подписывается на каскадные обновления через integramEventBus.
 *
 * Issue #7157: Реактивные связанные блоки
 *
 * @example
 * // В FinModelBlock.vue:
 * const { outputs, updateOutput, onInputChanged } = useBlockDependency({
 *   blockId: 'fin-model-123',
 *   name: 'P&L',
 *   type: 'finmodel',
 *   outputs: { 'Revenue.2025': 12000 }
 * })
 *
 * // Обновить значение → каскад:
 * updateOutput('Revenue.2025', 15000)
 *
 * // Подписаться на входящие данные:
 * onInputChanged((inputs) => {
 *   console.log('Получены данные:', inputs)
 * })
 *
 * @module composables/useBlockDependency
 */

import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import {
  blockDepState,
  registerBlock,
  unregisterBlock,
  updateBlockOutputs,
  getBlockValue,
  propagate
} from '@/stores/blockDependencyStore'
import { integramEventBus } from '@/services/integramEventBus'

/**
 * @typedef {Object} BlockDependencyOptions
 * @property {string} blockId - Уникальный ID блока
 * @property {string} name - Человеческое имя блока
 * @property {string} type - Тип блока: 'finmodel' | 'osint' | 'ontology' | 'table' | 'selector'
 * @property {Object} [outputs] - Начальные экспортируемые значения
 * @property {Object} [meta] - Произвольные метаданные
 */

/**
 * @param {BlockDependencyOptions} options
 */
export function useBlockDependency(options) {
  const { blockId, name, type, outputs: initialOutputs = {}, meta = {} } = options

  const localOutputs = ref({ ...initialOutputs })
  const inputValues = ref({})
  const inputCallbacks = []

  // Computed: текущий блок из module state
  const block = computed(() => {
    void blockDepState.version // reactivity trigger
    return blockDepState.blocks.get(blockId) || null
  })

  // Computed: входящие значения (из __inputs)
  const inputs = computed(() => {
    void blockDepState.version
    const b = blockDepState.blocks.get(blockId)
    return b?.outputs?.__inputs || {}
  })

  /**
   * Обновить один output и запустить каскад
   */
  function updateOutput(path, value) {
    localOutputs.value[path] = value
    updateBlockOutputs(blockId, { [path]: value })

    // Каскадное обновление downstream-блоков
    const updated = propagate(blockId)

    // Уведомить через EventBus
    if (updated.length > 0) {
      integramEventBus.emit('block:cascade', {
        source: blockId,
        updated,
        path,
        value
      })
    }
  }

  /**
   * Обновить несколько outputs за раз
   */
  function updateOutputs(outputs) {
    Object.assign(localOutputs.value, outputs)
    updateBlockOutputs(blockId, outputs)
    const updated = propagate(blockId)

    if (updated.length > 0) {
      integramEventBus.emit('block:cascade', {
        source: blockId,
        updated,
        outputs
      })
    }
  }

  /**
   * Получить значение из другого блока
   */
  function getValueFrom(targetBlockId, path) {
    return getBlockValue(targetBlockId, path)
  }

  /**
   * Подписаться на изменения входных данных
   */
  function onInputChanged(callback) {
    inputCallbacks.push(callback)
  }

  // Обработчик каскадных обновлений
  function handleCascade(payload) {
    if (payload.updated && payload.updated.includes(blockId)) {
      const b = blockDepState.blocks.get(blockId)
      const newInputs = b?.outputs?.__inputs || {}
      inputValues.value = { ...newInputs }

      for (const cb of inputCallbacks) {
        try {
          cb(newInputs)
        } catch (e) {
          console.error(`[useBlockDependency] Callback error in ${blockId}:`, e)
        }
      }
    }
  }

  // Lifecycle
  onMounted(() => {
    registerBlock(blockId, name, type, localOutputs.value, meta)
    integramEventBus.on('block:cascade', handleCascade)
  })

  onUnmounted(() => {
    integramEventBus.off('block:cascade', handleCascade)
    unregisterBlock(blockId)
  })

  return {
    block,
    outputs: localOutputs,
    inputs,
    inputValues,
    updateOutput,
    updateOutputs,
    getValueFrom,
    onInputChanged
  }
}
