import type { TranslationDictionary } from './types';

export const ruDictionary = {
  publicHome: {
    seo: {
      title: 'NEXUS — крипто-терминал для поиска торговых сетапов',
      description: 'Скринер торговых сетапов, рабочее пространство, алерты и Replay для скальперов и интрадей-трейдеров в едином интерфейсе NEXUS.',
      ogLocale: 'ru_RU',
      ogAlternateLocales: ['en_US', 'zh_CN'],
    },
    navigation: {
      features: 'Возможности',
      workflow: 'Как работает',
      terminal: 'Открыть терминал',
      language: 'Язык',
    },
    hero: {
      eyebrow: 'Торговая аналитика для скальперов',
      titleStart: 'Сетапы раньше',
      titleAccent: 'движения рынка',
      description: 'NEXUS объединяет скринер формаций, точный контекст сетапа, рабочее пространство, алерты и историческое воспроизведение.',
      primaryAction: 'Открыть терминал',
      secondaryAction: 'Посмотреть возможности',
      note: 'Текущая версия работает на тестовых данных. Подключение биржевых потоков запланировано отдельным этапом.',
    },
    preview: {
      status: 'TEST DATA · LIVE INTERFACE',
      heading: 'Сетапы под наблюдением',
      setup: 'Сетап',
      stage: 'Этап',
      distance: 'До уровня',
      score: 'Рейтинг',
      watch: 'Наблюдение',
      approach: 'Подход',
      confirmation: 'Подтверждение',
    },
    features: {
      eyebrow: 'Единый терминал',
      title: 'От обнаружения до разбора сделки',
      description: 'Каждый экран работает с одним Setup ID, поэтому торговый контекст не теряется при переходах.',
      items: [
        {
          index: '01',
          title: 'Scanner',
          description: 'Отбор монет по формации, расстоянию до уровня, стадии сетапа и рыночному контексту.',
        },
        {
          index: '02',
          title: 'Workspace',
          description: 'График, уровень, аргументы Scanner и ключевые параметры конкретного сетапа в одном окне.',
        },
        {
          index: '03',
          title: 'Alerts & Replay',
          description: 'Уведомления о смене стадии и воспроизведение исторического сценария без будущих данных.',
        },
      ],
    },
    workflow: {
      eyebrow: 'Рабочий процесс',
      title: 'Четыре шага вместо хаотичного поиска',
      steps: [
        { title: 'Обнаружение', description: 'Scanner находит сетап и присваивает ему уникальный Setup ID.' },
        { title: 'Наблюдение', description: 'Workspace сохраняет уровень, таймфрейм и весь контекст сценария.' },
        { title: 'Сигнал', description: 'Alerts показывает переход сетапа к подходу, подтверждению или пробою.' },
        { title: 'Разбор', description: 'Market History и Replay помогают оценить результат и качество сетапа.' },
      ],
    },
    finalCta: {
      title: 'Открой аналитический терминал NEXUS',
      description: 'Посмотри текущий интерфейс Scanner, Workspace, Alerts, Market History и Replay.',
      action: 'Перейти в терминал',
    },
    footer: {
      product: 'NEXUS Trading Terminal',
      disclaimer: 'Информация в интерфейсе не является инвестиционной рекомендацией.',
    },
  },
} satisfies TranslationDictionary;
