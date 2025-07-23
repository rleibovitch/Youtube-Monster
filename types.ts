export enum NegativeCategory {
    SPEECH = 'Negative Speech',
    BEHAVIOR = 'Negative Behavior',
    POTENTIAL_EMOTIONS = 'Potential Emotions',
}

export interface AnalysisEvent {
    timestamp: number;
    category: string;
    subCategory: string;
    description: string;
    phrase?: string;
}

export interface TranscriptSegment {
    offset: number;
    text: string;
    duration?: number;
}

export interface AnalysisResult {
    events: AnalysisEvent[];
    extractionMethod?: string;
    transcriptSegmentCount?: number;
    transcriptData?: {
        videoId: string;
        extractionMethod: string;
        transcriptSegments: TranscriptSegment[];
        totalSegments: number;
        totalDuration: number;
        createdAt: string;
        updatedAt: string;
    };
}

export interface ASRTranscriptSegment {
    offset: number;
    text: string;
    duration?: number;
}

export interface ASRResult {
    transcript: ASRTranscriptSegment[];
    extractionMethod: string;
    transcriptSegmentCount: number;
}

export interface HistoryItem {
    videoId: string;
    videoTitle: string;
    youtubeUrl: string;
    analysisEvents: AnalysisEvent[];
    kidFriendlyScore: number | null;
    extractionMethod?: string;
}
