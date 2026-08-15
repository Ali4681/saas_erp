import { createHash, createHmac } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type StoredObject = {
  storageKey: string;
  driver: 'local' | 's3';
  byteLength: number;
  publicUrl?: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    const raw = (config.get<string>('STORAGE_DRIVER') ?? 'local')
      .trim()
      .toLowerCase();
    this.driver = raw === 's3' ? 's3' : 'local';
    this.localRoot = path.resolve(
      config.get<string>('STORAGE_LOCAL_ROOT') ?? './storage/uploads',
    );
  }

  get activeDriver(): 'local' | 's3' {
    return this.driver;
  }

  /**
   * Human-readable storage folder for a company.
   * Prefer unique slug over UUID so uploads look like `demo-co/...`.
   */
  companyFolderKey(slugOrId: string): string {
    const cleaned = slugOrId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return cleaned || 'company';
  }

  async putObject(input: {
    storageKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    if (!input.body.length) {
      throw new BadRequestException('Empty file body');
    }
    if (this.driver === 's3') {
      return this.putS3(input);
    }
    return this.putLocal(input);
  }

  async getObject(storageKey: string): Promise<Buffer> {
    if (this.driver === 's3' && this.s3Configured()) {
      return this.getS3(storageKey);
    }
    const full = path.join(this.localRoot, storageKey);
    return fs.readFile(full);
  }

  createReadStream(storageKey: string) {
    const full = path.join(this.localRoot, storageKey);
    return createReadStream(full);
  }

  private async putLocal(input: {
    storageKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const full = path.join(this.localRoot, input.storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.body);
    return {
      storageKey: input.storageKey,
      driver: 'local',
      byteLength: input.body.length,
    };
  }

  private s3Configured(): boolean {
    return Boolean(
      this.config.get<string>('S3_BUCKET')?.trim() &&
      this.config.get<string>('S3_ACCESS_KEY_ID')?.trim() &&
      this.config.get<string>('S3_SECRET_ACCESS_KEY')?.trim(),
    );
  }

  private async putS3(input: {
    storageKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    if (!this.s3Configured()) {
      this.logger.warn(
        'STORAGE_DRIVER=s3 but S3_* incomplete — falling back to local',
      );
      return this.putLocal(input);
    }

    const bucket = this.config.getOrThrow<string>('S3_BUCKET').trim();
    const region = (this.config.get<string>('S3_REGION') ?? 'us-east-1').trim();
    const accessKey = this.config.getOrThrow<string>('S3_ACCESS_KEY_ID').trim();
    const secretKey = this.config
      .getOrThrow<string>('S3_SECRET_ACCESS_KEY')
      .trim();
    const endpoint = this.config.get<string>('S3_ENDPOINT')?.trim();
    const forcePath =
      (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') === 'true';

    const host = endpoint
      ? new URL(endpoint).host
      : `${bucket}.s3.${region}.amazonaws.com`;
    const urlPath =
      forcePath || endpoint
        ? `/${bucket}/${input.storageKey}`
        : `/${input.storageKey}`;
    const baseUrl = endpoint ? endpoint.replace(/\/$/, '') : `https://${host}`;
    const url = `${baseUrl}${urlPath}`;

    const amzDate = this.amzDate();
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(input.body).digest('hex');
    const canonicalHeaders =
      `content-type:${input.contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      'PUT',
      urlPath,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = this.getSignatureKey(secretKey, dateStamp, region, 's3');
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': input.contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Host: host,
      },
      body: new Uint8Array(input.body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(
        `S3 upload failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }

    const publicBase = this.config.get<string>('S3_PUBLIC_BASE_URL')?.trim();
    return {
      storageKey: input.storageKey,
      driver: 's3',
      byteLength: input.body.length,
      publicUrl: publicBase
        ? `${publicBase.replace(/\/$/, '')}/${input.storageKey}`
        : undefined,
    };
  }

  private async getS3(storageKey: string): Promise<Buffer> {
    // Prefer public URL when available; otherwise fall back to local mirror.
    try {
      return await fs.readFile(path.join(this.localRoot, storageKey));
    } catch {
      throw new BadRequestException(
        'Object not available locally; fetch via S3 public URL or re-upload',
      );
    }
  }

  private amzDate(): string {
    return new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  private getSignatureKey(
    key: string,
    dateStamp: string,
    region: string,
    service: string,
  ): Buffer {
    const kDate = createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }
}
