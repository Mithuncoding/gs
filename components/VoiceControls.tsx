import React from 'react';
import { FaVolumeUp, FaVolumeMute, FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';

interface VoiceControlsProps {
  // TTS props
  onSpeak: () => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
  ttsSupported: boolean;
  ttsTooltip?: string;
  
  // STT props
  onStartListening: () => void;
  onStopListening: () => void;
  isListening: boolean;
  sttSupported: boolean;
  sttTooltip?: string;
  
  // Display props
  showTTS?: boolean;
  showSTT?: boolean;
  compact?: boolean;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  onSpeak,
  onStopSpeaking,
  isSpeaking,
  ttsSupported,
  ttsTooltip = 'Read aloud',
  onStartListening,
  onStopListening,
  isListening,
  sttSupported,
  sttTooltip = 'Voice input',
  showTTS = true,
  showSTT = true,
  compact = false
}) => {
  return (
    <div className={`flex ${compact ? 'gap-2' : 'gap-3'} items-center`}>
      {/* TTS Button */}
      {showTTS && ttsSupported && (
        <button
          onClick={isSpeaking ? onStopSpeaking : onSpeak}
          className={`${compact ? 'p-2' : 'px-4 py-2'} rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            isSpeaking
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
          title={ttsTooltip}
          aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
        >
          {isSpeaking ? (
            <>
              <FaVolumeMute className={compact ? 'text-lg' : 'text-xl'} />
              {!compact && <span>Stop</span>}
            </>
          ) : (
            <>
              <FaVolumeUp className={compact ? 'text-lg' : 'text-xl'} />
              {!compact && <span>Read</span>}
            </>
          )}
        </button>
      )}

      {/* STT Button */}
      {showSTT && sttSupported && (
        <button
          onClick={isListening ? onStopListening : onStartListening}
          className={`${compact ? 'p-2' : 'px-4 py-2'} rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            isListening
              ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
              : 'bg-green-500 text-white hover:bg-green-600'
          } disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
          title={sttTooltip}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? (
            <>
              <FaMicrophoneSlash className={compact ? 'text-lg' : 'text-xl'} />
              {!compact && <span>Stop</span>}
            </>
          ) : (
            <>
              <FaMicrophone className={compact ? 'text-lg' : 'text-xl'} />
              {!compact && <span>Speak</span>}
            </>
          )}
        </button>
      )}

      {/* Fallback message if neither is supported */}
      {!ttsSupported && !sttSupported && (
        <div className="text-sm text-gray-500 italic">
          Voice features not supported in this browser
        </div>
      )}
    </div>
  );
};

export default VoiceControls;
