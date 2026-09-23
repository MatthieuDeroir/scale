'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Abonnement Socket.io. La reconnexion est déléguée à la bibliothèque, mais
 * l'état initial vient de getConnectionData() côté service : un afficheur qui
 * redémarre ne doit pas rester noir jusqu'au prochain événement.
 */
export function useSocketEvent<T>(event: string, onEvent: (payload: T) => void) {
  const handler = useRef(onEvent);

  // La référence se met à jour dans un effet, jamais pendant le rendu :
  // écrire une ref au rendu rompt le modèle concurrent de React.
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const socket: Socket = io({ transports: ['websocket'] });
    socket.on(event, (payload: T) => handler.current(payload));
    return () => {
      socket.off(event);
      socket.disconnect();
    };
  }, [event]);
}
