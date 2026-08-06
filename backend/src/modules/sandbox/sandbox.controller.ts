import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/auth/auth.decorators';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Temporary sandbox routes for convention/tenant/encryption smoke tests.
 */
@Public()
@Controller('sandbox')
export class SandboxController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly encryption: EncryptionService,
  ) {}

  @Post('items')
  async createItem(
    @Body() body: { name: string; unitPrice: string },
    @Headers('x-company-id') companyIdHeader: string,
  ) {
    this.tenant.setCompanyId(companyIdHeader);
    const companyId = this.tenant.requireCompanyId();

    // SandboxItem FKs to SandboxCompany (convention probe), not tenancy Company.
    await this.prisma.sandboxCompany.upsert({
      where: { id: companyId },
      create: { id: companyId, name: `Probe ${companyId.slice(0, 8)}` },
      update: {},
    });

    return this.prisma.sandboxItem.create({
      data: {
        companyId,
        name: body.name,
        unitPrice: body.unitPrice,
      },
    });
  }

  @Get('items')
  async listItems(@Headers('x-company-id') companyIdHeader: string) {
    this.tenant.setCompanyId(companyIdHeader);
    return this.prisma.sandboxItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('encrypt-roundtrip')
  encryptRoundtrip(@Body() body: { value?: string }) {
    if (!body?.value || typeof body.value !== 'string') {
      throw new BadRequestException('body.value is required');
    }
    const encrypted = this.encryption.encrypt(body.value);
    const decrypted = this.encryption.decrypt(encrypted.ciphertext);
    return {
      keyVersion: encrypted.keyVersion,
      ciphertextBase64: encrypted.ciphertext.toString('base64'),
      decrypted,
      ok: decrypted === body.value,
    };
  }
}
