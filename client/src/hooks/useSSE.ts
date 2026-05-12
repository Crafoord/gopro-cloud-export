import { useEffect, useRef } from 'react';

type SSEHandler = (eventType: string, data: unknown) => void;

export function useSSE(onEvent: SSEHandler) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource('/api/events');

    const events = [
      'scan_progress', 'scan_complete',
      'download_started', 'download_progress', 'download_complete', 'download_error',
      'overall_progress', 'phase_change',
    ];

    const listeners = events.map((type) => {
      const handler = (e: MessageEvent) => {
        try {
          handlerRef.current(type, JSON.parse(e.data));
        } catch { /* ignore parse errors */ }
      };
      es.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      listeners.forEach(({ type, handler }) => es.removeEventListener(type, handler));
      es.close();
    };
  }, []);
}
