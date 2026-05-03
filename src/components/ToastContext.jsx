import { createContext, useContext, useState, useCallback, useRef } from "react";

export const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t.leaveTimer);
      clearTimeout(t.removeTimer);
      delete timersRef.current[id];
    }
    setToasts(ts => ts.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 300);
  }, []);

  const show = useCallback((message, options = {}) => {
    const { icon, action, duration } = options;
    const effectiveDuration = duration ?? (action ? 5000 : 3000);
    const id = ++nextId;

    setToasts(ts => [...ts, { id, message, icon, action, leaving: false }]);

    const leaveTimer = setTimeout(() => {
      setToasts(ts => ts.map(x => x.id === id ? { ...x, leaving: true } : x));
    }, Math.max(0, effectiveDuration - 300));

    const removeTimer = setTimeout(() => {
      setToasts(ts => ts.filter(x => x.id !== id));
      delete timersRef.current[id];
    }, effectiveDuration);

    timersRef.current[id] = { leaveTimer, removeTimer };
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}
