/**
 * Quiz Questions Database
 * Questions organized by module/route for the interactive mini-quiz system
 */

export const QUIZ_DATA = {
  'fst-committee': {
    title: 'AI-инвесткомитет',
    questions: [
      {
        id: 'committee-q1',
        question: 'Сколько AI-агентов участвует в инвесткомитете ФСТ НТИ?',
        type: 'multiple-choice',
        options: ['4 агента', '6 агентов', '8 агентов', '10 агентов'],
        correctAnswer: 1,
        explanation: 'В инвесткомитете ФСТ НТИ участвуют 6 AI-агентов: Финансовый аналитик, Технический эксперт, Рыночный аналитик, Юридический советник, Эксперт по рискам и Стратег.'
      },
      {
        id: 'committee-q2',
        question: 'Что происходит, если 4 из 6 агентов голосуют "против" сделки?',
        type: 'multiple-choice',
        options: [
          'Сделка автоматически отклоняется',
          'Требуется голосование совета директоров',
          'Сделка отправляется на повторное рассмотрение',
          'Решение принимает управляющий директор'
        ],
        correctAnswer: 0,
        explanation: 'Если большинство агентов (4 из 6) голосуют против, сделка автоматически отклоняется. Для одобрения требуется положительное решение как минимум 4 агентов.'
      },
      {
        id: 'committee-q3',
        question: 'Какой агент отвечает за оценку технологической зрелости продукта?',
        type: 'multiple-choice',
        options: [
          'Финансовый аналитик',
          'Технический эксперт',
          'Рыночный аналитик',
          'Стратег'
        ],
        correctAnswer: 1,
        explanation: 'Технический эксперт оценивает технологическую зрелость, архитектуру продукта, патентную защиту и технические риски проекта.'
      },
      {
        id: 'committee-q4',
        question: 'AI-инвесткомитет полностью заменяет человеческое принятие решений в фонде',
        type: 'true-false',
        correctAnswer: false,
        explanation: 'AI-инвесткомитет является вспомогательным инструментом для анализа, но финальное решение всегда остаётся за людьми — управляющими партнёрами фонда.'
      },
      {
        id: 'committee-q5',
        question: 'Какой показатель НЕ анализируется Финансовым аналитиком?',
        type: 'multiple-choice',
        options: [
          'Unit-экономика',
          'Патентная защита',
          'Burn rate',
          'IRR прогноз'
        ],
        correctAnswer: 1,
        explanation: 'Патентная защита анализируется Техническим экспертом. Финансовый аналитик фокусируется на финансовых метриках: unit-экономике, burn rate, IRR, оценке и структуре капитала.'
      },
      {
        id: 'committee-q6',
        question: 'На основе чего AI-агенты "обучаются" принимать решения?',
        type: 'multiple-choice',
        options: [
          'Случайные данные из интернета',
          'Исторические данные о сделках фонда и их результаты',
          'Мнения внешних экспертов',
          'Только финансовые модели'
        ],
        correctAnswer: 1,
        explanation: 'AI-агенты обучаются на исторических данных фонда: прошлых сделках, их фактических результатах (exit, IRR, рост), что позволяет им предсказывать успешность новых проектов.'
      },
      {
        id: 'committee-q7',
        question: 'Какую роль играет Эксперт по рискам в инвесткомитете?',
        type: 'multiple-choice',
        options: [
          'Анализирует только финансовые риски',
          'Оценивает все категории рисков: технические, рыночные, команды, регуляторные',
          'Принимает финальное решение об инвестиции',
          'Проводит юридическую проверку'
        ],
        correctAnswer: 1,
        explanation: 'Эксперт по рискам проводит комплексный анализ всех категорий рисков проекта: технологических, рыночных, связанных с командой, конкурентных и регуляторных.'
      },
      {
        id: 'committee-q8',
        question: 'Заполните пропуск: "Решение инвесткомитета считается положительным, если за проект проголосовало минимум ___ агентов из 6"',
        type: 'fill-blank',
        correctAnswer: ['4', 'четыре', '4 агента', 'четыре агента'],
        explanation: 'Для одобрения сделки требуется большинство — минимум 4 голоса "за" из 6 агентов.'
      },
      {
        id: 'committee-q9',
        question: 'Каждый агент имеет равный вес при голосовании в инвесткомитете',
        type: 'true-false',
        correctAnswer: false,
        explanation: 'Агенты могут иметь разные веса в зависимости от стадии фонда и стратегии. Например, на ранних стадиях вес Технического эксперта может быть выше, а на поздних — Финансового аналитика. Веса калибруются на основе исторических данных.'
      },
      {
        id: 'committee-q10',
        question: 'Какая основная цель внедрения AI-инвесткомитета?',
        type: 'multiple-choice',
        options: [
          'Полная автоматизация инвестиций без участия людей',
          'Повышение скорости и качества анализа сделок, снижение субъективности',
          'Замена всех аналитиков фонда',
          'Только экономия затрат на персонал'
        ],
        correctAnswer: 1,
        explanation: 'AI-инвесткомитет создан для повышения качества и скорости анализа, снижения субъективности и human bias, но не для замены людей. Финальные решения остаются за управляющими партнёрами.'
      }
    ]
  },

  'fst-deal': {
    title: 'Структура сделки',
    questions: [
      {
        id: 'deal-q1',
        question: 'Что такое SPV в контексте венчурных инвестиций?',
        type: 'multiple-choice',
        options: [
          'Special Purpose Vehicle — отдельная компания для конкретной сделки',
          'Standard Portfolio Value — стандартная оценка портфеля',
          'Strategic Partnership Venture — стратегическое партнёрство',
          'Secured Preference Value — обеспеченная привилегированная стоимость'
        ],
        correctAnswer: 0,
        explanation: 'SPV (Special Purpose Vehicle) — это отдельная юридическая структура, созданная специально для конкретной инвестиции. Позволяет изолировать риски и привлекать со-инвесторов.'
      },
      {
        id: 'deal-q2',
        question: 'Заполните пропуск: "Term Sheet — это ___ документ, описывающий ключевые условия инвестиции"',
        type: 'fill-blank',
        correctAnswer: ['необязывающий', 'не обязывающий', 'необязательный'],
        explanation: 'Term Sheet — это необязывающий (non-binding) документ, который описывает основные условия сделки до подписания финальных договоров.'
      },
      {
        id: 'deal-q3',
        question: 'Что означает термин "post-money valuation"?',
        type: 'multiple-choice',
        options: [
          'Оценка компании после выхода из инвестиции',
          'Оценка компании ПОСЛЕ получения инвестиции',
          'Оценка компании ДО получения инвестиции',
          'Оценка компании через год после инвестиции'
        ],
        correctAnswer: 1,
        explanation: 'Post-money valuation — это оценка компании ПОСЛЕ инвестиции (включая сумму инвестиции). Pre-money valuation — оценка ДО инвестиции.'
      },
      {
        id: 'deal-q4',
        question: 'Ликвидационная префе��енция (liquidation preference) всегда составляет 1x от инвестиции',
        type: 'true-false',
        correctAnswer: false,
        explanation: 'Ликвидационная преференция может быть разной: 1x (стандарт), 2x, 3x или даже выше в зависимости от переговоров. При 2x инвестор получает свои деньги обратно в двойном размере перед другими акционерами при выходе.'
      },
      {
        id: 'deal-q5',
        question: 'Какой документ является финальным юридически обязывающим договором инвестиции?',
        type: 'multiple-choice',
        options: [
          'Term Sheet',
          'Letter of Intent (LOI)',
          'Share Purchase Agreement (SPA) / SHA',
          'Pitch Deck'
        ],
        correctAnswer: 2,
        explanation: 'Share Purchase Agreement (SPA) или Shareholders Agreement (SHA) — это финальные юридически обязывающие документы, которые закрепляют условия инвестиции.'
      },
      {
        id: 'deal-q6',
        question: 'Что такое "vesting" для основателей?',
        type: 'multiple-choice',
        options: [
          'Механизм постепенного "заработка" акций основателями со временем',
          'Тип инвестиционного инструмента',
          'Налоговая льгота для стартапов',
          'Процедура выхода инвестора'
        ],
        correctAnswer: 0,
        explanation: 'Vesting — механизм, при котором основатели "зарабатывают" свои акции постепенно (обычно 4 года с 1-летним cliff). Защищает инвесторов от ухода ключевых людей.'
      },
      {
        id: 'deal-q7',
        question: 'Anti-dilution protection защищает инвесторов от размывания доли при down-round',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Anti-dilution (обычно weighted average или full ratchet) защищает ранних инвесторов, если компания привлекает следующий раунд по более низкой оценке (down-round).'
      },
      {
        id: 'deal-q8',
        question: 'Сколько обычно длится процесс от подписания Term Sheet до финального закрытия сделки?',
        type: 'multiple-choice',
        options: [
          '1-2 недели',
          '1-3 месяца',
          '6-12 месяцев',
          '1-2 года'
        ],
        correctAnswer: 1,
        explanation: 'От Term Sheet до закрытия обычно проходит 1-3 месяца. Это время на due diligence, подготовку документов, юридическую проверку и согласования.'
      },
      {
        id: 'deal-q9',
        question: 'Что такое "drag-along rights"?',
        type: 'multiple-choice',
        options: [
          'Право мажоритарных акционеров обязать миноритариев продать долю при выходе',
          'Право первого отказа при продаже акций',
          'Право на участие в совете директоров',
          'Право veto на стратегические решения'
        ],
        correctAnswer: 0,
        explanation: 'Drag-along rights позволяют мажоритарным акционерам "потянуть" миноритариев при продаже компании, чтобы обеспечить 100% выход.'
      },
      {
        id: 'deal-q10',
        question: 'Заполните пропуск: "Investor rights обычно включают право на информацию, право на участие в следующих раундах (___) и право представительства в совете"',
        type: 'fill-blank',
        correctAnswer: ['pro-rata', 'pro rata', 'prorata', 'про-рата'],
        explanation: 'Pro-rata right — право инвестора участвовать в следующих раундах пропорционально своей текущей доле, чтобы избежать размывания.'
      }
    ]
  },

  'fst-portfolio': {
    title: 'Мониторинг портфеля',
    questions: [
      {
        id: 'portfolio-q1',
        question: 'Что означает "красный свет" в системе мониторинга портфеля?',
        type: 'multiple-choice',
        options: [
          'Компания показывает быстрый рост',
          'Критические проблемы, требующие немедленного вмешательства',
          'Компания готова к выходу',
          'Средний уровень риска'
        ],
        correctAnswer: 1,
        explanation: 'Система "светофора" использует красный цвет для индикации критических проблем: падение выручки, критический burn rate, уход ключевых людей, требующие немедленных действий фонда.'
      },
      {
        id: 'portfolio-q2',
        question: 'Какая метрика НЕ является ключевой для мониторинга портфельной компании?',
        type: 'multiple-choice',
        options: [
          'MRR/ARR (месячная/годовая выручка)',
          'Burn rate',
          'Курс доллара',
          'Customer Acquisition Cost (CAC)'
        ],
        correctAnswer: 2,
        explanation: 'Курс доллара — внешний фактор, не специфичный для компании. Ключевые метрики: MRR/ARR, burn rate, runway, CAC, LTV, churn rate, unit-экономика.'
      },
      {
        id: 'portfolio-q3',
        question: 'Runway показывает, на сколько месяцев хватит денег компании при текущем burn rate',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Runway = Cash / Burn Rate. Например, при $100k в банке и burn rate $20k/месяц, runway = 5 месяцев. Критический порог обычно 6 месяцев.'
      },
      {
        id: 'portfolio-q4',
        question: 'Заполните пропуск: "Отчёты портфельных компаний обычно предоставляются фонду ___ раз в месяц/квартал"',
        type: 'fill-blank',
        correctAnswer: ['ежемесячно', '1', 'раз в месяц', 'каждый месяц', 'monthly'],
        explanation: 'Стандартная практика — ежемесячные отчёты от портфельных компаний. Некоторые фонды требуют еженедельные update на ранних стадиях.'
      },
      {
        id: 'portfolio-q5',
        question: 'Что такое "датчик" (sensor) в контексте мониторинга портфеля?',
        type: 'multiple-choice',
        options: [
          'Физическое устройство в офисе компании',
          'Автоматический индикатор отклонения ключевых метрик от плановых значений',
          'Человек, ответственный за мониторинг',
          'Тип финансового отчёта'
        ],
        correctAnswer: 1,
        explanation: 'Датчик (sensor) — это автоматизированный механизм, который отслеживает метрики и сигнализирует об отклонениях от плана (например, burn rate выше плана на 30%).'
      },
      {
        id: 'portfolio-q6',
        question: 'Фонд должен проводить Board Meeting с каждой портфельной компанией как минимум раз в квартал',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Стандартная практика — Board Meetings минимум раз в квартал, но многие фонды проводят их ежемесячно для более плотного контроля.'
      },
      {
        id: 'portfolio-q7',
        question: 'Какой показатель критически важен для SaaS-компаний?',
        type: 'multiple-choice',
        options: [
          'Количество офисов',
          'Churn Rate (отток клиентов)',
          'Количество сотрудников',
          'Размер офиса'
        ],
        correctAnswer: 1,
        explanation: 'Для SaaS-компаний churn rate (отток клиентов) критичен. Высокий churn (>5-7% в месяц) указывает на проблемы с product-market fit.'
      },
      {
        id: 'portfolio-q8',
        question: 'Что означает "follow-on investment"?',
        type: 'multiple-choice',
        options: [
          'Первая инвестиция в компанию',
          'Дополнительная инвестиция в уже существующую портфельную компанию',
          'Инвестиция в конкурента',
          'Продажа доли другому фонду'
        ],
        correctAnswer: 1,
        explanation: 'Follow-on investment — это дополнительная инвестиция фонда в компанию, в которую он уже инвестировал ранее. Обычно происходит в следующих раундах при достижении milestone.'
      },
      {
        id: 'portfolio-q9',
        question: 'LTV должен быть минимум в ___ раз больше CAC для здоровой unit-экономики',
        type: 'fill-blank',
        correctAnswer: ['3', 'три', '3x', 'три раза'],
        explanation: 'Правило 3:1 — LTV (Lifetime Value) должен быть минимум в 3 раза больше CAC (Customer Acquisition Cost) для устойчивой бизнес-модели.'
      },
      {
        id: 'portfolio-q10',
        question: 'Какое действие фонда является наиболее радикальным при "красном свете"?',
        type: 'multiple-choice',
        options: [
          'Запрос дополнительного отчёта',
          'Написание письма основателям',
          'Bridge-financing или down-round',
          'Увеличение частоты Board Meetings'
        ],
        correctAnswer: 2,
        explanation: 'При критической ситуации фонд может предоставить bridge-financing (промежуточное финансирование) или согласиться на down-round для спасения компании.'
      }
    ]
  },

  'fst-waterfall': {
    title: 'Waterfall & Carried Interest',
    questions: [
      {
        id: 'waterfall-q1',
        question: 'Заполните пропуск: "Carried interest обычно составляет ___% от прибыли фонда"',
        type: 'fill-blank',
        correctAnswer: ['20', 'двадцать', '20%'],
        explanation: 'Стандартная ставка carried interest (carry) — 20% от прибыли фонда. Это вознаграждение управляющих партнёров (GP) за успешное управление.'
      },
      {
        id: 'waterfall-q2',
        question: 'Что такое "hurdle rate" в контексте waterfall?',
        type: 'multiple-choice',
        options: [
          'Минимальная доходность, которую должны получить LP перед распределением carry GP',
          'Максимальная ставка carry',
          'Процент от фонда, который можно инвестировать в одну компанию',
          'Ставка управленческого fee'
        ],
        correctAnswer: 0,
        explanation: 'Hurdle rate (обычно 8% годовых) — это минимальная доходность для LP до того, как GP начнёт получать carried interest.'
      },
      {
        id: 'waterfall-q3',
        question: 'LP всегда получают 100% возврата капитала до того, как GP получит carried interest',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'В стандартной европейской модели waterfall сначала LP получают 100% возврата капитала, затем hurdle rate, и только потом начинается распределение carry.'
      },
      {
        id: 'waterfall-q4',
        question: 'Что означает "European waterfall" в отличие от "American waterfall"?',
        type: 'multiple-choice',
        options: [
          'Carry начисляется только после всех exit в фонде (European) vs после каждого exit (American)',
          'Разные ставки carry: 20% (European) vs 30% (American)',
          'Разная юрисдикция регистрации фонда',
          'Разные инвестиционные стратегии'
        ],
        correctAnswer: 0,
        explanation: 'European waterfall: carry считается от всего фонда после всех exit. American (deal-by-deal): carry начисляется после каждой успешной сделки. European выгоднее LP.'
      },
      {
        id: 'waterfall-q5',
        question: 'Заполните пропуск: "Management fee обычно составляет ___% годовых от committed capital"',
        type: 'fill-blank',
        correctAnswer: ['2', 'два', '2%', 'два процента'],
        explanation: 'Стандартный management fee — 2% годовых от committed capital. Это покрывает операционные расходы фонда: зарплаты, офис, due diligence.'
      },
      {
        id: 'waterfall-q6',
        question: 'Что такое "clawback provision"?',
        type: 'multiple-choice',
        options: [
          'Механизм возврата излишне выплаченного carry GP обратно в фонд',
          'Право LP забрать свои деньги досрочно',
          'Штраф за невыполнение целей фонда',
          'Дополнительный бонус для LP'
        ],
        correctAnswer: 0,
        explanation: 'Clawback — защита LP: если в конце жизни фонда GP получили слишком много carry (из-за deal-by-deal waterfall), они обязаны вернуть излишек.'
      },
      {
        id: 'waterfall-q7',
        question: 'Catch-up clause позволяет GP быстрее получить свою долю carry после достижения hurdle',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Catch-up (обычно 80/20) после hurdle позволяет GP получать больший процент до тех пор, пока не "догонит" свою целевую 20% долю от прибыли выше hurdle.'
      },
      {
        id: 'waterfall-q8',
        question: 'Какая модель waterfall более выгодна для LP?',
        type: 'multiple-choice',
        options: [
          'American waterfall (deal-by-deal)',
          'European waterfall (whole fund)',
          'Обе одинаково выгодны',
          'Зависит от валюты фонда'
        ],
        correctAnswer: 1,
        explanation: 'European waterfall выгоднее LP, так как carry GP начисляется только после успешного закрытия всего фонда, а не после отдельных сделок.'
      },
      {
        id: 'waterfall-q9',
        question: 'Что происходит с невостребованным committed capital к концу инвестиционного периода?',
        type: 'multiple-choice',
        options: [
          'Автоматически инвестируется',
          'Возвращается LP',
          'Переходит в управление GP',
          'Теряется'
        ],
        correctAnswer: 1,
        explanation: 'После окончания инвестиционного периода (обычно 5 лет) невостребованный capital возвращается LP или реинвестируется только с их согласия.'
      },
      {
        id: 'waterfall-q10',
        question: 'При IRR 25% годовых и hurdle rate 8%, LP получают hurdle только на 8%, а остальное распределяется 80/20',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Правильно: LP получают 100% возврата капитала, затем 8% hurdle, а прибыль выше hurdle (25% - 8% = 17%) распределяется 80% LP / 20% GP (с учётом catch-up).'
      }
    ]
  },

  'fst-ilpa': {
    title: 'ILPA стандарты',
    questions: [
      {
        id: 'ilpa-q1',
        question: 'Что означает аббревиатура ILPA?',
        type: 'multiple-choice',
        options: [
          'International Limited Partners Association',
          'Institutional Limited Partners Association',
          'Investment Liquidity Partners Alliance',
          'International Legal Partners Association'
        ],
        correctAnswer: 1,
        explanation: 'ILPA — Institutional Limited Partners Association, глобальная ассоциация институциональных LP, которая разработала стандарты прозрачности и отчётности для венчурных фондов.'
      },
      {
        id: 'ilpa-q2',
        question: 'Как часто фонд должен предоставлять LP-отчёты согласно ILPA?',
        type: 'multiple-choice',
        options: [
          'Ежемесячно',
          'Ежеквартально',
          'Раз в полгода',
          'Ежегодно'
        ],
        correctAnswer: 1,
        explanation: 'ILPA рекомендует ежеквартальную отчётность LP с основными метриками: NAV, IRR, TVPI, DPI, RVPI, cash flows, портфельные обновления.'
      },
      {
        id: 'ilpa-q3',
        question: 'Заполните пропуск: "TVPI показывает отношение ___ к invested capital"',
        type: 'fill-blank',
        correctAnswer: ['total value', 'общей стоимости', 'тотал велью'],
        explanation: 'TVPI (Total Value to Paid-In) = (Distributions + NAV) / Invested Capital. Показывает совокупную стоимость возвратов относительно вложенного капитала.'
      },
      {
        id: 'ilpa-q4',
        question: 'ILPA требует раскрытия всех конфликтов интересов GP',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'ILPA Principles требуют полного раскрытия конфликтов интересов, включая со-инвестиции GP, кросс-фондовые сделки, и связанные транзакции.'
      },
      {
        id: 'ilpa-q5',
        question: 'Что такое "Key Person Clause" в контексте ILPA?',
        type: 'multiple-choice',
        options: [
          'Особые условия для крупных LP',
          'Защита LP при уходе ключевых управляющих партнёров фонда',
          'Клаузула о страховании ключевых сотрудников',
          'Требование к количеству партнёров в фонде'
        ],
        correctAnswer: 1,
        explanation: 'Key Person Clause — если ключевые GP уходят, фонд приостанавливает новые инвестиции до решения LP. Защищает LP от смены команды.'
      },
      {
        id: 'ilpa-q6',
        question: 'DPI (Distributions to Paid-In) показывает только денежные выплаты LP, без учёта NAV',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'DPI = Total Distributions / Invested Capital. Показывает реальные денежные возвраты, в отличие от TVPI, который включает нереализованную стоимость (NAV).'
      },
      {
        id: 'ilpa-q7',
        question: 'Какая информация НЕ требуется в LP-отчёте по ILPA?',
        type: 'multiple-choice',
        options: [
          'NAV фонда',
          'Список всех сделок с оценкой',
          'Личные данные основателей портфельных компаний',
          'Cash flow statement'
        ],
        correctAnswer: 2,
        explanation: 'Личные данные основателей не требуются. ILPA требует: NAV, IRR, TVPI/DPI/RVPI, cash flows, обзор портфеля, расходы фонда, конфликты интересов.'
      },
      {
        id: 'ilpa-q8',
        question: 'Заполните пропуск: "RVPI = ___  / Invested Capital"',
        type: 'fill-blank',
        correctAnswer: ['NAV', 'nav', 'Net Asset Value', 'нав'],
        explanation: 'RVPI (Residual Value to Paid-In) = NAV / Invested Capital. Показывает нереализованную стоимость портфеля относительно вложенного капитала.'
      },
      {
        id: 'ilpa-q9',
        question: 'ILPA рекомендует LP проводить регулярные Advisory Committee meetings для контроля фонда',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'ILPA рекомендует создание Advisory Committee из представителей крупных LP для контроля над конфликтами интересов, оценкой портфеля и стратегическими решениями.'
      },
      {
        id: 'ilpa-q10',
        question: 'Что является одним из ключевых принципов ILPA для защиты интересов LP?',
        type: 'multiple-choice',
        options: [
          'Увеличение management fee до 5%',
          'Прозрачность fee and carry структуры',
          'Отмена отчётности для успешных фондов',
          'Секретность инвестиционной стратегии'
        ],
        correctAnswer: 1,
        explanation: 'Ключевой принцип ILPA — полная прозрачность fee and carry структуры, включая все скрытые комиссии, monitoring fees, transaction fees и их распределение.'
      }
    ]
  },

  'fst-hub': {
    title: 'Обзор VentureOS',
    questions: [
      {
        id: 'hub-q1',
        question: 'VentureOS покрывает полный цикл венчурного фонда от заявки до выхода',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'VentureOS — это комплексная AI-платформа, которая покрывает весь lifecycle фонда: deal flow, инвесткомитет, сделка, мониторинг портфеля, exit.'
      },
      {
        id: 'hub-q2',
        question: 'Сколько основных модулей входит в VentureOS?',
        type: 'multiple-choice',
        options: [
          'Менее 5',
          'От 5 до 10',
          'От 10 до 20',
          'Более 20'
        ],
        correctAnswer: 3,
        explanation: 'VentureOS включает более 20 модулей: от deal sourcing и AI-комитета до ILPA-отчётности, GR-панели, ESG scoring и цифрового двойника фонда.'
      },
      {
        id: 'hub-q3',
        question: 'Какой модуль отвечает за автоматический поиск и оценку потенциальных сделок?',
        type: 'multiple-choice',
        options: [
          'FstDealflow',
          'FstSourcing',
          'FstCommittee',
          'FstIntelligence'
        ],
        correctAnswer: 1,
        explanation: 'FstSourcing — модуль AI deal sourcing, который автоматически сканирует рынок, находит перспективные компании и проводит предварительный скоринг.'
      },
      {
        id: 'hub-q4',
        question: 'Заполните пропуск: "Цифровой двойник (Digital Twin) позволяет симулировать различные ___ развития фонда"',
        type: 'fill-blank',
        correctAnswer: ['сценарии', 'сценарий', 'варианты', 'scenarios'],
        explanation: 'Digital Twin фонда позволяет симулировать различные сценарии: оптимистичный, базовый, пессимистичный, проверять влияние стратегических решений на NAV и IRR.'
      },
      {
        id: 'hub-q5',
        question: 'VentureOS использует исключительно Claude AI для всех AI-функций',
        type: 'true-false',
        correctAnswer: false,
        explanation: 'VentureOS использует мультимодельный подход: DeepSeek (по умолчанию для быстрых задач), Claude (стратегический анализ), GPT-4o (мультимодальные задачи), YandexGPT (русскоязычный контент).'
      }
    ]
  }
}

/**
 * Get quiz questions for a specific module
 * @param {string} moduleId - Module identifier (route name without slash, e.g., 'fst-committee')
 * @returns {Object|null} Quiz data or null if not found
 */
export function getQuizForModule(moduleId) {
  // Remove leading slash if present
  const cleanId = moduleId.replace(/^\//, '')
  return QUIZ_DATA[cleanId] || null
}

/**
 * Get all available quiz modules
 * @returns {Array} List of module IDs with quizzes
 */
export function getAvailableQuizModules() {
  return Object.keys(QUIZ_DATA)
}

/**
 * Check if a module has a quiz
 * @param {string} moduleId - Module identifier
 * @returns {boolean}
 */
export function hasQuiz(moduleId) {
  const cleanId = moduleId.replace(/^\//, '')
  return cleanId in QUIZ_DATA
}
