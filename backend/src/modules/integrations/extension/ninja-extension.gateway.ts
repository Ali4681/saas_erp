import { Logger } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { ExtensionBridgeService } from './extension-bridge.service';
import { ExtensionChannelGateway } from './extension-channel.gateway';

@WebSocketGateway({ path: '/ws/ninja', cors: { origin: true } })
export class NinjaExtensionGateway extends ExtensionChannelGateway {
  protected readonly channel = 'ninja';
  protected readonly logger = new Logger(NinjaExtensionGateway.name);

  constructor(bridge: ExtensionBridgeService) {
    super(bridge);
  }
}
