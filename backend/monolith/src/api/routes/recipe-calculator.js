// Recipe Calculator API Routes
// Provides dosage calculations and compatibility checks
// Issue #1146 - Recipe Management Module

import express from 'express'
import { body, validationResult } from 'express-validator'

const router = express.Router()

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

/**
 * POST /api/recipe-calculator/dosage
 * Calculate dosage for a recipe based on field area and other parameters
 */
router.post('/dosage', [
  body('recipeId').isUUID(),
  body('fieldArea').isFloat({ min: 0.01 }), // Area in hectares
  body('tankVolume').optional().isFloat({ min: 1 }), // Tank volume in liters
  body('workingWidth').optional().isFloat({ min: 0.1 }), // Working width in meters
  body('flightSpeed').optional().isFloat({ min: 0.1 }), // Flight speed in m/s
  body('applicationRate').optional().isFloat({ min: 0.1 }) // L/ha
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const {
      recipeId,
      fieldArea,
      tankVolume = 10, // Default 10L tank
      workingWidth = 4, // Default 4m
      flightSpeed = 3, // Default 3 m/s
      applicationRate = 10 // Default 10 L/ha
    } = req.body

    // Get recipe items
    const itemsResult = await db.query(`
      SELECT
        ri.id,
        ri.dosage,
        ri.unit,
        ri.order_index,
        p.id as product_id,
        p.name as product_name,
        p.form,
        p.concentration,
        p.concentration_unit
      FROM recipe_items ri
      JOIN agro_products p ON ri.product_id = p.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.order_index
    `, [recipeId])

    if (itemsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or has no products'
      })
    }

    // Calculate total area coverage per tank
    const areaPerTank = tankVolume / applicationRate

    // Calculate number of tanks needed
    const tanksNeeded = Math.ceil(fieldArea / areaPerTank)

    // Calculate flight parameters
    const swathArea = workingWidth * 1000 / 10000 // Area covered per 1000m pass in ha
    const timePerHectare = 3600 / (flightSpeed * workingWidth / 10000) // seconds per hectare
    const totalFlightTime = timePerHectare * fieldArea / 60 // minutes

    // Calculate dosages per tank and total
    const productDosages = itemsResult.rows.map(item => {
      let dosagePerHa = item.dosage

      // Convert dosage to per-hectare if needed
      if (item.unit.includes('/л') || item.unit.includes('/L')) {
        // Dosage is per liter of working solution
        dosagePerHa = item.dosage * applicationRate
      }

      const totalAmount = dosagePerHa * fieldArea
      const amountPerTank = dosagePerHa * areaPerTank

      return {
        productId: item.product_id,
        productName: item.product_name,
        form: item.form,
        concentration: item.concentration,
        concentrationUnit: item.concentration_unit,
        originalDosage: item.dosage,
        originalUnit: item.unit,
        dosagePerHa: dosagePerHa,
        totalAmount: Math.round(totalAmount * 100) / 100,
        amountPerTank: Math.round(amountPerTank * 100) / 100,
        orderIndex: item.order_index
      }
    })

    // Calculate total volume of working solution
    const totalWorkingSolution = fieldArea * applicationRate

    const result = {
      fieldArea,
      tankVolume,
      applicationRate,
      areaPerTank: Math.round(areaPerTank * 100) / 100,
      tanksNeeded,
      totalWorkingSolution: Math.round(totalWorkingSolution * 100) / 100,
      flightParameters: {
        workingWidth,
        flightSpeed,
        swathArea: Math.round(swathArea * 100) / 100,
        timePerHectare: Math.round(timePerHectare),
        totalFlightTime: Math.round(totalFlightTime),
        estimatedPasses: Math.ceil(fieldArea / swathArea)
      },
      products: productDosages,
      tankMixingInstructions: generateMixingInstructions(productDosages, tankVolume)
    }

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error calculating dosage:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to calculate dosage',
      message: error.message
    })
  }
})

/**
 * POST /api/recipe-calculator/compatibility
 * Check compatibility of products in a mix
 */
router.post('/compatibility', [
  body('productIds').isArray().notEmpty(),
  body('productIds.*').isUUID()
], validate, async (req, res) => {
  try {
    const { db } = req.app.locals
    const { productIds } = req.body

    const incompatibilities = []
    const warnings = []
    const compatible = []

    // Check each pair
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const result = await db.query(`
          SELECT
            pc.*,
            pa.name as product_a_name,
            pb.name as product_b_name
          FROM product_compatibility pc
          JOIN agro_products pa ON pc.product_a_id = pa.id
          JOIN agro_products pb ON pc.product_b_id = pb.id
          WHERE (pc.product_a_id = $1 AND pc.product_b_id = $2)
             OR (pc.product_a_id = $2 AND pc.product_b_id = $1)
        `, [productIds[i], productIds[j]])

        if (result.rows.length > 0) {
          const compat = result.rows[0]

          if (compat.compatibility === 'incompatible') {
            incompatibilities.push({
              productA: { id: productIds[i], name: compat.product_a_name },
              productB: { id: productIds[j], name: compat.product_b_name },
              notes: compat.notes,
              severity: 'error'
            })
          } else if (compat.compatibility === 'conditional') {
            warnings.push({
              productA: { id: productIds[i], name: compat.product_a_name },
              productB: { id: productIds[j], name: compat.product_b_name },
              notes: compat.notes,
              severity: 'warning'
            })
          } else {
            compatible.push({
              productA: { id: productIds[i], name: compat.product_a_name },
              productB: { id: productIds[j], name: compat.product_b_name },
              notes: compat.notes
            })
          }
        } else {
          // No compatibility data found - add warning
          const productsResult = await db.query(`
            SELECT id, name FROM agro_products WHERE id = ANY($1)
          `, [[productIds[i], productIds[j]]])

          const prodMap = {}
          productsResult.rows.forEach(p => prodMap[p.id] = p.name)

          warnings.push({
            productA: { id: productIds[i], name: prodMap[productIds[i]] },
            productB: { id: productIds[j], name: prodMap[productIds[j]] },
            notes: 'No compatibility data available. Test before use.',
            severity: 'info'
          })
        }
      }
    }

    const isCompatible = incompatibilities.length === 0
    const safeToMix = incompatibilities.length === 0 && warnings.filter(w => w.severity === 'warning').length === 0

    res.json({
      success: true,
      data: {
        isCompatible,
        safeToMix,
        incompatibilities,
        warnings,
        compatible,
        recommendations: generateCompatibilityRecommendations(incompatibilities, warnings)
      }
    })
  } catch (error) {
    console.error('Error checking compatibility:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check compatibility',
      message: error.message
    })
  }
})

/**
 * POST /api/recipe-calculator/tank-mix
 * Calculate tank mix proportions
 */
router.post('/tank-mix', [
  body('tankVolume').isFloat({ min: 1 }),
  body('products').isArray().notEmpty(),
  body('products.*.productId').isUUID(),
  body('products.*.dosage').isFloat({ min: 0 }),
  body('products.*.unit').isString()
], validate, async (req, res) => {
  try {
    const { tankVolume, products } = req.body

    const tankMix = products.map((product, index) => {
      let amount = product.dosage

      // Convert different units to volume in the tank
      if (product.unit.includes('га') || product.unit.includes('ha')) {
        // If dosage is per hectare, we need field area
        return {
          error: 'Cannot calculate tank mix without field area for per-hectare dosages',
          productId: product.productId
        }
      } else if (product.unit.includes('л') || product.unit.includes('L')) {
        // Dosage is per liter of solution
        amount = product.dosage * tankVolume
      }

      return {
        productId: product.productId,
        amount: Math.round(amount * 100) / 100,
        unit: product.unit.split('/')[0], // Get base unit (л, мл, г, etc.)
        orderIndex: index
      }
    })

    if (tankMix.some(item => item.error)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dosage units for tank mix calculation',
        details: tankMix.filter(item => item.error)
      })
    }

    res.json({
      success: true,
      data: {
        tankVolume,
        products: tankMix,
        mixingInstructions: generateMixingInstructions(tankMix, tankVolume)
      }
    })
  } catch (error) {
    console.error('Error calculating tank mix:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to calculate tank mix',
      message: error.message
    })
  }
})

/**
 * Helper function to generate mixing instructions
 */
function generateMixingInstructions(products, tankVolume) {
  const instructions = []

  instructions.push({
    step: 1,
    action: `Fill tank with ${Math.round(tankVolume * 0.5)} L of clean water (50% of tank volume)`
  })

  products.forEach((product, index) => {
    instructions.push({
      step: index + 2,
      action: `Add ${product.amountPerTank || product.amount} ${product.unit || 'units'} of ${product.productName || `Product ${index + 1}`}`,
      productId: product.productId,
      notes: 'Mix thoroughly after adding'
    })
  })

  instructions.push({
    step: products.length + 2,
    action: `Top up tank to ${tankVolume} L with clean water`
  })

  instructions.push({
    step: products.length + 3,
    action: 'Mix solution thoroughly for 2-3 minutes before application'
  })

  return instructions
}

/**
 * Helper function to generate compatibility recommendations
 */
function generateCompatibilityRecommendations(incompatibilities, warnings) {
  const recommendations = []

  if (incompatibilities.length > 0) {
    recommendations.push({
      type: 'error',
      message: `DO NOT MIX: ${incompatibilities.length} incompatible product pair(s) detected`,
      action: 'Remove incompatible products or create separate applications'
    })
  }

  if (warnings.length > 0) {
    const highWarnings = warnings.filter(w => w.severity === 'warning')
    if (highWarnings.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${highWarnings.length} product pair(s) require special attention`,
        action: 'Review mixing order and conditions carefully'
      })
    }
  }

  if (incompatibilities.length === 0 && warnings.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'All products appear compatible for mixing',
      action: 'Follow standard mixing procedures'
    })
  }

  return recommendations
}

export default router
