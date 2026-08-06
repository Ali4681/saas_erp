import { Logger } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { ExtensionBridgeService } from './extension-bridge.service';
import { ExtensionChannelGateway } from './extension-channel.gateway';

@WebSocketGateway({ path: '/ws/toyou', cors: { origin: true } })
export class ToYouExtensionGateway extends ExtensionChannelGateway {
  protected readonly channel = 'toyou';
  protected readonly logger = new Logger(ToYouExtensionGateway.name);

  constructor(bridge: ExtensionBridgeService) {
    super(bridge);
  }
}
