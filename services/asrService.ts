import type { AnalysisResult } from '../types';

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

export const transcribeWithASR = async (videoId: string): Promise<ASRResult> => {
  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); 
      const errorMessage = errorData.error || `ASR transcription failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data as ASRResult;
  } catch (e) {
    console.error("Failed to transcribe with ASR:", e);
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("An unknown network error occurred during ASR transcription.");
  }
};

export const analyzeWithASR = async (videoId: string, sensitivity: number = 5, videoDuration?: number): Promise<AnalysisResult> => {
  try {
    const response = await fetch('/api/analyze-asr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId, sensitivity, videoDuration }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); 
      const errorMessage = errorData.error || `ASR analysis failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data as AnalysisResult;
  } catch (e) {
    console.error("Failed to analyze with ASR:", e);
    if (e instanceof Error) {
      throw e;
    }
    throw new Error("An unknown network error occurred during ASR analysis.");
  }
}; 