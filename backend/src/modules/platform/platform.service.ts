import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  MarketingChannel,
  MarketingConnectionStatus,
  MarketingMediaType,
  MarketingPostStatus,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';
import { MarketingPublisherService } from './marketing.publisher';
import { AutomationEngine } from '../automation/automation.engine';

type MediaInput = {
  mediaType: MarketingMediaType;
  fileName: string;
  mimeType: string;
  sizeBytes: number | string;
  contentBase64?: string;
  checksumSha256?: string;
  position?: number;
};

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly publisher: MarketingPublisherService,
    private readonly storage: StorageService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
  ) {}

  private emit(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    void this.automation
      .dispatch({ companyId, event, entityType, entityId, payload })
      .catch((error) => {
        this.logger.warn(
          `automation ${event} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
  }

  // --- Marketing (14.1–14.4) ---

  listPosts(
    companyId: string,
    opts?: { status?: MarketingPostStatus; includeArchived?: boolean },
  ) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.marketingPost
      .findMany({
        where: {
          ...(opts?.status ? { status: opts.status } : {}),
          ...(!opts?.status && !opts?.includeArchived
            ? { status: { not: 'ARCHIVED' } }
            : {}),
        },
        include: { media: { orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      .then((rows) => rows.map((row) => this.serializePost(row)));
  }

  async getPost(companyId: string, postId: string) {
    this.tenant.setCompanyId(companyId);
    const post = await this.prisma.marketingPost.findFirst({
      where: { id: postId, companyId },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    if (!post) throw new NotFoundException('Marketing post not found');
    return this.serializePost(post);
  }

  async createPost(input: {
    companyId: string;
    createdById: string;
    content: string;
    channel: MarketingChannel;
    title?: string;
    status?: MarketingPostStatus;
    scheduledAt?: string;
    media?: MediaInput[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    const status = input.status ?? 'DRAFT';
    this.assertCreatableStatus(status, input.scheduledAt);

    const post = await this.prisma.marketingPost.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        content: input.content,
        channel: input.channel,
        title: input.title,
        status,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
        media: input.media?.length
          ? {
              create: await Promise.all(
                input.media.map((m, i) =>
                  this.buildMediaCreate(input.companyId, m, i),
                ),
              ),
            }
          : undefined,
      },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    return this.serializePost(post);
  }

  async updatePost(
    companyId: string,
    postId: string,
    input: {
      content?: string;
      title?: string | null;
      channel?: MarketingChannel;
      status?: MarketingPostStatus;
      scheduledAt?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const post = await this.requirePost(companyId, postId);
    if (post.status === 'ARCHIVED') {
      throw new BadRequestException('Archived posts cannot be edited');
    }
    if (post.status === 'PUBLISHED' && input.status && input.status !== 'ARCHIVED') {
      throw new BadRequestException(
        'Published posts can only move to ARCHIVED',
      );
    }

    const nextStatus = input.status ?? post.status;
    const nextScheduled =
      input.scheduledAt === undefined
        ? post.scheduledAt
        : input.scheduledAt === null
          ? null
          : new Date(input.scheduledAt);

    if (nextStatus === 'SCHEDULED' && !nextScheduled) {
      throw new BadRequestException(
        'scheduledAt is required when status is SCHEDULED',
      );
    }

    const updated = await this.prisma.marketingPost.update({
      where: { id: postId },
      data: {
        content: input.content,
        title: input.title === undefined ? undefined : input.title,
        channel: input.channel,
        status: input.status,
        scheduledAt:
          input.scheduledAt === undefined
            ? undefined
            : input.scheduledAt === null
              ? null
              : new Date(input.scheduledAt),
        failureReason:
          input.status && input.status !== 'FAILED' ? null : undefined,
      },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    return this.serializePost(updated);
  }

  /** Calendar drag-drop / reschedule (14.3). */
  async reschedulePost(
    companyId: string,
    postId: string,
    scheduledAt: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const post = await this.requirePost(companyId, postId);
    if (['PUBLISHED', 'ARCHIVED', 'PUBLISHING'].includes(post.status)) {
      throw new BadRequestException(
        `Cannot reschedule a ${post.status} post`,
      );
    }
    const at = new Date(scheduledAt);
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO datetime');
    }
    const updated = await this.prisma.marketingPost.update({
      where: { id: postId },
      data: {
        scheduledAt: at,
        status: 'SCHEDULED',
        failureReason: null,
      },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    return this.serializePost(updated);
  }

  async schedulePost(
    companyId: string,
    postId: string,
    scheduledAt: string,
  ) {
    return this.reschedulePost(companyId, postId, scheduledAt);
  }

  async archivePost(companyId: string, postId: string) {
    this.tenant.setCompanyId(companyId);
    await this.requirePost(companyId, postId);
    const updated = await this.prisma.marketingPost.update({
      where: { id: postId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    return this.serializePost(updated);
  }

  async addPostMedia(
    companyId: string,
    postId: string,
    media: MediaInput,
  ) {
    this.tenant.setCompanyId(companyId);
    const post = await this.requirePost(companyId, postId);
    if (['PUBLISHED', 'ARCHIVED', 'PUBLISHING'].includes(post.status)) {
      throw new BadRequestException('Cannot attach media in this status');
    }
    const count = await this.prisma.marketingPostMedia.count({
      where: { marketingPostId: postId },
    });
    const created = await this.prisma.marketingPostMedia.create({
      data: {
        marketingPostId: postId,
        ...(await this.buildMediaCreate(
          companyId,
          media,
          media.position ?? count,
        )),
      },
    });
    return this.serializeMedia(created);
  }

  async removePostMedia(
    companyId: string,
    postId: string,
    mediaId: string,
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requirePost(companyId, postId);
    const media = await this.prisma.marketingPostMedia.findFirst({
      where: { id: mediaId, marketingPostId: postId, companyId },
    });
    if (!media) throw new NotFoundException('Media not found');
    await this.prisma.marketingPostMedia.delete({ where: { id: mediaId } });
    return { deleted: true, id: mediaId };
  }

  /** Calendar view: posts grouped by day (14.3). */
  async calendar(
    companyId: string,
    opts: { from?: string; to?: string; channel?: MarketingChannel },
  ) {
    this.tenant.setCompanyId(companyId);
    const now = new Date();
    const from = opts.from
      ? new Date(opts.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = opts.to
      ? new Date(opts.to)
      : new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
        );
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be valid ISO datetimes');
    }
    if (from > to) {
      throw new BadRequestException('from must be <= to');
    }

    const posts = await this.prisma.marketingPost.findMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        ...(opts.channel ? { channel: opts.channel } : {}),
        OR: [
          { scheduledAt: { gte: from, lte: to } },
          { publishedAt: { gte: from, lte: to } },
        ],
      },
      include: { media: { orderBy: { position: 'asc' } } },
      orderBy: [{ scheduledAt: 'asc' }, { publishedAt: 'asc' }],
      take: 500,
    });

    const byDay: Record<string, ReturnType<PlatformService['serializePost']>[]> =
      {};
    for (const post of posts) {
      const anchor = post.scheduledAt ?? post.publishedAt ?? post.createdAt;
      const key = anchor.toISOString().slice(0, 10);
      (byDay[key] ??= []).push(this.serializePost(post));
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      byDay,
      posts: posts.map((p) => this.serializePost(p)),
    };
  }

  upcomingPosts(companyId: string, limit = 50) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.marketingPost
      .findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: new Date() },
        },
        include: { media: { orderBy: { position: 'asc' } } },
        orderBy: { scheduledAt: 'asc' },
        take: Math.min(limit, 200),
      })
      .then((rows) => rows.map((row) => this.serializePost(row)));
  }

  publishedPosts(companyId: string, limit = 50) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.marketingPost
      .findMany({
        where: { status: 'PUBLISHED' },
        include: { media: { orderBy: { position: 'asc' } } },
        orderBy: { publishedAt: 'desc' },
        take: Math.min(limit, 200),
      })
      .then((rows) => rows.map((row) => this.serializePost(row)));
  }

  async publishPost(companyId: string, postId: string) {
    this.tenant.setCompanyId(companyId);
    const post = await this.prisma.marketingPost.findFirst({
      where: { id: postId, companyId },
      include: { media: true },
    });
    if (!post) {
      throw new NotFoundException('Marketing post not found');
    }
    if (
      !['DRAFT', 'READY', 'SCHEDULED', 'FAILED'].includes(post.status)
    ) {
      throw new BadRequestException(
        'Post cannot be published from this status',
      );
    }

    await this.prisma.marketingPost.update({
      where: { id: postId },
      data: { status: 'PUBLISHING', failureReason: null },
    });

    const result = await this.publisher.publish({
      companyId,
      channel: post.channel,
      content: post.content,
      title: post.title,
      mediaCount: post.media.length,
    });

    if (!result.ok) {
      const failed = await this.prisma.marketingPost.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          failureReason: result.errorMessage ?? 'Publish failed',
          publishMode: result.mode,
        },
        include: { media: { orderBy: { position: 'asc' } } },
      });
      return this.serializePost(failed);
    }

    const published = await this.prisma.marketingPost.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        externalPostId: result.externalPostId,
        publishMode: result.mode,
        failureReason: null,
      },
      include: { media: { orderBy: { position: 'asc' } } },
    });
    return {
      ...this.serializePost(published),
      platformNote: result.platformNote,
    };
  }

  listConnections(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.marketingPlatformConnection
      .findMany({
        orderBy: [{ channel: 'asc' }, { displayName: 'asc' }],
        take: 100,
      })
      .then((rows) => rows.map((row) => this.serializeConnection(row)));
  }

  async upsertConnection(input: {
    companyId: string;
    createdById: string;
    channel: MarketingChannel;
    displayName: string;
    externalAccountId?: string;
    status?: MarketingConnectionStatus;
    credentials?: Record<string, unknown>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (
      input.channel === 'INTERNAL_DRAFT' ||
      input.channel === 'OTHER'
    ) {
      throw new BadRequestException(
        'INTERNAL_DRAFT / OTHER do not use platform connections',
      );
    }

    const encrypted = input.credentials
      ? this.publisher.encryptCredentials(input.credentials)
      : null;
    const status =
      input.status ??
      (encrypted ? ('CONNECTED' as const) : ('DISCONNECTED' as const));

    const existing = await this.prisma.marketingPlatformConnection.findFirst({
      where: {
        companyId: input.companyId,
        channel: input.channel,
        displayName: input.displayName,
      },
    });

    const data = {
      externalAccountId: input.externalAccountId,
      status,
      credentialsCiphertext: encrypted
        ? Uint8Array.from(encrypted.ciphertext)
        : undefined,
      keyVersion: encrypted?.keyVersion,
      lastError: null as string | null,
      connectedAt:
        status === 'CONNECTED' ? new Date() : existing?.connectedAt ?? null,
    };

    const row = existing
      ? await this.prisma.marketingPlatformConnection.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.marketingPlatformConnection.create({
          data: {
            companyId: input.companyId,
            createdById: input.createdById,
            channel: input.channel,
            displayName: input.displayName,
            ...data,
          },
        });
    return this.serializeConnection(row);
  }

  async updateConnectionStatus(
    companyId: string,
    connectionId: string,
    status: MarketingConnectionStatus,
    lastError?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.marketingPlatformConnection.findFirst({
      where: { id: connectionId, companyId },
    });
    if (!row) throw new NotFoundException('Platform connection not found');
    const updated = await this.prisma.marketingPlatformConnection.update({
      where: { id: connectionId },
      data: {
        status,
        lastError: lastError ?? null,
        connectedAt: status === 'CONNECTED' ? new Date() : row.connectedAt,
        credentialsCiphertext:
          status === 'DISCONNECTED' || status === 'REVOKED'
            ? null
            : undefined,
        keyVersion:
          status === 'DISCONNECTED' || status === 'REVOKED' ? null : undefined,
      },
    });
    return this.serializeConnection(updated);
  }

  private assertCreatableStatus(
    status: MarketingPostStatus,
    scheduledAt?: string,
  ) {
    const allowed: MarketingPostStatus[] = [
      'DRAFT',
      'READY',
      'SCHEDULED',
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Create status must be one of ${allowed.join(', ')}`,
      );
    }
    if (status === 'SCHEDULED' && !scheduledAt) {
      throw new BadRequestException(
        'scheduledAt is required when status is SCHEDULED',
      );
    }
  }

  private async requirePost(companyId: string, postId: string) {
    const post = await this.prisma.marketingPost.findFirst({
      where: { id: postId, companyId },
    });
    if (!post) throw new NotFoundException('Marketing post not found');
    return post;
  }

  private async companyFolder(companyId: string): Promise<string> {
    const company = await this.prisma.withoutTenant().company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { slug: true },
    });
    return this.storage.companyFolderKey(company?.slug ?? companyId);
  }

  private async buildMediaCreate(
    companyId: string,
    media: MediaInput,
    position: number,
  ) {
    const sizeBytes = BigInt(media.sizeBytes);
    if (sizeBytes <= 0n) {
      throw new BadRequestException('media sizeBytes must be > 0');
    }
    this.assertMediaMime(media.mediaType, media.mimeType);

    let checksum = media.checksumSha256;
    if (!checksum) {
      const raw = media.contentBase64
        ? Buffer.from(media.contentBase64, 'base64')
        : Buffer.from(media.fileName);
      checksum = createHash('sha256').update(raw).digest('hex');
    }
    if (!/^[a-f0-9]{64}$/i.test(checksum)) {
      throw new BadRequestException('checksumSha256 must be 64 hex chars');
    }

    const folder = await this.companyFolder(companyId);
    return {
      companyId,
      mediaType: media.mediaType,
      fileName: media.fileName,
      mimeType: media.mimeType,
      sizeBytes,
      storageKey: `${folder}/marketing/${randomUUID()}-${media.fileName}`,
      checksumSha256: checksum.toLowerCase(),
      position,
    };
  }

  private assertMediaMime(mediaType: MarketingMediaType, mimeType: string) {
    if (mediaType === 'IMAGE' && !mimeType.startsWith('image/')) {
      throw new BadRequestException('IMAGE media requires an image/* mimeType');
    }
    if (mediaType === 'VIDEO' && !mimeType.startsWith('video/')) {
      throw new BadRequestException('VIDEO media requires a video/* mimeType');
    }
  }

  private serializeMedia(row: {
    id: string;
    companyId: string;
    marketingPostId: string;
    mediaType: MarketingMediaType;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    storageKey: string;
    checksumSha256: string | null;
    position: number;
    createdAt: Date;
  }) {
    return {
      ...row,
      sizeBytes: row.sizeBytes.toString(),
    };
  }

  private serializePost(row: {
    id: string;
    companyId: string;
    title: string | null;
    content: string;
    channel: MarketingChannel;
    status: MarketingPostStatus;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    archivedAt: Date | null;
    externalPostId: string | null;
    failureReason: string | null;
    publishMode: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    media?: Array<{
      id: string;
      companyId: string;
      marketingPostId: string;
      mediaType: MarketingMediaType;
      fileName: string;
      mimeType: string;
      sizeBytes: bigint;
      storageKey: string;
      checksumSha256: string | null;
      position: number;
      createdAt: Date;
    }>;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      content: row.content,
      channel: row.channel,
      status: row.status,
      scheduledAt: row.scheduledAt,
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      externalPostId: row.externalPostId,
      failureReason: row.failureReason,
      publishMode: row.publishMode,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      media: (row.media ?? []).map((m) => this.serializeMedia(m)),
    };
  }

  private serializeConnection(row: {
    id: string;
    companyId: string;
    channel: MarketingChannel;
    displayName: string;
    externalAccountId: string | null;
    status: MarketingConnectionStatus;
    credentialsCiphertext: Uint8Array | null;
    keyVersion: number | null;
    lastError: string | null;
    connectedAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      channel: row.channel,
      displayName: row.displayName,
      externalAccountId: row.externalAccountId,
      status: row.status,
      hasCredentials: Boolean(row.credentialsCiphertext),
      keyVersion: row.keyVersion,
      lastError: row.lastError,
      connectedAt: row.connectedAt,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // --- Attachments ---

  listAttachments(companyId: string, entityType?: string, entityId?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.attachment
      .findMany({
        where: {
          ...(entityType ? { entityType } : {}),
          ...(entityId ? { entityId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      .then((rows) => rows.map((row) => this.serializeAttachment(row)));
  }

  async getAttachment(companyId: string, attachmentId: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, companyId },
    });
    if (!row) throw new NotFoundException('Attachment not found');
    let contentBase64: string | undefined;
    try {
      const buf = await this.storage.getObject(row.storageKey);
      contentBase64 = buf.toString('base64');
    } catch {
      contentBase64 = undefined;
    }
    return {
      ...this.serializeAttachment(row),
      contentBase64,
      storageDriver: this.storage.activeDriver,
    };
  }

  async registerAttachment(input: {
    companyId: string;
    uploadedById: string;
    entityType: string;
    entityId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number | string;
    contentBase64?: string;
    checksumSha256?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const sizeBytes = BigInt(input.sizeBytes);
    if (sizeBytes <= 0n) {
      throw new BadRequestException('sizeBytes must be > 0');
    }

    const body = input.contentBase64
      ? Buffer.from(input.contentBase64, 'base64')
      : null;
    if (body && BigInt(body.length) !== sizeBytes) {
      throw new BadRequestException(
        'sizeBytes does not match contentBase64 length',
      );
    }

    let checksum = input.checksumSha256;
    if (!checksum) {
      const raw = body ?? Buffer.from(input.fileName);
      checksum = createHash('sha256').update(raw).digest('hex');
    }
    if (!/^[a-f0-9]{64}$/i.test(checksum)) {
      throw new BadRequestException('checksumSha256 must be 64 hex chars');
    }

    const folder = await this.companyFolder(input.companyId);
    const storageKey = `${folder}/${input.entityType}/${input.entityId}/${randomUUID()}-${input.fileName}`;
    let publicUrl: string | undefined;
    if (body) {
      const stored = await this.storage.putObject({
        storageKey,
        body,
        contentType: input.mimeType,
      });
      publicUrl = stored.publicUrl;
    }

    const created = await this.prisma.attachment.create({
      data: {
        companyId: input.companyId,
        uploadedById: input.uploadedById,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes,
        storageKey,
        checksumSha256: checksum.toLowerCase(),
      },
    });

    await this.emitAttachmentUploaded(input.companyId, created);

    return {
      ...this.serializeAttachment(created),
      publicUrl,
      storageDriver: this.storage.activeDriver,
      stored: Boolean(body),
    };
  }

  private async emitAttachmentUploaded(
    companyId: string,
    attachment: {
      id: string;
      entityType: string;
      entityId: string;
      fileName: string;
      uploadedById: string;
    },
  ) {
    const workTypes = new Set([
      'work_project',
      'work_task',
      'project',
      'task',
    ]);
    if (!workTypes.has(attachment.entityType)) return;

    let workProjectId: string | null = null;
    let ownerUserId: string | null = null;
    let projectName: string | null = null;

    if (
      attachment.entityType === 'work_project' ||
      attachment.entityType === 'project'
    ) {
      const project = await this.prisma.workProject.findFirst({
        where: { id: attachment.entityId, companyId },
        select: { id: true, name: true, ownerUserId: true },
      });
      workProjectId = project?.id ?? null;
      ownerUserId = project?.ownerUserId ?? null;
      projectName = project?.name ?? null;
    } else {
      const task = await this.prisma.workTask.findFirst({
        where: {
          id: attachment.entityId,
          workProject: { companyId },
        },
        include: {
          workProject: {
            select: { id: true, name: true, ownerUserId: true },
          },
        },
      });
      workProjectId = task?.workProject.id ?? null;
      ownerUserId = task?.workProject.ownerUserId ?? null;
      projectName = task?.workProject.name ?? null;
    }

    this.emit(companyId, 'attachments.uploaded', 'attachment', attachment.id, {
      attachmentId: attachment.id,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      fileName: attachment.fileName,
      uploadedById: attachment.uploadedById,
      workProjectId,
      projectName,
      ownerUserId,
      userId: ownerUserId,
    });
  }

  private serializeAttachment(row: {
    id: string;
    companyId: string;
    uploadedById: string;
    entityType: string;
    entityId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: bigint;
    storageKey: string;
    checksumSha256: string;
    createdAt: Date;
  }) {
    return {
      ...row,
      sizeBytes: row.sizeBytes.toString(),
    };
  }

  // --- AI usage ---

  listAiUsage(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.aiUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async logAiUsage(input: {
    companyId: string;
    userId?: string;
    module: string;
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: string | number;
    requestReference?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    const estimatedCost = Number(input.estimatedCost ?? 0);
    if (inputTokens < 0 || outputTokens < 0 || estimatedCost < 0) {
      throw new BadRequestException('token/cost values must be >= 0');
    }
    return this.prisma.aiUsageLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        module: input.module,
        provider: input.provider,
        model: input.model,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCost.toFixed(6),
        requestReference: input.requestReference,
      },
    });
  }

  async aiUsageSummary(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const rows = await this.prisma.aiUsageLog.findMany({
      select: {
        module: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
      take: 1000,
    });
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;
    const byModule: Record<
      string,
      { inputTokens: number; outputTokens: number; cost: number }
    > = {};
    for (const row of rows) {
      inputTokens += row.inputTokens;
      outputTokens += row.outputTokens;
      const rowCost = Number(row.estimatedCost);
      cost += rowCost;
      const bucket = byModule[row.module] ?? {
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      bucket.inputTokens += row.inputTokens;
      bucket.outputTokens += row.outputTokens;
      bucket.cost += rowCost;
      byModule[row.module] = bucket;
    }
    return {
      requests: rows.length,
      inputTokens,
      outputTokens,
      estimatedCost: cost.toFixed(6),
      byModule,
    };
  }
}
