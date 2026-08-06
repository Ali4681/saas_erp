import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
};

type ChannelState = {
  socket: WebSocket | null;
  pending: Map<string, Pending>;
  lastSeenAt: number;
};

@Injectable()
export class ExtensionBridgeService {
  private readonly logger = new Logger(ExtensionBridgeService.name);
  private readonly channels = new Map<string, ChannelState>();

  private channel(name: string): ChannelState {
    let state = this.channels.get(name);
    if (!state) {
      state = { socket: null, pending: new Map(), lastSeenAt: 0 };
      this.channels.set(name, state);
    }
    return state;
  }

  attach(channel: string, socket: WebSocket) {
    const state = this.channel(channel);
    if (state.socket && state.socket !== socket) {
      try {
        state.socket.close();
      } catch {
        // ignore
      }
    }
    state.socket = socket;
    state.lastSeenAt = Date.now();
    this.logger.log(`Extension connected: ${channel}`);
  }

  detach(channel: string, socket?: WebSocket) {
    const state = this.channel(channel);
    if (socket && state.socket && state.socket !== socket) return;
    state.socket = null;
    for (const [, pending] of state.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('extension_disconnected'));
    }
    state.pending.clear();
    this.logger.log(`Extension disconnected: ${channel}`);
  }

  touch(channel: string) {
    this.channel(channel).lastSeenAt = Date.now();
  }

  isConnected(channel: string): boolean {
    const state = this.channel(channel);
    const socket = state.socket;
    if (!socket || socket.readyState !== 1 /* OPEN */) return false;
    return Date.now() - state.lastSeenAt < 10 * 60_000;
  }

  status(channel: string) {
    const state = this.channel(channel);
    return {
      channel,
      connected: this.isConnected(channel),
      lastSeenAt: state.lastSeenAt || null,
      pending: state.pending.size,
    };
  }

  handleMessage(channel: string, raw: string) {
    this.touch(channel);
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = String(msg.type ?? '');
    const state = this.channel(channel);

    if (type === 'ping') {
      state.socket?.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (type === 'pong' || type === 'hello') {
      this.logger.log(
        type === 'hello'
          ? `Extension hello (${channel}): ${JSON.stringify(msg)}`
          : `Extension pong (${channel})`,
      );
      return;
    }

    if (type === 'result') {
      const id = String(msg.id ?? '');
      const pending = state.pending.get(id);
      if (!pending) return;
      clearTimeout(pending.timer);
      state.pending.delete(id);
      if (msg.ok) pending.resolve(msg.data);
      else pending.reject(new Error(String(msg.error ?? `${channel}_error`)));
    }
  }

  async sendCommand(
    channel: string,
    cmdType: string,
    payload: Record<string, unknown> = {},
    timeoutMs = 30_000,
  ): Promise<unknown> {
    const state = this.channel(channel);
    if (!state.socket) {
      throw new Error('extension_not_connected');
    }

    const id = randomUUID();
    const message = { type: cmdType, id, ...payload };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(id);
        reject(new Error('extension_timeout'));
      }, timeoutMs);

      state.pending.set(id, { resolve, reject, timer });
      try {
        state.socket!.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        state.pending.delete(id);
        reject(error);
      }
    });
  }
}
