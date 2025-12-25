/**
 * Color Contrast Checker for INTEGRAM colors
 * Verifies WCAG 2.1 AA compliance for accessibility
 */

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

// Test INTEGRAM colors
const integramColors = {
  primary: '#0062E6',
  secondary: '#33AEFF',
  white: '#FFFFFF'
};

console.log('INTEGRAM Color Scheme Accessibility Check');
console.log('==========================================\n');

console.log('Color Palette:');
console.log(`  Primary:   ${integramColors.primary}`);
console.log(`  Secondary: ${integramColors.secondary}`);
console.log();

// Test contrast ratios
const primaryVsWhite = getContrastRatio(integramColors.primary, integramColors.white);
const secondaryVsWhite = getContrastRatio(integramColors.secondary, integramColors.white);

console.log('Contrast Ratios (against white text):');
console.log(`  Primary (#0062E6):   ${primaryVsWhite.toFixed(2)}:1`);
console.log(`  Secondary (#33AEFF): ${secondaryVsWhite.toFixed(2)}:1`);
console.log();

// WCAG 2.1 AA requirements
const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;

console.log('WCAG 2.1 AA Compliance:');
console.log('  Normal text requires 4.5:1');
console.log('  Large text requires 3.0:1');
console.log();

console.log('Results:');
console.log(`  Primary (#0062E6):`);
console.log(`    Normal text: ${primaryVsWhite >= WCAG_AA_NORMAL ? '✓ PASS' : '✗ FAIL'} (${primaryVsWhite.toFixed(2)}:1)`);
console.log(`    Large text:  ${primaryVsWhite >= WCAG_AA_LARGE ? '✓ PASS' : '✗ FAIL'} (${primaryVsWhite.toFixed(2)}:1)`);
console.log();
console.log(`  Secondary (#33AEFF):`);
console.log(`    Normal text: ${secondaryVsWhite >= WCAG_AA_NORMAL ? '✓ PASS' : '✗ FAIL'} (${secondaryVsWhite.toFixed(2)}:1)`);
console.log(`    Large text:  ${secondaryVsWhite >= WCAG_AA_LARGE ? '✓ PASS' : '✗ FAIL'} (${secondaryVsWhite.toFixed(2)}:1)`);
console.log();

// Overall assessment
const allPass = primaryVsWhite >= WCAG_AA_NORMAL && secondaryVsWhite >= WCAG_AA_NORMAL;
console.log('Overall Assessment:');
console.log(allPass ? '✓ All colors meet WCAG 2.1 AA standards' : '⚠ Some colors may need adjustment for normal text');
