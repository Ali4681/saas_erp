import { Logger } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { ExtensionBridgeService } from './extension-bridge.service';
import { ExtensionChannelGateway } from './extension-channel.gateway';

@WebSocketGateway({ path: '/ws/mrsool', cors: { origin: true } })
export class MrsoolExtensionGateway extends ExtensionChannelGateway {
  protected readonly channel = 'mrsool';
  protected readonly logger = new Logger(MrsoolExtensionGateway.name);

  constructor(bridge: ExtensionBridgeService) {
    super(bridge);
  }
}
