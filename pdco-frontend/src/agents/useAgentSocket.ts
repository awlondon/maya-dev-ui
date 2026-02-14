import { useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '');
const AGENT_SOCKET_URL = API_BASE.replace(/^http/i, 'ws');

export function useAgentSocket(onCIUpdate: (data: any) => void, onPRUpdate: (data: any) => void) {
  useEffect(() => {
    const socket = new WebSocket(AGENT_SOCKET_URL);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'ci_update') onCIUpdate(data);
      if (data.type === 'pr_update') onPRUpdate(data);
    };

    return () => socket.close();
  }, [onCIUpdate, onPRUpdate]);
}
