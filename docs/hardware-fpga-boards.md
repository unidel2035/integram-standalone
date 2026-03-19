# FPGA-платы для дронов — сравнение и где купить

## Приоритетная плата: Tang Nano 9K

| Параметр | Значение |
|----------|---------|
| **Чип** | Gowin GW1NR-9 |
| **LUT** | 8 640 (LUT4) |
| **Flip-flops** | 6 480 |
| **BSRAM** | 17 280 бит |
| **Flash** | 32 Mbit SPI |
| **Интерфейсы** | HDMI, SPI LCD, RGB LCD, USB-C |
| **RISC-V** | Встроенное ядро |
| **Размер** | ~22 × 58 мм |
| **Вес** | ~5 грамм |
| **Toolchain** | Gowin EDA (бесплатная), частично open-source (Apicula) |

## Сравнительная таблица

| Плата | Чип | LUT | Цена (USD) | Цена (₽) | Вес | Для дрона? | Где купить |
|-------|-----|-----|-----------|----------|-----|-----------|-----------|
| **Tang Nano 9K** | Gowin GW1NR-9 | 8 640 | **$12.79–13.99** | ~1 300–1 400 | 5 г | ✅ Идеально | AliExpress, robotclass.ru |
| **Tang Nano 4K** | Gowin GW1NSR-4C | 4 608 | $9–11 | ~900–1 100 | 5 г | ✅ Да | AliExpress |
| **Tang Nano 1K** | Gowin GW1NZ-1 | 1 152 | $6–8 | ~600–800 | 3 г | ⚠️ Мало ресурсов | AliExpress, robotclass.ru |
| **Tang Nano 20K** | Gowin GW2A-18 | 20 736 | $19–25 | ~1 900–2 500 | 8 г | ✅ Для сложных задач | AliExpress |
| **Lattice iCEstick** | iCE40HX1K | 1 280 | $24.99–40 | ~2 500–4 000 | 10 г | ⚠️ Дорого/мало LUT | DigiKey, Mouser |
| **Lattice iCE40UP5K** (UPduino) | iCE40UP5K | 5 280 | $15–20 | ~1 500–2 000 | 5 г | ✅ Хорош для open-source | DigiKey, Tindie |

## Где купить с доставкой в Россию

### AliExpress (лучший вариант)
- [Tang Nano 9K — $12.79](https://www.aliexpress.com/item/1005003810738020.html) — бесплатная доставка
- [Tang Nano 9K — $12.99](https://www.aliexpress.com/item/1005003810516969.html)
- [Tang Nano 9K — $13.04](https://www.aliexpress.com/item/1005004275539854.html)
- Доставка в РФ: **бесплатно** (China Post/Cainiao), 15–30 дней
- Оплата: карта МИР через AliExpress

### Российские магазины
- [RobotClass.ru — Tang Nano 9K](https://shop.robotclass.ru/item/2937) — ~1 800–2 200 ₽, доставка 2–5 дней
- [RobotClass.ru — Tang Nano 20K](https://shop.robotclass.ru/item/3512)
- [RobotClass.ru — Tang Nano 1K](https://shop.robotclass.ru/item/4047)
- [ChipDip.ru — каталог FPGA](https://www.chipdip.ru/catalog/popular/fpga) — iCE40 микросхемы (не платы)
- [icgamma.com — обзор Tang Nano](https://rostov-na-donu.icgamma.com/support/articles/kompaniya-sipeed-predlagaet-dostupnye-otladochnye-platy-tang-nano-fpga/)

### Международные (сложнее с доставкой в РФ)
- [Seeed Studio — $16.50](https://www.seeedstudio.com/Tang-Nano-9k-FPGA-board-Gowin-GW1NR-9-FPGA-8640-LUT4-6480-flip-flops-p-5381.html) — возможны ограничения доставки
- DigiKey / Mouser — iCEstick $24.99, но доставка в РФ ограничена с 2022
- eBay — $19–25, доставка через посредника

## Рекомендация

**Tang Nano 9K с AliExpress — лучший выбор:**
- $13 + бесплатная доставка = ~1 300 ₽ всё включено
- 5 грамм — влезает на любой дрон
- 8 640 LUT — достаточно для обработки сигналов, управления моторами, нейросети (BNN)
- RISC-V ядро — можно запускать код без внешнего MCU
- Open-source toolchain (Apicula) — не зависит от проприетарного софта
- USB-C — удобная прошивка

**iCEstick — НЕ рекомендуется:**
- Дороже ($25–40) при меньших ресурсах (1 280 LUT)
- Старый чип (iCE40HX1K, 2013 год)
- Сложнее купить в РФ (DigiKey/Mouser не доставляют)
- Единственный плюс: полностью open-source toolchain (icestorm/yosys)
