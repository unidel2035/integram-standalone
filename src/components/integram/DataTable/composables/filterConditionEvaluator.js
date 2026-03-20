/**
 * Evaluate a filter condition string against a directory item.
 * Supports expressions like:
 *   [fieldId] = 'value'          — compare by requisite value or ref.val
 *   [fieldId] <> 'value'         — not equal
 *   [cur.termId] references      — replaced with value from currentRow
 *   AND / OR logic
 *
 * Exported as a standalone utility so both useDirectoryCache and useCellEditing can use it.
 */
export function evaluateFilterCondition(item, condition, currentRow) {
  if (!condition || !condition.trim()) return true

  let evaluatedCondition = condition

  // 1. Replace [cur.reqId] with value from current row
  const curMatches = condition.matchAll(/\[cur\.(\w+)\]/g)
  for (const match of curMatches) {
    const reqId = match[1]
    const value = currentRow?.cells?.[`req_${reqId}`]?.value ?? ''
    evaluatedCondition = evaluatedCondition.replace(match[0], `'${String(value).replace(/'/g, "\\'")}'`)
  }

  // 2. Replace [fieldRef] with item field values
  const fieldMatches = [...evaluatedCondition.matchAll(/\[([^\]]+)\]/g)]
  for (const match of fieldMatches) {
    const fieldRef = match[1]
    let fieldValue = ''

    if (/^\d+$/.test(fieldRef)) {
      // Numeric ID → look up item.reqs[id]
      const reqId = fieldRef
      if (item.reqs && item.reqs[reqId]) {
        const req = item.reqs[reqId]
        if (req && typeof req === 'object') {
          if (req.ref && typeof req.ref === 'object') {
            // Reference field (nested object): compare by display name (.val)
            fieldValue = req.ref?.val ?? String(req.ref?.id ?? '') ?? req.value ?? ''
          } else if (req.ref && typeof req.ref === 'string') {
            // Reference field (flat string): req.ref IS the display name
            // edit_obj format: { value: "877530", ref: "Опубликован", ref_type: "877527" }
            fieldValue = req.ref
          } else {
            fieldValue = req.value ?? ''
          }
        } else {
          fieldValue = req ?? ''
        }
      }
    } else if (fieldRef.toLowerCase() === 'val') {
      fieldValue = item.value ?? ''
    } else if (item.fields && item.fields[fieldRef]) {
      fieldValue = item.fields[fieldRef]
    }

    evaluatedCondition = evaluatedCondition.replace(match[0], `'${String(fieldValue).replace(/'/g, "\\'")}'`)
  }

  // 3. Replace logical and comparison operators
  evaluatedCondition = evaluatedCondition.replace(/\s+AND\s+/gi, ' && ')
  evaluatedCondition = evaluatedCondition.replace(/\s+OR\s+/gi, ' || ')
  evaluatedCondition = evaluatedCondition.replace(/<>/g, '!==')
  evaluatedCondition = evaluatedCondition.replace(/!=/g, '!==')
  evaluatedCondition = evaluatedCondition.replace(/(?<![=!<>])=(?!=)/g, '===')

  // 4. Evaluate using Function constructor (safer than eval, no access to local scope)
  try {
    // Function constructor creates a function in global scope, avoiding local scope access
    // This is safer than eval as it cannot access local variables
    const fn = new Function(`return (${evaluatedCondition})`)
    return fn()
  } catch (err) {
    console.warn('[evaluateFilterCondition] Evaluation error:', err, 'condition:', evaluatedCondition)
    return true
  }
}
