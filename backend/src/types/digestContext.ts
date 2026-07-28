export interface DigestHotHeadline {
  title: string;
  url?: string;
  score?: number;
  source?: string;
}

export interface DigestMonitorAlert {
  source: string;
  count: number;
  topTitle?: string;
}

export interface DigestTrackedTheme {
  tag: string;
  itemCount: number;
  sampleTitles: string[];
}

export interface DigestContextPayload {
  date: string;
  suggestedDailyOneXTopics: string[];
  hotHeadlines: DigestHotHeadline[];
  monitorAlerts: DigestMonitorAlert[];
  trackedThemes: DigestTrackedTheme[];
  stale: boolean;
  missingKeys: string[];
}
