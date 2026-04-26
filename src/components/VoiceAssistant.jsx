import { useState, useRef, useCallback, useEffect } from 'react';
import { parseVoiceQuery } from '../utils/voiceParser';
import './VoiceAssistant.css';

const SAMPLE_QUERIES = [
  'Best performer',
  "Today's best",
  'Portfolio value',
  'Stocks in profit',
  'Stocks in loss',
  'Worst performer',
  'Total invested',
  'Biggest holding',
  'Summary',
];

function Bold({ text }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} style={{ color: '#fff' }}>{p}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// ── Helper: get SpeechRecognition constructor safely ──────────────────────
function getSpeechRec() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function VoiceAssistant({ holdings, prices }) {
  const [isOpen,      setIsOpen]      = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState('');
  const [interim,     setInterim]     = useState('');
  const [textInput,   setTextInput]   = useState('');
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [permState,   setPermState]   = useState('unknown'); // 'granted'|'denied'|'unknown'
  const recogRef = useRef(null);

  // Check mic permission status on mount
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'microphone' }).then(status => {
      setPermState(status.state);
      status.onchange = () => setPermState(status.state);
    }).catch(() => {});
  }, []);

  const isSupported = !!getSpeechRec();

  const processQuery = useCallback((text) => {
    if (!text.trim()) return;
    setTranscript(text);
    setInterim('');
    setError('');
    const res = parseVoiceQuery(text, holdings, prices);
    setResult(res);
  }, [holdings, prices]);

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Re-resolve at call time — this is the key fix
    const SpeechRec = getSpeechRec();

    if (!SpeechRec) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Stop any existing session
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch (_) {}
    }

    setError('');
    setTranscript('');
    setInterim('');
    setResult(null);

    let finalFired = false;
    const recog = new SpeechRec();
    recog.continuous     = false;
    recog.interimResults = true;
    recog.lang           = 'en-IN';
    recog.maxAlternatives = 1;

    recog.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recog.onspeechstart = () => {
      setError('');
    };

    recog.onresult = (e) => {
      let interimText = '';
      let finalText   = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += t;
          finalFired = true;
        } else {
          interimText += t;
        }
      }

      if (interimText) setInterim(interimText);
      if (finalText)   processQuery(finalText.trim());
    };

    recog.onerror = (e) => {
      console.error('SpeechRecognition error:', e.error, e);
      switch (e.error) {
        case 'no-speech':
          setError('No speech detected. Please speak clearly into your microphone.');
          break;
        case 'not-allowed':
        case 'permission-denied':
          setPermState('denied');
          setError('Microphone access was denied. Please allow microphone permission in your browser and try again.');
          break;
        case 'audio-capture':
          setError('No microphone found. Please connect a microphone and try again.');
          break;
        case 'network':
          setError('Network error. Please check your internet connection.');
          break;
        case 'aborted':
          // user stopped manually — not an error
          break;
        default:
          setError(`Microphone error: ${e.error}. Try again.`);
      }
      setIsListening(false);
    };

    recog.onend = () => {
      setIsListening(false);
      setInterim('');
      // If no final result was fired, user may have spoken but it wasn't caught
      if (!finalFired && !error) {
        // No-op — onerror would have handled it
      }
    };

    recogRef.current = recog;

    try {
      recog.start();
    } catch (err) {
      setError('Could not start microphone. Check browser permissions and try again.');
      setIsListening(false);
    }
  }, [processQuery]); // No stale dependencies

  const stopListening = useCallback(() => {
    try { recogRef.current?.stop(); } catch (_) {}
    setIsListening(false);
    setInterim('');
  }, []);

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      processQuery(textInput.trim());
      setTextInput('');
    }
  };

  const handleReset = () => {
    setResult(null);
    setTranscript('');
    setInterim('');
    setError('');
  };

  const openPermSettings = () => {
    setError('To allow microphone: click the 🔒 icon in your browser address bar → Site Settings → Allow Microphone, then refresh the page.');
  };

  return (
    <>
      {/* ── Floating button ── */}
      <button
        id="va-fab-btn"
        className={`va-fab ${isOpen ? 'open' : ''} ${isListening ? 'listening' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        title="Voice Portfolio Assistant"
      >
        {isListening ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="5" width="3" height="14" rx="1.5"/>
            <rect x="8" y="2" width="3" height="20" rx="1.5"/>
            <rect x="13" y="6" width="3" height="12" rx="1.5"/>
            <rect x="18" y="4" width="3" height="16" rx="1.5"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        )}
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div className="va-panel">

          {/* Header */}
          <div className="va-header">
            <div className="va-header-left">
              <span className="va-icon">🤖</span>
              <div>
                <div className="va-title">Voice Portfolio Assistant</div>
                <div className="va-sub">
                  {isListening ? '🔴 Listening…' : 'Ask anything about your portfolio'}
                </div>
              </div>
            </div>
            <button className="va-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Browser support banner */}
          {!isSupported && (
            <div className="va-banner warn">
              ⚠️ Speech recognition is not supported in this browser. Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. You can still type your questions below.
            </div>
          )}

          {/* Permission denied banner */}
          {permState === 'denied' && (
            <div className="va-banner error">
              🎤 Microphone access is blocked.{' '}
              <button className="va-inline-btn" onClick={openPermSettings}>How to fix?</button>
            </div>
          )}

          {/* Mic button */}
          <div className="va-mic-area">
            <button
              id="va-mic-btn"
              className={`va-mic-btn ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={!isSupported || permState === 'denied'}
            >
              {isListening ? (
                <>
                  <div className="va-pulse" />
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="5" width="3" height="14" rx="1.5"/>
                    <rect x="8" y="2" width="3" height="20" rx="1.5"/>
                    <rect x="13" y="6" width="3" height="12" rx="1.5"/>
                    <rect x="18" y="4" width="3" height="16" rx="1.5"/>
                  </svg>
                  <span>Listening — tap to stop</span>
                </>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                  <span>{permState === 'denied' ? 'Microphone blocked' : '🎤 Tap to speak'}</span>
                </>
              )}
            </button>

            {/* Interim transcript (live as you speak) */}
            {interim && (
              <div className="va-interim">
                <span className="va-transcript-label">Hearing: </span>
                <em style={{ color: '#aaa' }}>{interim}</em>
              </div>
            )}

            {/* Final transcript */}
            {transcript && !interim && (
              <div className="va-transcript">
                <span className="va-transcript-label">You said: </span>
                "{transcript}"
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="va-error">
                {error}
              </div>
            )}
          </div>

          {/* Text input */}
          <form className="va-text-form" onSubmit={handleTextSubmit}>
            <input
              id="va-text-input"
              className="va-text-input"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Or type a question here…"
            />
            <button type="submit" className="va-send-btn">→</button>
          </form>

          {/* Sample chips */}
          {!result && (
            <div className="va-samples">
              <div className="va-samples-label">Try asking:</div>
              <div className="va-chips">
                {SAMPLE_QUERIES.map(q => (
                  <button key={q} className="va-chip" onClick={() => processQuery(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="va-result">
              <div className="va-result-title">{result.title}</div>
              <div className="va-result-answer"><Bold text={result.answer} /></div>

              {result.highlights?.length > 0 && (
                <div className="va-highlights">
                  {result.highlights.map((h, i) => (
                    <div key={i} className={`va-highlight-chip ${h.positive ? 'up' : 'down'}`}>
                      <span className="va-hl-sym">{h.symbol}</span>
                      <span className="va-hl-val">{h.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.suggestions && (
                <div className="va-samples" style={{ marginTop: 12 }}>
                  <div className="va-samples-label">Try:</div>
                  <div className="va-chips">
                    {result.suggestions.map(q => (
                      <button key={q} className="va-chip" onClick={() => processQuery(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              )}

              <button className="va-clear-btn" onClick={handleReset}>← Ask another question</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
