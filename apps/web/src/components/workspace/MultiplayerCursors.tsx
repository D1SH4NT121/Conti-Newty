'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { UserCursor, CursorUser } from '../reactbits/UserCursor';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../context/AuthContext';

interface MultiplayerCursorsProps {
  enabled?: boolean;
  workspaceId?: string;
}

export const MultiplayerCursors: React.FC<MultiplayerCursorsProps> = ({
  enabled = true,
  workspaceId,
}) => {
  const { user } = useAuth();
  const [remotePeers, setRemotePeers] = useState<Map<string, CursorUser>>(new Map());
  const lastEmitTime = useRef<number>(0);

  // Setup Live Realtime Socket.IO Cursor Stream (Real Human Teammates & Server Agents Only)
  useEffect(() => {
    if (!enabled || !workspaceId) {
      setRemotePeers(new Map());
      return;
    }

    const socket = getSocket();

    // Join the workspace room with user profile
    const joinPayload = {
      workspaceId,
      user: {
        id: user?.id || `anon-${Math.random().toString(36).substring(2, 7)}`,
        name: user?.name || user?.email || 'Conti Collaborator',
        email: user?.email,
        avatarUrl: user?.avatarUrl,
        role: user?.role || 'MEMBER',
      },
    };

    if (socket.connected) {
      socket.emit('workspace.join', joinPayload);
    } else {
      socket.connect();
      socket.once('connect', () => {
        socket.emit('workspace.join', joinPayload);
      });
    }

    // Handle incoming peer cursor movements
    const handleCursorMoved = (data: {
      socketId: string;
      userId: string;
      name?: string;
      email?: string;
      avatarUrl?: string | null;
      role?: string;
      x: number;
      y: number;
      activeFile?: string;
      statusText?: string;
      color?: string;
      isAiAgent?: boolean;
    }) => {
      // Don't render our own cursor
      if (data.socketId === socket.id || (user?.id && data.userId === user.id)) {
        return;
      }

      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.set(data.socketId || data.userId, {
          id: data.socketId || data.userId,
          name: data.name || data.email?.split('@')[0] || 'Teammate',
          avatarUrl: data.avatarUrl,
          role: data.role || 'Member',
          color: data.color || '#3B82F6',
          x: data.x,
          y: data.y,
          isAiAgent: !!data.isAiAgent,
          statusText: data.statusText || data.activeFile,
          lastActive: Date.now(),
        });
        return next;
      });
    };

    const handleCursorRemoved = (data: { socketId: string; userId?: string }) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        if (data.userId) next.delete(data.userId);
        return next;
      });
    };

    const handlePresenceLeave = (data: { userId: string }) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        for (const [key, peer] of next.entries()) {
          if (peer.id === data.userId || key === data.userId) {
            next.delete(key);
          }
        }
        return next;
      });
    };

    socket.on('cursor.moved', handleCursorMoved);
    socket.on('cursor.removed', handleCursorRemoved);
    socket.on('presence.leave', handlePresenceLeave);
    const handleSocketDisconnect = () => setRemotePeers(new Map());
    socket.on('disconnect', handleSocketDisconnect);

    // Track local mouse moves and broadcast throttled to 35ms (~30fps)
    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastEmitTime.current < 35) return;
      lastEmitTime.current = now;

      socket.emit('cursor.move', {
        workspaceId,
        x: e.clientX,
        y: e.clientY,
        activeFile: window.location.pathname.split('/').pop(),
      });
    };

    const handlePointerLeave = () => {
      socket.emit('cursor.leave', { workspaceId });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    // Periodically clean up stale peer cursors (older than 10 seconds)
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 10000;
      setRemotePeers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [key, peer] of next.entries()) {
          if (peer.lastActive && peer.lastActive < cutoff) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 4000);

    return () => {
      socket.emit('cursor.leave', { workspaceId });
      socket.off('cursor.moved', handleCursorMoved);
      socket.off('cursor.removed', handleCursorRemoved);
      socket.off('presence.leave', handlePresenceLeave);
      socket.off('disconnect', handleSocketDisconnect);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      clearInterval(cleanupInterval);
    };
  }, [enabled, workspaceId, user?.id, user?.name, user?.email, user?.avatarUrl, user?.role]);

  if (!enabled) return null;

  const realPeers = Array.from(remotePeers.values());

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {realPeers.map((cursor) => (
          <UserCursor key={cursor.id} user={cursor} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default MultiplayerCursors;
