/**
 * Seeds all three business-hours mode packs from the governance شرح:
 * 1) HOURS_24 sequential shifts
 * 2) HOURS_12 fixed + two periods
 * 3) DYNAMIC flexible templates + sample datetime windows
 */
import type { PrismaClient } from '../src/generated/prisma/client';
import {
  ALL_STANDARD_SHIFTS,
  displayShiftName,
} from '../src/modules/governance/standard-shifts';

export async function seedStandardWorkShifts(
  prisma: PrismaClient,
  companyId: string,
): Promise<{
  profileId: string;
  shiftCount: number;
  windowCount: number;
}> {
  const profile = await prisma.companyBusinessHoursProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      mode: 'HOURS_24',
      defaultStartTime: '06:00',
      defaultEndTime: '06:00',
      autoSplitShifts: true,
      autoShiftHours: 8,
      twelveHourMode: 'TWO_PERIODS',
      period2StartTime: '20:00',
      period2EndTime: '08:00',
      notes:
        'كتالوج الشرح كامل: دوام 24 + دوام 12 (ثابت/فترتين) + دوام مرن (قوالب ونوافذ)',
    },
    update: {
      mode: 'HOURS_24',
      defaultStartTime: '06:00',
      defaultEndTime: '06:00',
      autoSplitShifts: true,
      autoShiftHours: 8,
      twelveHourMode: 'TWO_PERIODS',
      period2StartTime: '20:00',
      period2EndTime: '08:00',
      notes:
        'كتالوج الشرح كامل: دوام 24 + دوام 12 (ثابت/فترتين) + دوام مرن (قوالب ونوافذ)',
    },
  });

  await prisma.workShift.updateMany({
    where: { companyId },
    data: { isActive: false },
  });

  let shiftCount = 0;
  for (const d of ALL_STANDARD_SHIFTS) {
    const name = displayShiftName(d, 'ar');
    const existing = await prisma.workShift.findFirst({
      where: {
        companyId,
        name,
        startTime: d.startTime,
        endTime: d.endTime,
      },
    });
    if (existing) {
      await prisma.workShift.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          businessHoursProfileId: profile.id,
          sequenceIndex: d.sequenceIndex,
          crossesMidnight: d.crossesMidnight ?? false,
        },
      });
    } else {
      await prisma.workShift.create({
        data: {
          companyId,
          businessHoursProfileId: profile.id,
          name,
          startTime: d.startTime,
          endTime: d.endTime,
          sequenceIndex: d.sequenceIndex,
          crossesMidnight: d.crossesMidnight ?? false,
          isActive: true,
        },
      });
    }
    shiftCount += 1;
  }

  // Sample DYNAMIC windows (free start/end datetime) — next 7–14 days
  const now = new Date();
  const day = (offset: number, hour: number, minute = 0) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + offset);
    x.setUTCHours(hour, minute, 0, 0);
    return x;
  };

  const windows: Array<{ label: string; startsAt: Date; endsAt: Date }> = [
    {
      label: 'دوام مرن — نافذة فعالية (8 ساعات)',
      startsAt: day(2, 10, 0),
      endsAt: day(2, 18, 0),
    },
    {
      label: 'دوام مرن — نافذة موسم (14 ساعة)',
      startsAt: day(5, 8, 0),
      endsAt: day(5, 22, 0),
    },
    {
      label: 'دوام مرن — نافذة ممتدة (16 ساعة)',
      startsAt: day(9, 6, 0),
      endsAt: day(9, 22, 0),
    },
  ];

  let windowCount = 0;
  for (const w of windows) {
    const existing = await prisma.dynamicHoursWindow.findFirst({
      where: { companyId, profileId: profile.id, label: w.label },
    });
    if (existing) {
      await prisma.dynamicHoursWindow.update({
        where: { id: existing.id },
        data: { startsAt: w.startsAt, endsAt: w.endsAt },
      });
    } else {
      await prisma.dynamicHoursWindow.create({
        data: {
          companyId,
          profileId: profile.id,
          label: w.label,
          startsAt: w.startsAt,
          endsAt: w.endsAt,
        },
      });
    }
    windowCount += 1;
  }

  return { profileId: profile.id, shiftCount, windowCount };
}
