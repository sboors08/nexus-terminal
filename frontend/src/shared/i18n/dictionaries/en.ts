import type { TranslationDictionary } from './types';

export const enDictionary = {
  publicHome: {
    seo: {
      title: 'NEXUS — crypto trading setup terminal',
      description: 'A unified setup scanner, analytical workspace, alerts and market replay interface for scalpers and intraday crypto traders.',
      ogLocale: 'en_US',
      ogAlternateLocales: ['ru_RU', 'zh_CN'],
    },
    navigation: {
      features: 'Features',
      workflow: 'Workflow',
      terminal: 'Open terminal',
      language: 'Language',
    },
    hero: {
      eyebrow: 'Trading intelligence for scalpers',
      titleStart: 'Setups before',
      titleAccent: 'the market move',
      description: 'NEXUS brings setup scanning, persistent context, analytical workspace, alerts and historical replay into one terminal.',
      primaryAction: 'Open terminal',
      secondaryAction: 'Explore features',
      note: 'The current version uses test data. Exchange market streams are planned as a separate integration stage.',
    },
    preview: {
      status: 'TEST DATA · LIVE INTERFACE',
      heading: 'Setups under watch',
      setup: 'Setup',
      stage: 'Stage',
      distance: 'To level',
      score: 'Score',
      watch: 'Watching',
      approach: 'Approach',
      confirmation: 'Confirmation',
    },
    features: {
      eyebrow: 'Unified terminal',
      title: 'From discovery to post-trade review',
      description: 'Every screen follows the same Setup ID, so the market scenario remains intact across the workflow.',
      items: [
        {
          index: '01',
          title: 'Scanner',
          description: 'Filter symbols by setup pattern, distance to level, stage and broader market context.',
        },
        {
          index: '02',
          title: 'Workspace',
          description: 'Chart, level, scanner rationale and the essential parameters of one exact setup.',
        },
        {
          index: '03',
          title: 'Alerts & Replay',
          description: 'Stage-change alerts and historical playback that keeps future market data hidden.',
        },
      ],
    },
    workflow: {
      eyebrow: 'Workflow',
      title: 'Four steps instead of random searching',
      steps: [
        { title: 'Discovery', description: 'Scanner detects a setup and assigns its unique Setup ID.' },
        { title: 'Observation', description: 'Workspace preserves the level, timeframe and full scenario context.' },
        { title: 'Signal', description: 'Alerts tracks movement toward approach, confirmation or breakout.' },
        { title: 'Review', description: 'Market History and Replay help evaluate the result and setup quality.' },
      ],
    },
    finalCta: {
      title: 'Open the NEXUS analytical terminal',
      description: 'Explore the current Scanner, Workspace, Alerts, Market History and Replay interface.',
      action: 'Go to terminal',
    },
    footer: {
      product: 'NEXUS Trading Terminal',
      disclaimer: 'Information displayed in the interface is not investment advice.',
    },
  },
} satisfies TranslationDictionary;
