import { useState, useEffect, useCallback, useRef } from 'react';

interface UseVoiceInteractionProps {
  language: 'en' | 'kn';
  onTranscript?: (text: string) => void;
}

interface UseVoiceInteractionReturn {
  // TTS (Text-to-Speech)
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  ttsSupported: boolean;
  
  // STT (Speech-to-Text)
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
  transcript: string;
  sttSupported: boolean;
  sttError: string | null;
}

export const useVoiceInteraction = ({
  language,
  onTranscript
}: UseVoiceInteractionProps): UseVoiceInteractionReturn => {
  // TTS States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  
  // STT States
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sttSupported, setSttSupported] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Check browser support on mount
  useEffect(() => {
    // Check TTS support
    if ('speechSynthesis' in window) {
      setTtsSupported(true);
      synthRef.current = window.speechSynthesis;
    }

    // Check STT support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSttSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      // Set language based on prop
      recognitionRef.current.lang = language === 'kn' ? 'kn-IN' : 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setSttError(null);
      };

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
        if (onTranscript) {
          onTranscript(transcriptText);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setSttError(event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [language, onTranscript]);

  // Update language when it changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language === 'kn' ? 'kn-IN' : 'en-US';
    }
  }, [language]);

  // TTS Functions
  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    // Small delay to prevent errors
    setTimeout(() => {
      if (!synthRef.current) return;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'kn' ? 'kn-IN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        // Silently handle errors to avoid console spam
        setIsSpeaking(false);
      };

      // Get available voices and try to find a Kannada voice if needed
      const voices = synthRef.current.getVoices();
      if (language === 'kn') {
        const kannadaVoice = voices.find(voice => 
          voice.lang.startsWith('kn') || voice.lang.includes('Kannada')
        );
        if (kannadaVoice) {
          utterance.voice = kannadaVoice;
        }
      } else {
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en')
        );
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      synthRef.current.speak(utterance);
    }, 100);
  }, [language]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // STT Functions
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setSttError('Speech recognition not supported');
      return;
    }

    try {
      setTranscript('');
      setSttError(null);
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setSttError('Failed to start listening');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    // TTS
    speak,
    stopSpeaking,
    isSpeaking,
    ttsSupported,
    
    // STT
    startListening,
    stopListening,
    isListening,
    transcript,
    sttSupported,
    sttError
  };
};
