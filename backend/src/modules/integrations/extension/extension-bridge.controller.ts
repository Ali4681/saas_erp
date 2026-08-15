import { Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ExtensionBridgeService } from './extension-bridge.service';

const CHANNELS = ['hungerstation', 'ninja', 'toyou', 'mrsool'] as const;
type Channel = (typeof CHANNELS)[number];

const SAVE_COMMAND: Record<Channel, string> = {
  hungerstation: 'save_session',
  ninja: 'save_ninja_session',
  toyou: 'save_toyou_session',
  mrsool: 'save_mrsool_session',
};

@Controller('integrations/extension')
export class ExtensionBridgeController {
  constructor(private readonly bridge: ExtensionBridgeService) {}

  @Get('status')
  @RequirePermissions('integrations.read')
  allStatus() {
    return Object.fromEntries(
      CHANNELS.map((channel) => [channel, this.bridge.status(channel)]),
    );
  }

  @Get(':channel/status')
  @RequirePermissions('integrations.read')
  channelStatus(@Param('channel') channel: string) {
    const normalized = channel.toLowerCase() as Channel;
    if (!CHANNELS.includes(normalized)) {
      return { ok: false, message: 'unknown_channel', channel };
    }
    return this.bridge.status(normalized);
  }

  @Post(':channel/save-session')
  @RequirePermissions('integrations.write')
  async saveSession(@Param('channel') channel: string) {
    const normalized = channel.toLowerCase() as Channel;
    if (!CHANNELS.includes(normalized)) {
      return { ok: false, message: 'unknown_channel', channel };
    }
    if (!this.bridge.isConnected(normalized)) {
      return {
        ok: false,
        message: 'extension_not_connected',
        channel: normalized,
      };
    }
    try {
      const data = await this.bridge.sendCommand(
        normalized,
        SAVE_COMMAND[normalized],
        {},
        15_000,
      );
      return { ok: true, channel: normalized, data };
    } catch (error) {
      return {
        ok: false,
        channel: normalized,
        message: error instanceof Error ? error.message : 'extension_error',
      };
    }
  }
}
