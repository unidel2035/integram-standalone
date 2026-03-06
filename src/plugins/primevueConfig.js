/**
 * Shared PrimeVue configuration for the application.
 *
 * This module exports the canonical PrimeVue theme configuration used by
 * the main app (main.js) and all sub-app instances created in
 * BlockDocumentEditor.vue for embedded components.
 *
 * Using a single shared config ensures consistent theming — in particular,
 * the cyan primary color palette — across every Vue app instance.
 *
 * Issue #6685: Sub-apps were initialized without a theme, which caused
 * PrimeVue to inject default (green/emerald) CSS that overrode the main
 * app's cyan theme.
 */
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * Aura preset extended with the application's cyan primary color palette.
 * Matches the colors applied via $t() in main.js.
 */
export const AuraCyan = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
      950: '#083344'
    }
  }
})

/**
 * The PrimeVue plugin options used by every app.use(PrimeVue, ...) call.
 * Import this object and spread or pass it directly to ensure all
 * Vue app instances (main app and sub-apps) share the same theme.
 */
export const primevueConfig = {
  theme: {
    preset: AuraCyan,
    options: {
      darkModeSelector: '.app-dark'
    }
  }
}
