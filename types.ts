export enum NegativeCategory {
    SPEECH = 'Negative Speech',
    BEHAVIOR = 'Negative Behavior',
    POTENTIAL_EMOTIONS = 'Potential Emotions',
}

export interface AnalysisEvent {
  timestamp: number;
  category: NegativeCategory;
  subCategory: string;
  description: string;
}