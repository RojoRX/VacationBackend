import { Injectable } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { InjectRepository } from '@nestjs/typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { HalfDayType, License } from 'src/entities/license.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';

@Injectable()
export class LicenseUtilsService {
  constructor(
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>,
  ) {}

  // 🔹 Calcula los días hábiles reales y devuelve también los feriados detectados
  async calculateEffectiveDaysWithHolidays(
    startDate: string,
    endDate: string,
    startHalfDay?: HalfDayType,
    endHalfDay?: HalfDayType,
  ) {
    const holidays = await this.nonHolidayRepository.find({
      where: { date: Between(startDate, endDate) },
    });

    let totalDays = this.calculateDaysConsideringHalfDays(startDate, endDate, startHalfDay, endHalfDay);

    if (!holidays.length) {
      return { totalDays, detectedHolidays: [] };
    }

    for (const holiday of holidays) {
      const holidayDate = parseISO(holiday.date);

      if (startDate === endDate && (startHalfDay === 'Media Mañana' || startHalfDay === 'Media Tarde')) {
        if (isSameDay(holidayDate, parseISO(startDate))) {
          totalDays = 0;
          continue;
        }
      }

      if (isSameDay(holidayDate, parseISO(startDate))) {
        totalDays -= startHalfDay && startHalfDay !== 'Completo' ? 0.5 : 1;
        continue;
      }

      if (isSameDay(holidayDate, parseISO(endDate))) {
        totalDays -= endHalfDay && endHalfDay !== 'Completo' ? 0.5 : 1;
        continue;
      }

      totalDays -= 1;
    }

    totalDays = Math.max(totalDays, 0);

    return { totalDays, detectedHolidays: holidays };
  }

  // 🔹 Calcula los días totales considerando medias jornadas
private calculateDaysConsideringHalfDays(
  startDate: string,
  endDate: string,
  startHalfDay?: HalfDayType,
  endHalfDay?: HalfDayType,
): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Caso: mismo día
  if (startDate === endDate) {
    return (startHalfDay === 'Media Mañana' || startHalfDay === 'Media Tarde') ? 0.5 : 1;
  }

  // Calcular cantidad de días naturales
  const allDays = eachDayOfInterval({ start, end });
  const totalNaturalDays = allDays.length;

  // Ajustar por medias jornadas
  let adjustment = 0;
  
  if (startHalfDay && startHalfDay !== 'Completo') adjustment += 0.5;
  if (endHalfDay && endHalfDay !== 'Completo') adjustment += 0.5;

  const totalDays = totalNaturalDays - adjustment;
  
  return Math.max(totalDays, 0);
}

  // 🔹 NUEVO: Mapea una licencia a LicenseResponseDto con totalDays dinámico y feriados
  async mapLicenseToDtoWithHolidays(license: License): Promise<LicenseResponseDto> {
    const { totalDays, detectedHolidays } =
      await this.calculateEffectiveDaysWithHolidays(
        license.startDate,
        license.endDate,
        license.startHalfDay,
        license.endHalfDay,
      );

    return {
      id: license.id,
      licenseType: license.licenseType,
      timeRequested: license.timeRequested,
      startDate: license.startDate,
      endDate: license.endDate,
      issuedDate: license.issuedDate,
      immediateSupervisorApproval: license.immediateSupervisorApproval,
      personalDepartmentApproval: license.personalDepartmentApproval,
      userId: license.user.id,
      approvedBySupervisorId: license.approvedBySupervisor?.id ?? null,
      deleted: license.deleted,
      startHalfDay: license.startHalfDay,
      endHalfDay: license.endHalfDay,
      totalDays,
      detectedHolidays: detectedHolidays.map(h => ({
        date: h.date,
        year: h.year,
        description: h.description,
      })),
    };
  }
}
