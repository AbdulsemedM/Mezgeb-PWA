import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from './Icon';

type Show = (message: string) => void;

const SuccessContext = createContext<Show>(() => undefined);

/**
 * After every save: green check, a short sound, a short vibration and a plain sentence
 * (MOB-002 §5). The sound is a quiet 80 ms tone; phones on silent only vibrate.
 */
export function SuccessFeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<Show>((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 4000);
    try {
      navigator.vibrate?.(40);
    } catch {
      // Not supported: the check and the sentence remain.
    }
    chime();
  }, []);

  return (
    <SuccessContext.Provider value={show}>
      {children}
      <div aria-live="polite">
        {message && (
          <div className="success" role="status">
            <span className="success__check">
              <Icon name="check" size={28} />
            </span>
            <p>{message}</p>
          </div>
        )}
      </div>
    </SuccessContext.Provider>
  );
}

export function useSuccess(): Show {
  return useContext(SuccessContext);
}

let audio: AudioContext | undefined;

function chime(): void {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.08);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.08);
  } catch {
    // Audio blocked or missing: silent is fine.
  }
}
