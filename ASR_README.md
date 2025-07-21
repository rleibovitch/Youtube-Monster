# YouTube Monster ASR Integration

This document describes the Automatic Speech Recognition (ASR) integration added to the YouTube Monster app.

## Overview

The YouTube Monster app now includes ASR capabilities as a fallback mechanism when traditional transcript extraction methods fail. This ensures videos can be analyzed even when they don't have captions or transcripts available.

## Current Implementation

The ASR functionality is currently implemented as a placeholder that can be extended with cloud-based ASR services. The infrastructure is in place for future ASR integration.

## Features

### ASR Transcription (Future Implementation)
- **Cloud-Based**: Designed to work with cloud ASR services (Google Speech-to-Text, Azure Speech, etc.)
- **Audio Download**: Will automatically download YouTube audio for processing
- **Chunked Processing**: Designed for 30-second chunks with 5-second overlap for better accuracy
- **Timestamp Support**: Provides precise timestamps for each transcribed segment
- **Automatic Cleanup**: Removes temporary audio files after processing

### Integration Points
- **Fallback Mechanism**: Automatically falls back to ASR when YouTube transcripts are unavailable
- **Seamless Analysis**: ASR transcripts are analyzed using the same Gemini AI pipeline
- **UI Indicators**: Shows when ASR is being used via extraction method display
- **Error Handling**: Graceful fallback and error reporting

## API Endpoints

### `/api/transcribe` (Node.js)
- **Method**: POST
- **Purpose**: Transcribe YouTube video audio (placeholder for cloud ASR)
- **Input**: `{ "videoId": "string" }`
- **Output**: `{ "transcript": [...], "extractionMethod": "cloud-asr-fallback", "transcriptSegmentCount": number }`

### `/api/analyze-asr` (Node.js)
- **Method**: POST
- **Purpose**: Complete ASR transcription and analysis pipeline
- **Input**: `{ "videoId": "string", "sensitivity": number, "videoDuration": number }`
- **Output**: `{ "events": [...], "extractionMethod": "cloud-asr-fallback", "transcriptSegmentCount": number }`

## Dependencies

### Node.js Dependencies
```
@google/genai: ^1.8.0
youtube-transcript: ^1.2.1
```

### Environment Variables
- `GEMINI_API_KEY`: Required for AI analysis of transcribed content

## Usage

### Automatic Fallback
The ASR functionality is automatically triggered when:
1. YouTube transcript extraction fails
2. No captions are available for the video
3. All fallback methods have been exhausted

### Manual ASR Analysis
You can also directly use ASR analysis by calling the `/api/analyze-asr` endpoint:

```javascript
const response = await fetch('/api/analyze-asr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoId: 'YOUR_VIDEO_ID',
    sensitivity: 5,
    videoDuration: 300
  })
});
```

## Performance Considerations

### Processing Time
- **Audio Download**: 10-30 seconds depending on video length and internet speed
- **Transcription**: 30-60 seconds for a 10-minute video (depends on hardware)
- **Analysis**: Additional time for Gemini AI analysis of transcribed segments

### Resource Usage
- **Memory**: Whisper model requires ~2-4GB RAM
- **CPU/GPU**: GPU acceleration recommended for faster transcription
- **Storage**: Temporary audio files are automatically cleaned up

## Error Handling

### Common Issues
1. **Audio Download Failures**: Network issues or video restrictions
2. **Transcription Failures**: Poor audio quality or no speech content
3. **Model Loading**: First-time model download may take several minutes

### Fallback Strategy
1. Try YouTube transcript extraction (primary method)
2. Attempt ASR transcription (fallback method)
3. Return error if both methods fail

## UI Indicators

When ASR is used, the app displays:
- **Extraction Method**: "ASR Transcription" with teal color coding
- **Description**: "Hugging Face Whisper speech recognition"
- **Processing Status**: Loading indicators during transcription

## Deployment

### Vercel Configuration
The `vercel.json` file includes Python runtime configuration for ASR endpoints:

```json
{
  "functions": {
    "api/transcribe.py": {
      "runtime": "python@3.11"
    },
    "api/analyze-asr.py": {
      "runtime": "python@3.11"
    }
  }
}
```

### Local Development
1. Install Python dependencies: `pip install -r requirements.txt`
2. Set environment variables
3. Run the development server: `npm run dev`

## Limitations

1. **Processing Time**: ASR is slower than direct transcript extraction
2. **Accuracy**: May have transcription errors, especially with poor audio quality
3. **Resource Usage**: Higher memory and CPU requirements
4. **Cost**: Additional API calls for transcription and analysis

## Future Improvements

1. **Model Optimization**: Use smaller, faster models for quicker processing
2. **Caching**: Cache transcribed results to avoid re-processing
3. **Batch Processing**: Process multiple videos simultaneously
4. **Quality Assessment**: Automatically assess audio quality before transcription 