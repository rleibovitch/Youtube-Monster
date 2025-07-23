import type { TranscriptSegment } from '../types';

export interface StoredTranscript {
  videoId: string;
  extractionMethod: string;
  transcriptSegments: TranscriptSegment[];
  totalSegments: number;
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

class TranscriptStorageService {
  private storageKey = 'youtube_monster_transcripts';

  /**
   * Store transcript data in localStorage (for development)
   * In production, this would use a database
   */
  storeTranscript(transcript: StoredTranscript): void {
    try {
      const existing = this.getAllTranscripts();
      existing[transcript.videoId] = transcript;
      
      localStorage.setItem(this.storageKey, JSON.stringify(existing));
      console.log(`[TranscriptStorage] Stored transcript for video ${transcript.videoId}`);
    } catch (error) {
      console.error('[TranscriptStorage] Failed to store transcript:', error);
    }
  }

  /**
   * Retrieve transcript for a specific video
   */
  getTranscript(videoId: string): StoredTranscript | null {
    try {
      const allTranscripts = this.getAllTranscripts();
      return allTranscripts[videoId] || null;
    } catch (error) {
      console.error('[TranscriptStorage] Failed to retrieve transcript:', error);
      return null;
    }
  }

  /**
   * Get all stored transcripts
   */
  getAllTranscripts(): Record<string, StoredTranscript> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[TranscriptStorage] Failed to get all transcripts:', error);
      return {};
    }
  }

  /**
   * Search for specific phrases in stored transcripts
   */
  searchPhrases(phrases: string[]): Array<{
    videoId: string;
    phrase: string;
    matches: Array<{
      segmentIndex: number;
      timestamp: number;
      text: string;
      offset: number;
      duration: number;
    }>;
  }> {
    const results = [];
    const allTranscripts = this.getAllTranscripts();

    for (const [videoId, transcript] of Object.entries(allTranscripts)) {
      for (const phrase of phrases) {
        const matches = [];
        
        for (let i = 0; i < transcript.transcriptSegments.length; i++) {
          const segment = transcript.transcriptSegments[i];
          if (segment.text.toLowerCase().includes(phrase.toLowerCase())) {
            matches.push({
              segmentIndex: i,
              timestamp: segment.offset / 1000,
              text: segment.text,
              offset: segment.offset,
              duration: segment.duration
            });
          }
        }

        if (matches.length > 0) {
          results.push({
            videoId,
            phrase,
            matches
          });
        }
      }
    }

    return results;
  }

  /**
   * Validate transcript timestamps
   */
  validateTranscript(videoId: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const transcript = this.getTranscript(videoId);
    if (!transcript) {
      return {
        isValid: false,
        issues: ['Transcript not found'],
        suggestions: ['Run analysis again to generate transcript']
      };
    }

    const issues = [];
    const suggestions = [];

    // Check for duplicate timestamps
    const timestamps = transcript.transcriptSegments.map(s => s.offset);
    const uniqueTimestamps = new Set(timestamps);
    if (timestamps.length !== uniqueTimestamps.size) {
      issues.push('Duplicate timestamps found');
      suggestions.push('Transcript may have extraction issues');
    }

    // Check for non-sequential timestamps
    for (let i = 1; i < transcript.transcriptSegments.length; i++) {
      const prev = transcript.transcriptSegments[i - 1].offset;
      const curr = transcript.transcriptSegments[i].offset;
      if (curr < prev) {
        issues.push(`Non-sequential timestamps: ${prev} -> ${curr}`);
        suggestions.push('Transcript segments may be out of order');
      }
    }

    // Check for suspicious patterns
    const zeroTimestamps = transcript.transcriptSegments.filter(s => s.offset === 0);
    if (zeroTimestamps.length > 1) {
      issues.push('Multiple segments with timestamp 0');
      suggestions.push('Transcript may have extraction method issues');
    }

    // Check extraction method
    if (transcript.extractionMethod.includes('ai-generated')) {
      issues.push('Using AI-generated transcript (may not be accurate)');
      suggestions.push('Try to get real YouTube transcript');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Clear all stored transcripts
   */
  clearAll(): void {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('[TranscriptStorage] Cleared all transcripts');
    } catch (error) {
      console.error('[TranscriptStorage] Failed to clear transcripts:', error);
    }
  }
}

export const transcriptStorageService = new TranscriptStorageService(); 