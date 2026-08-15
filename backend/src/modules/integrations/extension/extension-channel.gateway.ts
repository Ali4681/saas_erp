import { Logger } from '@nestjs/common';
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { RawData, WebSocket } from 'ws';
import { ExtensionBridgeService } from './extension-bridge.service';

/** Shared raw-WS attach logic for provider extension channels. */
export abstract class ExtensionChannelGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  protected abstract readonly channel: string;
  protected abstract readonly logger: Logger;
  private readonly keepalives = new WeakMap<WebSocket, NodeJS.Timeout>();

  constructor(protected readonly bridge: ExtensionBridgeService) {}

  handleConnection(client: WebSocket) {
    this.bridge.attach(this.channel, client);
    client.send(
      JSON.stringify({
        type: 'hello',
        channel: this.channel,
        ok: true,
      }),
    );

    client.on('message', (data: RawData) => {
      const text = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : String(data);
      this.bridge.handleMessage(this.channel, text);
    });

    const timer = setInterval(() => {
      try {
        client.send(JSON.stringify({ type: 'ping' }));
      } catch {
        clearInterval(timer);
      }
    }, 20_000);
    this.keepalives.set(client, timer);
    this.logger.log(`Extension connected on /ws/${this.channel}`);
  }

  handleDisconnect(client: WebSocket) {
    const timer = this.keepalives.get(client);
    if (timer) clearInterval(timer);
    this.bridge.detach(this.channel, client);
  }
}
