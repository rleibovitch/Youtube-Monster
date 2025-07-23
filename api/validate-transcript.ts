import { VercelRequest, VercelResponse } from '@vercel/node';
import YoutubeTranscript from 'youtube-transcript';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: "Missing 'videoId' in request body." });
  }

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid video ID format. YouTube video IDs should be 11 characters long." });
  }

  try {
    console.log(`[Transcript Validation] Starting transcript validation for video: ${videoId}`);
    
    // Fetch transcript using the same method as the main analysis
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    console.log(`[Transcript Validation] Successfully fetched transcript with ${transcript.length} segments`);
    
    // Search for the specific phrase mentioned in the issue
    const targetPhrase = "it looks pretty challenging";
    const foundSegments = [];
    
    for (let i = 0; i < transcript.length; i++) {
      const segment = transcript[i];
      const text = segment.text.toLowerCase();
      
      if (text.includes(targetPhrase.toLowerCase())) {
        foundSegments.push({
          index: i,
          timestamp: segment.offset / 1000,
          text: segment.text,
          offset: segment.offset,
          duration: segment.duration
        });
      }
    }
    
    // Also search for similar phrases
    const similarPhrases = [
      "looks pretty challenging",
      "pretty challenging",
      "challenging",
      "it looks",
      "looks challenging"
    ];
    
    const similarSegments = [];
    for (let i = 0; i < transcript.length; i++) {
      const segment = transcript[i];
      const text = segment.text.toLowerCase();
      
      for (const phrase of similarPhrases) {
        if (text.includes(phrase.toLowerCase())) {
          similarSegments.push({
            index: i,
            timestamp: segment.offset / 1000,
            text: segment.text,
            offset: segment.offset,
            duration: segment.duration,
            matchedPhrase: phrase
          });
          break; // Only add once per segment
        }
      }
    }
    
    // Get sample segments around different timestamps
    const sampleSegments = [];
    const timestamps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
    
    for (const targetTime of timestamps) {
      const targetOffset = targetTime * 1000;
      let closestSegment = null;
      let minDiff = Infinity;
      
      for (const segment of transcript) {
        const diff = Math.abs(segment.offset - targetOffset);
        if (diff < minDiff) {
          minDiff = diff;
          closestSegment = segment;
        }
      }
      
      if (closestSegment) {
        sampleSegments.push({
          targetTime,
          actualTime: closestSegment.offset / 1000,
          text: closestSegment.text,
          offset: closestSegment.offset,
          duration: closestSegment.duration
        });
      }
    }
    
    const result = {
      videoId,
      timestamp: new Date().toISOString(),
      transcriptInfo: {
        totalSegments: transcript.length,
        totalDuration: transcript.length > 0 ? transcript[transcript.length - 1].offset / 1000 : 0,
        firstSegment: transcript[0] ? {
          text: transcript[0].text,
          offset: transcript[0].offset,
          timestamp: transcript[0].offset / 1000
        } : null,
        lastSegment: transcript[transcript.length - 1] ? {
          text: transcript[transcript.length - 1].text,
          offset: transcript[transcript.length - 1].offset,
          timestamp: transcript[transcript.length - 1].offset / 1000
        } : null
      },
      targetPhraseSearch: {
        phrase: targetPhrase,
        foundSegments,
        count: foundSegments.length
      },
      similarPhrasesSearch: {
        phrases: similarPhrases,
        foundSegments: similarSegments,
        count: similarSegments.length
      },
      sampleSegments,
      fullTranscript: transcript.slice(0, 20) // First 20 segments for debugging
    };
    
    console.log(`[Transcript Validation] Validation complete. Found ${foundSegments.length} exact matches and ${similarSegments.length} similar matches`);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`[Transcript Validation] Validation failed:`, error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Transcript validation failed',
      details: error instanceof Error ? error.stack : undefined
    });
  }
} 