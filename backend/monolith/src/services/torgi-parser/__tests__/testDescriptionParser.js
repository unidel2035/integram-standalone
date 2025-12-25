/**
 * Simple test runner for Description Parser (no test framework needed)
 * Run with: node src/services/torgi-parser/__tests__/testDescriptionParser.js
 */

import {
  extractCadastralNumber,
  extractArea,
  extractPermittedUse,
  extractOwnershipForm,
  extractRestrictions,
  extractVIN,
  extractYear,
  parseDescription,
  generateParsingSummary
} from '../descriptionParser.js'

// Simple test helper
let passedTests = 0
let failedTests = 0

function assertEquals(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✓ ${testName}`)
    passedTests++
  } else {
    console.log(`✗ ${testName}`)
    console.log(`  Expected: ${expected}`)
    console.log(`  Actual: ${actual}`)
    failedTests++
  }
}

function assertContains(actual, substring, testName) {
  if (actual && actual.includes(substring)) {
    console.log(`✓ ${testName}`)
    passedTests++
  } else {
    console.log(`✗ ${testName}`)
    console.log(`  Expected to contain: ${substring}`)
    console.log(`  Actual: ${actual}`)
    failedTests++
  }
}

console.log('='.repeat(70))
console.log('Testing Description Parser')
console.log('='.repeat(70))

// Test extractCadastralNumber
console.log('\n--- extractCadastralNumber ---')
assertEquals(
  extractCadastralNumber('земельный участок площадью 1168 кв. м с кадастровым номером 64:32:023644:496'),
  '64:32:023644:496',
  'Extract cadastral number with "кадастровым номером"'
)

assertEquals(
  extractCadastralNumber('Кадастровый номер 63:12:1003021:733, площадью 308 кв.м'),
  '63:12:1003021:733',
  'Extract cadastral number with "кадастровый номер"'
)

assertEquals(
  extractCadastralNumber('Земельный участок с кадастровым номером 52:48:1200021:699 площадь 3243'),
  '52:48:1200021:699',
  'Extract cadastral number from middle of text'
)

assertEquals(
  extractCadastralNumber('Автомобиль ВАЗ 2107'),
  null,
  'Return null when no cadastral number'
)

// Test extractArea
console.log('\n--- extractArea ---')
assertEquals(
  extractArea('земельный участок площадью 1168 кв. м'),
  1168,
  'Extract area with "площадью" and "кв. м"'
)

assertEquals(
  extractArea('площадь 3243 кв.м'),
  3243,
  'Extract area with "площадь" and "кв.м"'
)

assertEquals(
  extractArea('Общая площадь объекта: 14.5 кв. м'),
  14.5,
  'Extract area with decimal point'
)

assertEquals(
  extractArea('Общая площадь объекта: 14,5 кв. м'),
  14.5,
  'Extract area with comma as decimal separator'
)

assertEquals(
  extractArea('Автомобиль ВАЗ 2107'),
  null,
  'Return null when no area'
)

// Test extractPermittedUse
console.log('\n--- extractPermittedUse ---')
assertEquals(
  extractPermittedUse('разрешенное использование: ведение садоводства'),
  'ведение садоводства',
  'Extract permitted use with "разрешенное использование:"'
)

assertEquals(
  extractPermittedUse('для индивидуального жилищного строительства'),
  'индивидуального жилищного строительства',
  'Extract permitted use with "для"'
)

// Test extractVIN
console.log('\n--- extractVIN ---')
assertEquals(
  extractVIN('Автомобиль ВАЗ 21093, г/н О489РВ124, 1990 г.в., VIN XTA210930M0784689, двигатель № 0797462'),
  'XTA210930M0784689',
  'Extract VIN from vehicle description'
)

assertEquals(
  extractVIN('Автомобиль ВАЗ 2107'),
  null,
  'Return null when no VIN'
)

// Test extractYear
console.log('\n--- extractYear ---')
assertEquals(
  extractYear('Автомобиль ВАЗ 21093, 1990 г.в.'),
  1990,
  'Extract year with "г.в."'
)

assertEquals(
  extractYear('Автомобиль Лада Самара, 2010г, цвет серый'),
  2010,
  'Extract year with "г"'
)

assertEquals(
  extractYear('Характеристика объекта: год постройки – 1999'),
  1999,
  'Extract year with "год постройки"'
)

// Test parseDescription with real examples
console.log('\n--- parseDescription (integration tests) ---')

const landPlot1 = 'земельный участок площадью 1168 кв. м с кадастровым номером 64:32:023644:496, описание местоположения: муниципальное образование «Город Саратов», с. Усть-Курдюм, ул. 1-й Микрорайон'
const result1 = parseDescription(landPlot1)
assertEquals(result1.cadastralNumber, '64:32:023644:496', 'Land plot: cadastral number')
assertEquals(result1.area, 1168, 'Land plot: area')

const landPlot2 = 'Кадастровый номер 63:12:1003021:733, площадью 308 кв.м, из состава земель населенных пунктов, зона садоводства и дачного хозяйства (Ж7), разрешенное использование: ведение садоводства'
const result2 = parseDescription(landPlot2)
assertEquals(result2.cadastralNumber, '63:12:1003021:733', 'Land plot with use: cadastral number')
assertEquals(result2.area, 308, 'Land plot with use: area')
assertEquals(result2.permittedUse, 'ведение садоводства', 'Land plot with use: permitted use')

const vehicle1 = 'Автомобиль ВАЗ 21093, г/н О489РВ124, 1990 г.в., VIN XTA210930M0784689, двигатель № 0797462'
const result3 = parseDescription(vehicle1)
assertEquals(result3.vin, 'XTA210930M0784689', 'Vehicle: VIN')
assertEquals(result3.year, 1990, 'Vehicle: year')

const building1 = 'Нежилые помещения первого этажа девятиэтажного жилого здания, расположенного по адресу: Республика Башкортостан, г. Уфа, Калининский район, ул. Сельская, 8. Общая площадь объекта: 14,5 кв. м. Характеристика объекта: год постройки – 1999, износ – 0 %'
const result4 = parseDescription(building1)
assertEquals(result4.area, 14.5, 'Building: area')
assertEquals(result4.year, 1999, 'Building: year')

// Test generateParsingSummary
console.log('\n--- generateParsingSummary ---')
const summary1 = generateParsingSummary(result1)
assertContains(summary1, 'Кадастровый номер: 64:32:023644:496', 'Summary contains cadastral number')
assertContains(summary1, 'Площадь: 1168 м²', 'Summary contains area')

const summary2 = generateParsingSummary({})
assertEquals(summary2, 'Структурированные данные не найдены', 'Empty summary')

// Final results
console.log('\n' + '='.repeat(70))
console.log(`Tests completed: ${passedTests} passed, ${failedTests} failed`)
console.log('='.repeat(70))

if (failedTests > 0) {
  process.exit(1)
} else {
  console.log('✓ All tests passed!')
  process.exit(0)
}
