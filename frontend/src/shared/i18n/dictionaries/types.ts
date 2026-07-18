export type TranslationDictionary = {
  publicHome: {
    seo: {
      title: string;
      description: string;
      ogLocale: string;
      ogAlternateLocales: string[];
    };
    navigation: {
      features: string;
      workflow: string;
      terminal: string;
      language: string;
    };
    hero: {
      eyebrow: string;
      titleStart: string;
      titleAccent: string;
      description: string;
      primaryAction: string;
      secondaryAction: string;
      note: string;
    };
    preview: {
      status: string;
      heading: string;
      setup: string;
      stage: string;
      distance: string;
      score: string;
      watch: string;
      approach: string;
      confirmation: string;
    };
    features: {
      eyebrow: string;
      title: string;
      description: string;
      items: Array<{
        index: string;
        title: string;
        description: string;
      }>;
    };
    workflow: {
      eyebrow: string;
      title: string;
      steps: Array<{
        title: string;
        description: string;
      }>;
    };
    finalCta: {
      title: string;
      description: string;
      action: string;
    };
    footer: {
      product: string;
      disclaimer: string;
    };
  };
};
