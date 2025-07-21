# vercel-python
import os
import json
import tempfile
import subprocess
from http.server import BaseHTTPRequestHandler
from transformers import pipeline
import yt_dlp
import torch

# Vercel Python function configuration
def handler(request, context):
    return transcribe_handler(request, context)

class TranscribeHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        if self.path != '/api/transcribe':
            self.wfile.write(json.dumps({'error': 'Invalid endpoint'}).encode())
            return
        
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            video_id = request_data.get('videoId')
            if not video_id:
                self.wfile.write(json.dumps({'error': "Missing 'videoId' in request body."}).encode())
                return
            
            # Validate videoId format
            if not (len(video_id) == 11 and video_id.replace('-', '').replace('_', '').isalnum()):
                self.wfile.write(json.dumps({'error': "Invalid video ID format. YouTube video IDs should be 11 characters long."}).encode())
                return
            
            audio_path = None
            
            try:
                print(f"[ASR] Starting ASR transcription for video: {video_id}")
                
                # Step 1: Download audio
                audio_path = download_youtube_audio(video_id)
                
                # Step 2: Transcribe audio
                transcript = transcribe_audio(audio_path)
                
                if len(transcript) == 0:
                    self.wfile.write(json.dumps({'error': 'ASR transcription produced no results. The video may not contain speech or the audio quality is too poor.'}).encode())
                    return
                
                print(f"[ASR] ASR transcription completed with {len(transcript)} segments")
                
                result = {
                    'transcript': transcript,
                    'extractionMethod': 'huggingface-whisper-asr',
                    'transcriptSegmentCount': len(transcript)
                }
                
                self.wfile.write(json.dumps(result).encode())
                
            except Exception as error:
                print(f"[ASR] ASR transcription failed: {error}")
                self.wfile.write(json.dumps({'error': str(error)}).encode())
            finally:
                # Cleanup audio file
                if audio_path:
                    cleanup_audio_file(audio_path)
                    
        except Exception as error:
            print(f"[ASR] Request processing failed: {error}")
            self.wfile.write(json.dumps({'error': 'Internal server error'}).encode())
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def download_youtube_audio(video_id):
    """Download audio from YouTube video"""
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"{video_id}.wav")
    
    try:
        print(f"[ASR] Downloading audio for video {video_id}...")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
        
        print(f"[ASR] Audio downloaded to {output_path}")
        return output_path
    except Exception as error:
        print(f"[ASR] Failed to download audio: {error}")
        raise Exception(f"Failed to download audio for video {video_id}")

def transcribe_audio(audio_path):
    """Transcribe audio using Whisper model"""
    try:
        print("[ASR] Starting transcription with Whisper model...")
        
        # Use Whisper model for transcription
        transcriber = pipeline(
            "automatic-speech-recognition",
            "openai/whisper-large-v3",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device="cuda" if torch.cuda.is_available() else "cpu"
        )
        
        result = transcriber(
            audio_path,
            return_timestamps=True,
            chunk_length_s=30,
            stride_length_s=5
        )
        
        print("[ASR] Transcription completed")
        
        # Convert the result to our segment format
        segments = []
        
        if 'chunks' in result:
            # Handle chunked results
            for chunk in result['chunks']:
                if 'timestamp' in chunk and 'text' in chunk:
                    segments.append({
                        'offset': int(chunk['timestamp'][0] * 1000),  # Convert to milliseconds
                        'text': chunk['text'].strip(),
                        'duration': int((chunk['timestamp'][1] - chunk['timestamp'][0]) * 1000)
                    })
        elif 'text' in result:
            # Handle single result
            segments.append({
                'offset': 0,
                'text': result['text'].strip(),
                'duration': None
            })
        
        return segments
    except Exception as error:
        print(f"[ASR] Transcription failed: {error}")
        raise Exception(f"Failed to transcribe audio: {error}")

def cleanup_audio_file(audio_path):
    """Clean up downloaded audio file"""
    try:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            print(f"[ASR] Cleaned up audio file: {audio_path}")
    except Exception as error:
        print(f"[ASR] Failed to cleanup audio file: {error}")

# For local development
if __name__ == "__main__":
    handler = TranscribeHandler 