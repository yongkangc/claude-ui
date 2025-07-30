import { useState, useRef, useCallback } from 'react';

export type AudioRecordingState = 'idle' | 'recording' | 'processing';

export interface AudioRecordingResult {
  audioBlob: Blob;
  audioBase64: string;
  mimeType: string;
  duration: number;
}

export interface UseAudioRecordingReturn {
  state: AudioRecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<AudioRecordingResult | null>;
  error: string | null;
  duration: number;
  isSupported: boolean;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [state, setState] = useState<AudioRecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if MediaRecorder is supported
  const isSupported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setError(null);
      setState('recording');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording and duration tracking
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      setDuration(0);
      
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current > 0) {
          setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 100);

    } catch (err) {
      setState('idle');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please check your audio device.');
        } else {
          setError(`Failed to start recording: ${err.message}`);
        }
      } else {
        setError('Failed to start recording');
      }
    }
  }, [isSupported]);

  const stopRecording = useCallback(async (): Promise<AudioRecordingResult | null> => {
    if (!mediaRecorderRef.current || state !== 'recording') {
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      setState('processing');
      
      // Clear duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      mediaRecorder.onstop = async () => {
        try {
          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const audioBase64 = base64.split(',')[1]; // Remove data:audio/webm;base64, prefix
            
            const result: AudioRecordingResult = {
              audioBlob,
              audioBase64,
              mimeType: 'audio/webm;codecs=opus',
              duration: Math.floor((Date.now() - startTimeRef.current) / 1000)
            };
            
            setState('idle');
            resolve(result);
          };
          
          reader.onerror = () => {
            setError('Failed to process recorded audio');
            setState('idle');
            resolve(null);
          };
          
          reader.readAsDataURL(audioBlob);
          
        } catch (err) {
          setError('Failed to process recorded audio');
          setState('idle');
          resolve(null);
        } finally {
          // Clean up stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.stop();
    });
  }, [state]);

  return {
    state,
    startRecording,
    stopRecording,
    error,
    duration,
    isSupported
  };
}