/**
 * Custom Quill Blot for embedding EcosystemBlock in BlockDocumentEditor
 * Issue #6986: Phase 1 — Integram таблицы, Business Entity Block и Sankey
 * Issue #6987: Phase 2 — adds loopStepsTypeId for Flywheel/CLD data
 * Issue #7085: Phase 3 — adds visibleTabs, discountRate, horizon, currency for full config persistence
 *
 * This blot creates a placeholder DOM node with data attributes.
 * The actual EcosystemBlock Vue component is mounted by BlockDocumentEditor's
 * remountEmbeddedComponents() — same pattern as FinModelBlot / TechPyramidBlot.
 */
import Quill from 'quill'

const BlockEmbed = Quill.import('blots/block/embed')

class EcosystemBlot extends BlockEmbed {
  static blotName = 'ecosys_embed'
  static tagName = 'div'
  static className = 'ecosys-embed'

  static create(value) {
    const node = super.create()
    node.setAttribute('contenteditable', 'false')

    const ecosystemId = value?.ecosystemId || ''
    const database = value?.database || 'fm'
    const server = value?.server || 'ai2o.ru'
    const businessesTypeId = value?.businessesTypeId || ''
    const flowsTypeId = value?.flowsTypeId || ''
    const feedbackTypeId = value?.feedbackTypeId || ''
    const loopStepsTypeId = value?.loopStepsTypeId || ''
    const leontiefTypeId = value?.leontiefTypeId || ''
    // Issue #7085: Add configuration parameters for complete persistence
    const visibleTabs = value?.visibleTabs || null
    const discountRate = value?.discountRate != null ? Number(value.discountRate) : 12
    const horizon = value?.horizon != null ? Number(value.horizon) : 5
    const currency = value?.currency || '$'

    node.setAttribute('data-ecosystem-id', String(ecosystemId))
    node.setAttribute('data-database', database)
    node.setAttribute('data-server', server)
    node.setAttribute('data-businesses-type-id', String(businessesTypeId))
    node.setAttribute('data-flows-type-id', String(flowsTypeId))
    node.setAttribute('data-feedback-type-id', String(feedbackTypeId))
    node.setAttribute('data-loop-steps-type-id', String(loopStepsTypeId))
    node.setAttribute('data-leontief-type-id', String(leontiefTypeId))
    // Issue #7085: Persist configuration parameters as data attributes
    if (visibleTabs) node.setAttribute('data-visible-tabs', JSON.stringify(visibleTabs))
    node.setAttribute('data-discount-rate', String(discountRate))
    node.setAttribute('data-horizon', String(horizon))
    node.setAttribute('data-currency', currency)
    node.dataset.value = JSON.stringify({
      ecosystemId, database, server,
      businessesTypeId, flowsTypeId, feedbackTypeId, loopStepsTypeId, leontiefTypeId,
      visibleTabs, discountRate, horizon, currency
    })

    node.innerHTML = `
      <div class="ecosystem-placeholder" style="height:480px;background:var(--p-surface-ground,#f9fafb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--p-text-color-secondary,#94a3b8);gap:10px;font-family:Inter,system-ui,sans-serif;font-size:13px;">
        <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;"></i>
        <span>Загрузка экосистемы бизнесов…</span>
      </div>
    `

    return node
  }

  static value(node) {
    try {
      return JSON.parse(node.dataset.value)
    } catch (e) {
      // Issue #7085: Fallback parsing includes new configuration attributes
      let visibleTabs = null
      try {
        const tabsAttr = node.getAttribute('data-visible-tabs')
        if (tabsAttr) visibleTabs = JSON.parse(tabsAttr)
      } catch (_) { /* ignore parse errors */ }

      return {
        ecosystemId: node.getAttribute('data-ecosystem-id') || '',
        database: node.getAttribute('data-database') || 'fm',
        server: node.getAttribute('data-server') || 'ai2o.ru',
        businessesTypeId: node.getAttribute('data-businesses-type-id') || '',
        flowsTypeId: node.getAttribute('data-flows-type-id') || '',
        feedbackTypeId: node.getAttribute('data-feedback-type-id') || '',
        loopStepsTypeId: node.getAttribute('data-loop-steps-type-id') || '',
        leontiefTypeId: node.getAttribute('data-leontief-type-id') || '',
        visibleTabs,
        discountRate: Number(node.getAttribute('data-discount-rate')) || 12,
        horizon: Number(node.getAttribute('data-horizon')) || 5,
        currency: node.getAttribute('data-currency') || '$'
      }
    }
  }
}

Quill.register(EcosystemBlot)

export { EcosystemBlot }
