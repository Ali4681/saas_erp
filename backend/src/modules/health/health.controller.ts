import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/auth/auth.decorators';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' };
  }

  @Public()
  @Get('db')
  async getDbHealth() {
    try {
      await this.prisma.isHealthy();
      return { status: 'ok', database: 'up' };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
