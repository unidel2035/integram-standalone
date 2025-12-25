/**
 * Tests for Description Parser
 */

import { describe, it, expect } from 'vitest'
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

describe('descriptionParser', () => {
  describe('extractCadastralNumber', () => {
    it('should extract cadastral number with "кадастровым номером"', () => {
      const desc = 'земельный участок площадью 1168 кв. м с кадастровым номером 64:32:023644:496'
      expect(extractCadastralNumber(desc)).toBe('64:32:023644:496')
    })

    it('should extract cadastral number with "кадастровый номер"', () => {
      const desc = 'Кадастровый номер 63:12:1003021:733, площадью 308 кв.м'
      expect(extractCadastralNumber(desc)).toBe('63:12:1003021:733')
    })

    it('should extract cadastral number from middle of text', () => {
      const desc = 'Земельный участок с кадастровым номером 52:48:1200021:699 площадь 3243'
      expect(extractCadastralNumber(desc)).toBe('52:48:1200021:699')
    })

    it('should extract cadastral number with different case', () => {
      const desc = 'с КАДАСТРОВЫМ НОМЕРОМ 18:30:000497:311'
      expect(extractCadastralNumber(desc)).toBe('18:30:000497:311')
    })

    it('should return null if no cadastral number found', () => {
      const desc = 'Автомобиль ВАЗ 2107, г/н А438СК24'
      expect(extractCadastralNumber(desc)).toBeNull()
    })

    it('should return null for empty description', () => {
      expect(extractCadastralNumber('')).toBeNull()
      expect(extractCadastralNumber(null)).toBeNull()
    })
  })

  describe('extractArea', () => {
    it('should extract area with "площадью" and "кв. м"', () => {
      const desc = 'земельный участок площадью 1168 кв. м'
      expect(extractArea(desc)).toBe(1168)
    })

    it('should extract area with "площадь" and "кв.м"', () => {
      const desc = 'площадь 3243 кв.м'
      expect(extractArea(desc)).toBe(3243)
    })

    it('should extract area with decimal point', () => {
      const desc = 'Общая площадь объекта: 14.5 кв. м'
      expect(extractArea(desc)).toBe(14.5)
    })

    it('should extract area with comma as decimal separator', () => {
      const desc = 'Общая площадь объекта: 14,5 кв. м'
      expect(extractArea(desc)).toBe(14.5)
    })

    it('should extract area with м²', () => {
      const desc = 'площадью 308 м²'
      expect(extractArea(desc)).toBe(308)
    })

    it('should extract area from longer text', () => {
      const desc = 'Нежилые помещения первого этажа девятиэтажного жилого здания, расположенного по адресу: Республика Башкортостан, г. Уфа, Калининский район, ул. Сельская, 8. Общая площадь объекта: 14,5 кв. м. Характеристика объекта: год постройки – 1999'
      expect(extractArea(desc)).toBe(14.5)
    })

    it('should return null if no area found', () => {
      const desc = 'Автомобиль ВАЗ 2107'
      expect(extractArea(desc)).toBeNull()
    })

    it('should return null for empty description', () => {
      expect(extractArea('')).toBeNull()
      expect(extractArea(null)).toBeNull()
    })
  })

  describe('extractPermittedUse', () => {
    it('should extract permitted use with "разрешенное использование:"', () => {
      const desc = 'разрешенное использование: ведение садоводства'
      expect(extractPermittedUse(desc)).toBe('ведение садоводства')
    })

    it('should extract permitted use with "для"', () => {
      const desc = 'для индивидуального жилищного строительства'
      expect(extractPermittedUse(desc)).toBe('индивидуального жилищного строительства')
    })

    it('should extract permitted use from longer text', () => {
      const desc = 'Земельный участок, с кадастровым номером 18:30:000497:311, площадью 1375 кв.м., расположенного по адресу: Удмуртская Республика, для индивидуального жилищного строительства.'
      expect(extractPermittedUse(desc)).toBe('индивидуального жилищного строительства')
    })

    it('should return null if no permitted use found', () => {
      const desc = 'Автомобиль ВАЗ 2107'
      expect(extractPermittedUse(desc)).toBeNull()
    })
  })

  describe('extractOwnershipForm', () => {
    it('should extract государственная собственность', () => {
      const desc = 'имущество государственная собственность'
      expect(extractOwnershipForm(desc)).toBe('Государственная')
    })

    it('should extract муниципальная собственность', () => {
      const desc = 'объект муниципальная собственность'
      expect(extractOwnershipForm(desc)).toBe('Муниципальная')
    })

    it('should return null if no ownership form found', () => {
      const desc = 'земельный участок площадью 1168 кв. м'
      expect(extractOwnershipForm(desc)).toBeNull()
    })
  })

  describe('extractRestrictions', () => {
    it('should extract restrictions from waterprotection zone text', () => {
      const desc = 'Земельный участок частично расположен в зоне с особыми условиями использования территории: Водоохранная зона р. Большая Сарапул.'
      const result = extractRestrictions(desc)
      expect(result).toContain('зона с особыми условиями')
    })

    it('should return null if no restrictions found', () => {
      const desc = 'земельный участок площадью 1168 кв. м'
      expect(extractRestrictions(desc)).toBeNull()
    })
  })

  describe('extractVIN', () => {
    it('should extract VIN from vehicle description', () => {
      const desc = 'Автомобиль ВАЗ 21093, г/н О489РВ124, 1990 г.в., VIN XTA210930M0784689, двигатель № 0797462'
      expect(extractVIN(desc)).toBe('XTA210930M0784689')
    })

    it('should extract VIN in lowercase and convert to uppercase', () => {
      const desc = 'VIN xta210930m0784689'
      expect(extractVIN(desc)).toBe('XTA210930M0784689')
    })

    it('should return null if no VIN found', () => {
      const desc = 'Автомобиль ВАЗ 2107, г/н А438СК24'
      expect(extractVIN(desc)).toBeNull()
    })
  })

  describe('extractYear', () => {
    it('should extract year with "г.в."', () => {
      const desc = 'Автомобиль ВАЗ 21093, 1990 г.в.'
      expect(extractYear(desc)).toBe(1990)
    })

    it('should extract year with "г"', () => {
      const desc = 'Автомобиль Лада Самара, 2010г, цвет серый'
      expect(extractYear(desc)).toBe(2010)
    })

    it('should extract year with "год постройки"', () => {
      const desc = 'Характеристика объекта: год постройки – 1999'
      expect(extractYear(desc)).toBe(1999)
    })

    it('should return null for invalid year', () => {
      const desc = 'год постройки – 1800'  // Too old
      expect(extractYear(desc)).toBeNull()
    })

    it('should return null if no year found', () => {
      const desc = 'земельный участок площадью 1168 кв. м'
      expect(extractYear(desc)).toBeNull()
    })
  })

  describe('parseDescription', () => {
    it('should parse land plot description with all fields', () => {
      const desc = 'земельный участок площадью 1168 кв. м с кадастровым номером 64:32:023644:496, описание местоположения: муниципальное образование «Город Саратов», с. Усть-Курдюм, ул. 1-й Микрорайон'
      const result = parseDescription(desc)

      expect(result.cadastralNumber).toBe('64:32:023644:496')
      expect(result.area).toBe(1168)
    })

    it('should parse land plot with permitted use', () => {
      const desc = 'Кадастровый номер 63:12:1003021:733, площадью 308 кв.м, из состава земель населенных пунктов, зона садоводства и дачного хозяйства (Ж7), расположенного по адресу: Самарская область, Безенчукский район, разрешенное использование: ведение садоводства'
      const result = parseDescription(desc)

      expect(result.cadastralNumber).toBe('63:12:1003021:733')
      expect(result.area).toBe(308)
      expect(result.permittedUse).toBe('ведение садоводства')
    })

    it('should parse vehicle description', () => {
      const desc = 'Автомобиль ВАЗ 21093, г/н О489РВ124, 1990 г.в., VIN XTA210930M0784689, двигатель № 0797462, состояние и комплектность не проверялась'
      const result = parseDescription(desc)

      expect(result.vin).toBe('XTA210930M0784689')
      expect(result.year).toBe(1990)
    })

    it('should parse building description', () => {
      const desc = 'Нежилые помещения первого этажа девятиэтажного жилого здания, расположенного по адресу: Республика Башкортостан, г. Уфа, Калининский район, ул. Сельская, 8. Общая площадь объекта: 14,5 кв. м. Характеристика объекта: год постройки – 1999, износ – 0 %, высота помещений – 2,50 м'
      const result = parseDescription(desc)

      expect(result.area).toBe(14.5)
      expect(result.year).toBe(1999)
    })

    it('should parse land plot with restrictions', () => {
      const desc = 'Земельный участок, с кадастровым номером 18:30:000497:311, площадью 1375 кв.м., расположенного по адресу: Удмуртская Республика, для индивидуального жилищного строительства. Земельный участок частично расположен в зоне с особыми условиями использования территории: Водоохранная зона р. Большая Сарапул.'
      const result = parseDescription(desc)

      expect(result.cadastralNumber).toBe('18:30:000497:311')
      expect(result.area).toBe(1375)
      expect(result.permittedUse).toBe('индивидуального жилищного строительства')
      expect(result.restrictions).toContain('зона с особыми условиями')
    })

    it('should return empty object for empty description', () => {
      const result = parseDescription('')
      expect(result).toEqual({})
    })

    it('should return empty object for null description', () => {
      const result = parseDescription(null)
      expect(result).toEqual({})
    })

    it('should return empty object for description with no parseable data', () => {
      const desc = 'Some generic text without structured data'
      const result = parseDescription(desc)
      expect(result).toEqual({})
    })
  })

  describe('generateParsingSummary', () => {
    it('should generate summary for land plot', () => {
      const parsed = {
        cadastralNumber: '64:32:023644:496',
        area: 1168
      }
      const summary = generateParsingSummary(parsed)

      expect(summary).toContain('Кадастровый номер: 64:32:023644:496')
      expect(summary).toContain('Площадь: 1168 м²')
    })

    it('should generate summary for vehicle', () => {
      const parsed = {
        vin: 'XTA210930M0784689',
        year: 1990
      }
      const summary = generateParsingSummary(parsed)

      expect(summary).toContain('VIN: XTA210930M0784689')
      expect(summary).toContain('Год: 1990')
    })

    it('should return "not found" message for empty data', () => {
      const summary = generateParsingSummary({})
      expect(summary).toBe('Структурированные данные не найдены')
    })
  })
})
