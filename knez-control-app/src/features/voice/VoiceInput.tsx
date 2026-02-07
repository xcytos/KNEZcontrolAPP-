import React, { useState, useEffect } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript }) => {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if ('webkitSpeechRecognition' in win) {
      setSupported(true);
      const SpeechRecognition = win.webkitSpeechRecognition;
      const r = new SpeechRecognition();
      r.continuous = false;
      r.interimResults = true;
      r.lang = 'en-US';
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (event.results[0].isFinal) {
           onTranscript(transcript);
           setListening(false);
        }
      };
      
      r.onerror = () => setListening(false);
      r.onend = () => setListening(false);
      
      setRecognition(r);
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggleListening}
      className={`p-2 rounded-full transition-colors ${
        listening ? 'bg-red-600 text-white animate-pulse' : 'text-zinc-400 hover:text-zinc-200'
      }`}
      title={listening ? "Listening..." : "Voice Input"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="block">
        <path
          d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 11a7 7 0 0 1-14 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 18v3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
};
