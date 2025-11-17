import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { eachDayOfInterval, isWeekend } from 'date-fns';

@Injectable()
export class RecesoService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly holidayPeriodRepository: Repository<GeneralHolidayPeriod>
  ) { }

  async getHolidayPeriods(year: number) {
    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: {
        year,
      },
    });

    return { holidayPeriods };
  }
  async getHolidayPeriodsForPersonalYear(userStartDate: Date, userEndDate: Date) {
    console.log('[RecesoService] ===============================');
    console.log('[RecesoService] Inicio getHolidayPeriodsForPersonalYear');
    console.log(`[RecesoService] userStartDate: ${userStartDate.toISOString()}`);
    console.log(`[RecesoService] userEndDate: ${userEndDate.toISOString()}`);

    // Obtener recesos que intersectan
    const holidayPeriods = await this.holidayPeriodRepository.find({
      where: [
        {
          startDate: LessThanOrEqual(userEndDate),
          endDate: MoreThanOrEqual(userStartDate)
        }
      ],
      order: { startDate: 'ASC' },
    });

    console.log(`[RecesoService] Recesos que intersectan: ${holidayPeriods.length}`);

    // Filtrar recesos que tengan al menos un día dentro del rango
    const relevantRecesses = holidayPeriods.filter(receso => {
      const overlapStart = receso.startDate < userStartDate ? userStartDate : receso.startDate;
      const overlapEnd = receso.endDate > userEndDate ? userEndDate : receso.endDate;
      const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      console.log(`[RecesoService] ${receso.name} - Días superposición: ${overlapDays}`);
      return overlapDays > 0; // incluir cualquier receso que tenga intersección con el año laboral
    });

    console.log(`[RecesoService] Recesos relevantes después de filtro: ${relevantRecesses.length}`);

    // Ajustar fechas y calcular días hábiles
    const adjustedRecesses = relevantRecesses.map(receso => {
      const adjustedStart = receso.startDate < userStartDate ? userStartDate : receso.startDate;
      const adjustedEnd = receso.endDate > userEndDate ? userEndDate : receso.endDate;

      const allDays = eachDayOfInterval({ start: adjustedStart, end: adjustedEnd });
      const businessDays = allDays.filter(date => !isWeekend(date)).length;

      console.log(`[RecesoService] "${receso.name}" -> ${adjustedStart.toISOString().split('T')[0]} a ${adjustedEnd.toISOString().split('T')[0]} (${businessDays} días hábiles)`);

      return {
        ...receso,
        startDate: adjustedStart,
        endDate: adjustedEnd,
        businessDays: businessDays
      };
    });

    console.log('[RecesoService] ===============================');
    return adjustedRecesses;
  }

}
