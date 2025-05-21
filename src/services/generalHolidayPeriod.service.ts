import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { Repository, Not, Between, Brackets } from 'typeorm';
import { HolidayPeriodName } from 'src/entities/generalHolidayPeriod.entity';
import { CreateGeneralHolidayPeriodDto } from 'src/dto/create-general-holiday-period.dto';
import { format } from 'date-fns';
import { normalizeToMidnight } from 'src/utils/dateMidnight.utils';

@Injectable()
export class GeneralHolidayPeriodService {
  constructor(
    @InjectRepository(GeneralHolidayPeriod)
    private readonly generalHolidayPeriodRepository: Repository<GeneralHolidayPeriod>,
  ) { }


  async createGeneralHolidayPeriod(dto: CreateGeneralHolidayPeriodDto): Promise<GeneralHolidayPeriod> {
    if (!dto.name || !dto.startDate || !dto.endDate) {
      throw new BadRequestException('Todos los campos son obligatorios (excepto el año, que se calculará automáticamente).');
    }

    if (!Object.values(HolidayPeriodName).includes(dto.name as HolidayPeriodName)) {
      throw new BadRequestException(`El nombre del receso debe ser uno de los siguientes: ${Object.values(HolidayPeriodName).join(', ')}`);
    }

    console.log(`Antes de almacenar (como timestamp): ${dto.startDate} - ${dto.endDate}`);

    // Función para normalizar a medianoche (00:00:00)
    const normalizeToMidnight = (dateStr: string): string => {
      const date = new Date(dateStr);
      const normalized = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ));
      return normalized.toISOString().slice(0, 19).replace('T', ' ');
    };

    const startDateToStore = normalizeToMidnight(dto.startDate);
    const endDateToStore = normalizeToMidnight(dto.endDate);

    console.log(`Después de formatear para almacenar: ${startDateToStore} - ${endDateToStore}`);

    const startForValidation = new Date(startDateToStore);
    const endForValidation = new Date(endDateToStore);

    if (isNaN(startForValidation.getTime()) || isNaN(endForValidation.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas.');
    }

    if (startForValidation >= endForValidation) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    const duration = (endForValidation.getTime() - startForValidation.getTime()) / (1000 * 60 * 60 * 24);
    if (duration > 30) {
      throw new BadRequestException('El receso no puede exceder los 30 días.');
    }

    const year = startForValidation.getUTCFullYear();

    if (year < 2000 || year > 2100) {
      throw new BadRequestException('El año del receso debe estar entre 2000 y 2100.');
    }

    // Validación simplificada de duplicados (solo por nombre y año)
    const existingByName = await this.generalHolidayPeriodRepository.findOne({
      where: {
        year,
        name: dto.name as HolidayPeriodName
      }
    });

    if (existingByName) {
      throw new BadRequestException(
        `Ya existe un receso general de "${dto.name}" para el año ${year}. ` +
        `ID existente: ${existingByName.id} (${existingByName.startDate} a ${existingByName.endDate})`
      );
    }

    // Validación de superposición mejorada
    const overlapping = await this.generalHolidayPeriodRepository
      .createQueryBuilder('period')
      .where('period.year = :year', { year })
      .andWhere(new Brackets(qb => {
        qb.where('period.startDate BETWEEN :start AND :end')
          .orWhere('period.endDate BETWEEN :start AND :end')
          .orWhere(':start BETWEEN period.startDate AND period.endDate')
          .orWhere(':end BETWEEN period.startDate AND period.endDate');
      }))
      .setParameters({
        start: startDateToStore,
        end: endDateToStore
      })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `Las fechas se superponen con otro receso existente (ID: ${overlapping.id}). ` +
        `Rango existente: ${overlapping.startDate} a ${overlapping.endDate}`
      );
    }

    const newPeriod = this.generalHolidayPeriodRepository.create({
      ...dto,
      name: dto.name as HolidayPeriodName,
      startDate: startDateToStore,
      endDate: endDateToStore,
      year,
    });

    return this.generalHolidayPeriodRepository.save(newPeriod);
  }

  // Obtener todos los recesos para un año específico
  async getGeneralHolidayPeriods(year: number): Promise<GeneralHolidayPeriod[]> {
    const periods = await this.generalHolidayPeriodRepository.find({ where: { year } });

    if (!periods.length) {
      throw new NotFoundException(`No se encontraron recesos generales para el año ${year}.`);
    }

    return periods;
  }

  // Obtener todos los recesos existentes (sin filtrar por año)
  async getAllGeneralHolidayPeriods(): Promise<GeneralHolidayPeriod[]> {
    return this.generalHolidayPeriodRepository.find();
  }


  // Actualizar un receso general existente
async updateGeneralHolidayPeriod(
  id: number,
  holidayPeriod: GeneralHolidayPeriod
): Promise<GeneralHolidayPeriod> {
  console.log('[DEBUG] Inicio de updateGeneralHolidayPeriod', { id, holidayPeriod });

  try {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });
    console.log('[DEBUG] Período existente:', existingPeriod);

    if (!existingPeriod) {
      console.error('[ERROR] Período no encontrado con id:', id);
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    // Depuración de fechas recibidas
    console.log('[DEBUG] Fechas recibidas - raw:', {
      startDate: holidayPeriod.startDate,
      endDate: holidayPeriod.endDate,
      startDateType: typeof holidayPeriod.startDate,
      endDateType: typeof holidayPeriod.endDate
    });

    // Convertir a objetos Date si vienen como strings
    const startRaw = typeof holidayPeriod.startDate === 'string'
      ? new Date(holidayPeriod.startDate)
      : holidayPeriod.startDate;

    const endRaw = typeof holidayPeriod.endDate === 'string'
      ? new Date(holidayPeriod.endDate)
      : holidayPeriod.endDate;

    console.log('[DEBUG] Fechas convertidas a Date:', { startRaw, endRaw });

    // Normalizar a medianoche
    const startDateNormalized = normalizeToMidnight(startRaw.toISOString());
    const endDateNormalized = normalizeToMidnight(endRaw.toISOString());
    console.log('[DEBUG] Fechas normalizadas:', { startDateNormalized, endDateNormalized });

    const start = new Date(startDateNormalized);
    const end = new Date(endDateNormalized);
    console.log('[DEBUG] Objetos Date creados:', { start, end });

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('[ERROR] Fechas inválidas:', { start, end });
      throw new BadRequestException('Las fechas deben ser válidas.');
    }

    const year = start.getFullYear();
    console.log('[DEBUG] Año calculado:', year);

    if (start >= end) {
      console.error('[ERROR] Fecha inicio >= fin:', { start, end });
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    console.log('[DEBUG] Duración calculada (días):', duration);

    if (duration > 30) {
      console.error('[ERROR] Duración excede 30 días:', duration);
      throw new BadRequestException('El receso no puede exceder los 30 días.');
    }

    // Validación de nombre duplicado
    const conflictingPeriod = await this.generalHolidayPeriodRepository.findOne({
      where: { year, name: holidayPeriod.name, id: Not(id) },
    });
    console.log('[DEBUG] Conflicto por nombre:', conflictingPeriod);

    if (conflictingPeriod) {
      console.error('[ERROR] Conflicto encontrado con período:', conflictingPeriod.id);
      throw new BadRequestException(`Ya existe un receso general de "${holidayPeriod.name}" para el año ${year}.`);
    }

    // Validación de solapamiento
    console.log('[DEBUG] Buscando solapamientos...');
    const overlapping = await this.generalHolidayPeriodRepository
      .createQueryBuilder('period')
      .where('period.year = :year', { year })
      .andWhere('period.id != :id', { id })
      .andWhere(new Brackets(qb => {
        qb.where('period.startDate BETWEEN :start AND :end')
          .orWhere('period.endDate BETWEEN :start AND :end')
          .orWhere(':start BETWEEN period.startDate AND period.endDate')
          .orWhere(':end BETWEEN period.startDate AND period.endDate');
      }))
      .setParameters({
        start: startDateNormalized,
        end: endDateNormalized
      })
      .getOne();

    console.log('[DEBUG] Resultado de solapamiento:', overlapping);
    if (overlapping) {
      console.error('[ERROR] Solapamiento encontrado con período:', overlapping.id);
      throw new BadRequestException(
        `Las fechas se superponen con otro receso existente (ID: ${overlapping.id}). ` +
        `Rango existente: ${overlapping.startDate} a ${overlapping.endDate}`
      );
    }

    // Preparar datos actualizados
    const updatedPeriod = {
      ...holidayPeriod,
      year,
      startDate: startDateNormalized,
      endDate: endDateNormalized,
    };

    console.log('[DEBUG] Datos para actualizar:', updatedPeriod);

    await this.generalHolidayPeriodRepository.update(id, updatedPeriod);
    console.log('[DEBUG] Actualización completada, buscando período actualizado...');

    const updated = await this.generalHolidayPeriodRepository.findOne({ where: { id } });
    console.log('[DEBUG] Período actualizado:', updated);

    return updated;

  } catch (error) {
    console.error('[ERROR] En updateGeneralHolidayPeriod:', {
      error: error.message,
      stack: error.stack,
      input: { id, holidayPeriod }
    });
    throw error;
  }
}

  // Eliminar un receso general
  async deleteGeneralHolidayPeriod(id: number): Promise<void> {
    const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso con id ${id} no encontrado.`);
    }

    await this.generalHolidayPeriodRepository.delete(id);
  }


}
