import type { TranslationDictionary } from './types';

export const zhCnDictionary = {
  publicHome: {
    seo: {
      title: 'NEXUS — 加密货币交易形态终端',
      description: '面向剥头皮和日内加密货币交易者的统一形态扫描器、分析工作区、提醒和历史回放界面。',
      ogLocale: 'zh_CN',
      ogAlternateLocales: ['ru_RU', 'en_US'],
    },
    navigation: {
      features: '功能',
      workflow: '工作流程',
      terminal: '打开终端',
      language: '语言',
    },
    hero: {
      eyebrow: '面向剥头皮交易者的市场分析',
      titleStart: '在市场启动前',
      titleAccent: '发现交易形态',
      description: 'NEXUS 将形态扫描、持续上下文、分析工作区、提醒和历史回放整合到一个终端。',
      primaryAction: '打开终端',
      secondaryAction: '查看功能',
      note: '当前版本使用测试数据。交易所行情流将在独立阶段接入。',
    },
    preview: {
      status: '测试数据 · 实时界面',
      heading: '观察中的形态',
      setup: '形态',
      stage: '阶段',
      distance: '距价位',
      score: '评分',
      watch: '观察',
      approach: '接近',
      confirmation: '确认',
    },
    features: {
      eyebrow: '统一终端',
      title: '从发现到交易复盘',
      description: '所有页面共享同一个 Setup ID，因此市场场景在整个流程中保持一致。',
      items: [
        {
          index: '01',
          title: 'Scanner',
          description: '根据形态、距价位、阶段和整体市场环境筛选交易标的。',
        },
        {
          index: '02',
          title: 'Workspace',
          description: '在一个窗口中查看图表、价位、扫描依据和特定形态的关键参数。',
        },
        {
          index: '03',
          title: 'Alerts & Replay',
          description: '跟踪阶段变化，并在隐藏未来数据的情况下回放历史场景。',
        },
      ],
    },
    workflow: {
      eyebrow: '工作流程',
      title: '四个步骤替代无序搜索',
      steps: [
        { title: '发现', description: 'Scanner 识别形态并分配唯一的 Setup ID。' },
        { title: '观察', description: 'Workspace 保存价位、周期和完整场景上下文。' },
        { title: '信号', description: 'Alerts 跟踪接近、确认或突破阶段。' },
        { title: '复盘', description: 'Market History 和 Replay 用于评估结果与形态质量。' },
      ],
    },
    finalCta: {
      title: '打开 NEXUS 分析终端',
      description: '查看当前的 Scanner、Workspace、Alerts、Market History 和 Replay 界面。',
      action: '进入终端',
    },
    footer: {
      product: 'NEXUS Trading Terminal',
      disclaimer: '界面中的信息不构成投资建议。',
    },
  },
} satisfies TranslationDictionary;
