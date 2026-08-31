import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessHoursMode,
  TwelveHourPeriodMode,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  SHIFTS_12H_FIXED,
  SHIFTS_12H_TWO_PERIODS,
  SHIFTS_24H_8H,
  ALL_STANDARD_SHIFTS,
  autoShiftLabel,
  displayShiftName,
  type StandardShiftDef,
} from './standard-shifts';

@Injectable()
export class BusinessHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  private profileInclude() {
    return {
      windows: { orderBy: { startsAt: 'asc' as const }, take: 50 },
      shifts: {
        where: { isActive: true },
        orderBy: { sequenceIndex: 'asc' as const },
      },
    };
  }

  async getProfile(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const profile = await this.prisma.companyBusinessHoursProfile.findUnique({
      where: { companyId },
      include: this.profileInclude(),
    });
    if (profile) {
      if (profile.mode === 'DYNAMIC') {
        await this.prisma.companyBusinessHoursProfile.update({
          where: { id: profile.id },
          data: { mode: 'HOURS_12' },
        });
        await this.prisma.workShift.updateMany({
          where: {
            companyId,
            businessHoursProfileId: profile.id,
            isActive: true,
          },
          data: { isActive: false },
        });
        await this.ensureTwelveHourShifts(companyId, {
          id: profile.id,
          defaultStartTime: profile.defaultStartTime,
          defaultEndTime: profile.defaultEndTime,
          twelveHourMode: profile.twelveHourMode,
          period2StartTime: profile.period2StartTime,
          period2EndTime: profile.period2EndTime,
        });
        return this.prisma.companyBusinessHoursProfile.findUniqueOrThrow({
          where: { id: profile.id },
          include: this.profileInclude(),
        });
      }
      if (profile.shifts.length === 0) {
        if (profile.mode === 'HOURS_12') {
          await this.ensureTwelveHourShifts(companyId, profile);
        } else if (profile.mode === 'HOURS_24' && profile.autoSplitShifts) {
          await this.generateShifts(companyId);
        }
        return this.prisma.companyBusinessHoursProfile.findUniqueOrThrow({
          where: { id: profile.id },
          include: this.profileInclude(),
        });
      }
      return profile;
    }
    const created = await this.prisma.companyBusinessHoursProfile.create({
      data: {
        companyId,
        mode: 'HOURS_12',
        defaultStartTime: '09:00',
        defaultEndTime: '21:00',
        twelveHourMode: 'FIXED',
      },
    });
    await this.ensureTwelveHourShifts(companyId, {
      id: created.id,
      defaultStartTime: created.defaultStartTime,
      defaultEndTime: created.defaultEndTime,
      twelveHourMode: created.twelveHourMode,
      period2StartTime: created.period2StartTime,
      period2EndTime: created.period2EndTime,
    });
    return this.prisma.companyBusinessHoursProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: this.profileInclude(),
    });
  }

  async upsertProfile(
    companyId: string,
    input: {
      mode?: BusinessHoursMode | string;
      defaultStartTime?: string;
      defaultEndTime?: string;
      autoSplitShifts?: boolean;
      autoShiftHours?: number;
      twelveHourMode?: TwelveHourPeriodMode | string;
      period2StartTime?: string | null;
      period2EndTime?: string | null;
      notes?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const mode = (input.mode as BusinessHoursMode) ?? 'HOURS_12';
    if (!['HOURS_24', 'HOURS_12'].includes(mode)) {
      throw new BadRequestException(
        'Invalid business hours mode — use HOURS_24 or HOURS_12',
      );
    }
    const profile = await this.prisma.companyBusinessHoursProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        mode,
        defaultStartTime: input.defaultStartTime ?? '09:00',
        defaultEndTime: input.defaultEndTime ?? '21:00',
        autoSplitShifts: input.autoSplitShifts ?? true,
        autoShiftHours: input.autoShiftHours ?? 8,
        twelveHourMode:
          (input.twelveHourMode as TwelveHourPeriodMode) ?? 'FIXED',
        period2StartTime: input.period2StartTime ?? undefined,
        period2EndTime: input.period2EndTime ?? undefined,
        notes: input.notes ?? undefined,
      },
      update: {
        ...(input.mode ? { mode } : {}),
        ...(input.defaultStartTime
          ? { defaultStartTime: input.defaultStartTime }
          : {}),
        ...(input.defaultEndTime
          ? { defaultEndTime: input.defaultEndTime }
          : {}),
        ...(input.autoSplitShifts !== undefined
          ? { autoSplitShifts: input.autoSplitShifts }
          : {}),
        ...(input.autoShiftHours !== undefined
          ? { autoShiftHours: input.autoShiftHours }
          : {}),
        ...(input.twelveHourMode
          ? {
              twelveHourMode:
                input.twelveHourMode as TwelveHourPeriodMode,
            }
          : {}),
        ...(input.period2StartTime !== undefined
          ? { period2StartTime: input.period2StartTime }
          : {}),
        ...(input.period2EndTime !== undefined
          ? { period2EndTime: input.period2EndTime }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (profile.mode === 'HOURS_12') {
      await this.ensureTwelveHourShifts(companyId, profile);
    } else if (profile.mode === 'HOURS_24' && profile.autoSplitShifts) {
      const active = await this.prisma.workShift.count({
        where: {
          companyId,
          businessHoursProfileId: profile.id,
          isActive: true,
        },
      });
      if (active === 0) {
        await this.generateShifts(companyId);
      }
    }

    return this.prisma.companyBusinessHoursProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: this.profileInclude(),
    });
  }

  /** Ensure HOURS_12 profile has roster shifts HR can assign at hire. */
  private async ensureTwelveHourShifts(
    companyId: string,
    profile: {
      id: string;
      defaultStartTime: string;
      defaultEndTime: string;
      twelveHourMode: TwelveHourPeriodMode | string;
      period2StartTime: string | null;
      period2EndTime: string | null;
    },
  ) {
    const existing = await this.prisma.workShift.count({
      where: {
        companyId,
        businessHoursProfileId: profile.id,
        isActive: true,
      },
    });
    if (existing > 0) return;

    const defs =
      profile.twelveHourMode === 'TWO_PERIODS'
        ? SHIFTS_12H_TWO_PERIODS.map((d, i) =>
            i === 0
              ? {
                  ...d,
                  startTime: profile.defaultStartTime,
                  endTime: profile.defaultEndTime,
                }
              : {
                  ...d,
                  startTime: profile.period2StartTime ?? d.startTime,
                  endTime: profile.period2EndTime ?? d.endTime,
                },
          )
        : [
            {
              ...SHIFTS_12H_FIXED[0]!,
              startTime: profile.defaultStartTime,
              endTime: profile.defaultEndTime,
            },
          ];

    await this.replaceActiveShifts(companyId, profile.id, defs);
  }

  /**
   * Install the standard roster: 24h sequential + 12h fixed + 12h two periods.
   */
  async installStandardShifts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    let profile = await this.prisma.companyBusinessHoursProfile.findUnique({
      where: { companyId },
    });
    if (!profile) {
      profile = await this.prisma.companyBusinessHoursProfile.create({
        data: {
          companyId,
          mode: 'HOURS_24',
          defaultStartTime: '06:00',
          defaultEndTime: '06:00',
          autoSplitShifts: true,
          autoShiftHours: 8,
          twelveHourMode: 'TWO_PERIODS',
          period2StartTime: '20:00',
          period2EndTime: '08:00',
          notes: 'كتالوج الورديات: دوام 24 + دوام 12 (ثابت/فترتين)',
        },
      });
    } else {
      profile = await this.prisma.companyBusinessHoursProfile.update({
        where: { id: profile.id },
        data: {
          mode: profile.mode === 'DYNAMIC' ? 'HOURS_12' : profile.mode,
          twelveHourMode: 'TWO_PERIODS',
          period2StartTime: profile.period2StartTime ?? '20:00',
          period2EndTime: profile.period2EndTime ?? '08:00',
          notes: 'كتالوج الورديات: دوام 24 + دوام 12 (ثابت/فترتين)',
        },
      });
    }

    const created = await this.replaceActiveShifts(
      companyId,
      profile.id,
      ALL_STANDARD_SHIFTS,
    );
    return {
      profileId: profile.id,
      modePacks: ['HOURS_24', 'HOURS_12_FIXED', 'HOURS_12_TWO'],
      shifts: created,
    };
  }

  async addWindow(
    companyId: string,
    input: { label?: string; startsAt: string; endsAt: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const profile = await this.getProfile(companyId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!(startsAt < endsAt)) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
    return this.prisma.dynamicHoursWindow.create({
      data: {
        companyId,
        profileId: profile.id,
        label: input.label,
        startsAt,
        endsAt,
      },
    });
  }

  async deleteWindow(companyId: string, windowId: string) {
    this.tenant.setCompanyId(companyId);
    const row = await this.prisma.dynamicHoursWindow.findFirst({
      where: { id: windowId, companyId },
    });
    if (!row) throw new NotFoundException('Window not found');
    await this.prisma.dynamicHoursWindow.delete({ where: { id: windowId } });
    return { ok: true };
  }

  /**
   * Auto-generate sequential WorkShift rows for HOURS_24 profiles.
   * When start=06:00 and hours=8, uses named morning/evening/night roster.
   */
  async generateShifts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    let profile = await this.prisma.companyBusinessHoursProfile.findUnique({
      where: { companyId },
    });
    if (!profile) {
      profile = await this.prisma.companyBusinessHoursProfile.create({
        data: {
          companyId,
          mode: 'HOURS_24',
          defaultStartTime: '06:00',
          defaultEndTime: '06:00',
          autoSplitShifts: true,
          autoShiftHours: 8,
        },
      });
    }
    if (profile.mode !== 'HOURS_24') {
      throw new BadRequestException(
        'generate-shifts is only for HOURS_24 mode',
      );
    }
    const hours = Math.max(1, Math.min(24, profile.autoShiftHours || 8));
    const startHm = profile.defaultStartTime;

    let defs: StandardShiftDef[];
    if (hours === 8 && (startHm === '06:00' || startHm === '6:00')) {
      defs = SHIFTS_24H_8H;
    } else if (hours === 8 && (startHm === '00:00' || startHm === '0:00')) {
      defs = SHIFTS_24H_8H.map((d, i) => {
        const starts = ['00:00', '08:00', '16:00'] as const;
        const ends = ['08:00', '16:00', '00:00'] as const;
        return {
          ...d,
          startTime: starts[i]!,
          endTime: ends[i]!,
          crossesMidnight: i === 2,
          nameAr: autoShiftLabel(i, 'ar'),
          nameEn: autoShiftLabel(i, 'en'),
        };
      });
    } else {
      const start = this.parseHm(startHm);
      defs = [];
      let cursor = start;
      let index = 0;
      const dayMinutes = 24 * 60;
      while (index * hours < 24) {
        const end = (cursor + hours * 60) % dayMinutes;
        const crosses = cursor + hours * 60 >= dayMinutes;
        defs.push({
          code: `S${index + 1}`,
          modePack: 'HOURS_24',
          nameAr: autoShiftLabel(index, 'ar'),
          nameEn: autoShiftLabel(index, 'en'),
          startTime: this.formatHm(cursor),
          endTime: this.formatHm(end),
          sequenceIndex: index,
          crossesMidnight: crosses,
        });
        cursor = end;
        index += 1;
        if (index > 24) break;
      }
    }

    const created = await this.replaceActiveShifts(
      companyId,
      profile.id,
      defs,
    );
    return { profileId: profile.id, shifts: created };
  }

  private async replaceActiveShifts(
    companyId: string,
    profileId: string,
    defs: StandardShiftDef[],
  ) {
    await this.prisma.workShift.updateMany({
      where: {
        companyId,
        businessHoursProfileId: profileId,
      },
      data: { isActive: false },
    });

    const created: Array<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      sequenceIndex: number;
      crossesMidnight: boolean;
    }> = [];
    for (const d of defs) {
      const row = await this.prisma.workShift.create({
        data: {
          companyId,
          businessHoursProfileId: profileId,
          name: displayShiftName(d, 'ar'),
          startTime: d.startTime,
          endTime: d.endTime,
          sequenceIndex: d.sequenceIndex,
          crossesMidnight: d.crossesMidnight ?? false,
          isActive: true,
        },
      });
      created.push({
        id: row.id,
        name: row.name,
        startTime: row.startTime,
        endTime: row.endTime,
        sequenceIndex: row.sequenceIndex,
        crossesMidnight: row.crossesMidnight,
      });
    }
    return created;
  }

  private parseHm(value: string): number {
    const [h, m] = value.split(':').map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      throw new BadRequestException(`Invalid time: ${value}`);
    }
    return h * 60 + m;
  }

  private formatHm(totalMinutes: number): string {
    const m = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
}
