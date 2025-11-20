import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Brackets, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AdministrativeHolidayPeriod, AdministrativeHolidayName } from 'src/entities/administrativeHolidayPeriod.entity';
import { CreateAdministrativeHolidayPeriodDto } from 'src/dto/create-administrative-holiday-period.dto';
import { normalizeToMidnight } from 'src/utils/dateMidnight.utils';
import { eachDayOfInterval, isWeekend } from 'date-fns';
@Injectable()
export class AdministrativeHolidayPeriodService {
  constructor(
    @InjectRepository(AdministrativeHolidayPeriod)
    private readonly administrativeHolidayRepository: Repository<AdministrativeHolidayPeriod>,
  ) { }

  // ✅ Crear un nuevo receso administrativo
  async createAdministrativeHolidayPeriod(dto: CreateAdministrativeHolidayPeriodDto): Promise<AdministrativeHolidayPeriod> {
    if (!dto.name || !dto.startDate || !dto.endDate) {
      throw new BadRequestException('Todos los campos son obligatorios (excepto el año, que se calculará automáticamente).');
    }

    if (!Object.values(AdministrativeHolidayName).includes(dto.name as AdministrativeHolidayName)) {
      throw new BadRequestException(`El nombre del receso debe ser uno de los siguientes: ${Object.values(AdministrativeHolidayName).join(', ')}`);
    }

    const startDateToStore = normalizeToMidnight(dto.startDate);
    const endDateToStore = normalizeToMidnight(dto.endDate);

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

    // Validación: no debe existir otro receso del mismo tipo y año
    const existingByName = await this.administrativeHolidayRepository.findOne({
      where: {
        year,
        name: dto.name as AdministrativeHolidayName
      }
    });

    if (existingByName) {
      throw new BadRequestException(
        `Ya existe un receso administrativo de "${dto.name}" para el año ${year}. ` +
        `ID existente: ${existingByName.id} (${existingByName.startDate} a ${existingByName.endDate})`
      );
    }

    // Validar superposición con otros recesos del mismo año
    const overlapping = await this.administrativeHolidayRepository
      .createQueryBuilder('period')
      .where('period.year = :year', { year })
      .andWhere(new Brackets(qb => {
        qb.where('period.startDate BETWEEN :start AND :end')
          .orWhere('period.endDate BETWEEN :start AND :end')
          .orWhere(':start BETWEEN period.startDate AND period.endDate')
          .orWhere(':end BETWEEN period.startDate AND period.endDate');
      }))
      .setParameters({ start: startDateToStore, end: endDateToStore })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `Las fechas se superponen con otro receso existente (ID: ${overlapping.id}). ` +
        `Rango existente: ${overlapping.startDate} a ${overlapping.endDate}`
      );
    }

    const newPeriod = this.administrativeHolidayRepository.create({
      ...dto,
      name: dto.name as AdministrativeHolidayName,
      startDate: startDateToStore,
      endDate: endDateToStore,
      year,
    });

    return this.administrativeHolidayRepository.save(newPeriod);
  }

  // ✅ Obtener recesos por año
  async getAdministrativeHolidayPeriods(year: number): Promise<AdministrativeHolidayPeriod[]> {
    const periods = await this.administrativeHolidayRepository.find({ where: { year } });

    if (!periods.length) {
      throw new NotFoundException(`No se encontraron recesos administrativos para el año ${year}.`);
    }

    return periods;
  }

  // ✅ Obtener todos los recesos
  async getAllAdministrativeHolidayPeriods(): Promise<AdministrativeHolidayPeriod[]> {
    return this.administrativeHolidayRepository.find();
  }

  // ✅ Actualizar receso existente
  async updateAdministrativeHolidayPeriod(
    id: number,
    holidayPeriod: AdministrativeHolidayPeriod
  ): Promise<AdministrativeHolidayPeriod> {
    const existingPeriod = await this.administrativeHolidayRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso administrativo con id ${id} no encontrado.`);
    }

    const startRaw = typeof holidayPeriod.startDate === 'string'
      ? new Date(holidayPeriod.startDate)
      : holidayPeriod.startDate;

    const endRaw = typeof holidayPeriod.endDate === 'string'
      ? new Date(holidayPeriod.endDate)
      : holidayPeriod.endDate;

    const startDateNormalized = normalizeToMidnight(startRaw.toISOString());
    const endDateNormalized = normalizeToMidnight(endRaw.toISOString());

    const start = new Date(startDateNormalized);
    const end = new Date(endDateNormalized);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas.');
    }

    const year = start.getFullYear();

    if (start >= end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (duration > 30) {
      throw new BadRequestException('El receso no puede exceder los 30 días.');
    }

    const conflictingPeriod = await this.administrativeHolidayRepository.findOne({
      where: { year, name: holidayPeriod.name, id: Not(id) },
    });

    if (conflictingPeriod) {
      throw new BadRequestException(`Ya existe un receso administrativo de "${holidayPeriod.name}" para el año ${year}.`);
    }

    const overlapping = await this.administrativeHolidayRepository
      .createQueryBuilder('period')
      .where('period.year = :year', { year })
      .andWhere('period.id != :id', { id })
      .andWhere(new Brackets(qb => {
        qb.where('period.startDate BETWEEN :start AND :end')
          .orWhere('period.endDate BETWEEN :start AND :end')
          .orWhere(':start BETWEEN period.startDate AND period.endDate')
          .orWhere(':end BETWEEN period.startDate AND period.endDate');
      }))
      .setParameters({ start: startDateNormalized, end: endDateNormalized })
      .getOne();

    if (overlapping) {
      throw new BadRequestException(
        `Las fechas se superponen con otro receso existente (ID: ${overlapping.id}). ` +
        `Rango existente: ${overlapping.startDate} a ${overlapping.endDate}`
      );
    }

    const updatedPeriod = {
      ...holidayPeriod,
      year,
      startDate: startDateNormalized,
      endDate: endDateNormalized,
    };

    await this.administrativeHolidayRepository.update(id, updatedPeriod);
    return this.administrativeHolidayRepository.findOne({ where: { id } });
  }

  // ✅ Eliminar receso administrativo
  async deleteAdministrativeHolidayPeriod(id: number): Promise<void> {
    const existingPeriod = await this.administrativeHolidayRepository.findOne({ where: { id } });

    if (!existingPeriod) {
      throw new NotFoundException(`Receso administrativo con id ${id} no encontrado.`);
    }

    await this.administrativeHolidayRepository.delete(id);
  }

  async getHolidayPeriodsForPersonalYear(userStartDate: Date, userEndDate: Date) {

    // Obtener recesos que intersectan
    const holidayPeriods = await this.administrativeHolidayRepository.find({
      where: [
        {
          startDate: LessThanOrEqual(userEndDate),
          endDate: MoreThanOrEqual(userStartDate)
        }
      ],
      order: { startDate: 'ASC' },
    });


    // Filtrar recesos que tengan al menos un día dentro del rango
    const relevantRecesses = holidayPeriods.filter(receso => {
      const overlapStart = receso.startDate < userStartDate ? userStartDate : receso.startDate;
      const overlapEnd = receso.endDate > userEndDate ? userEndDate : receso.endDate;
      const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      console.log(`[RecesoService] ${receso.name} - Días superposición: ${overlapDays}`);
      return overlapDays > 0; // incluir cualquier receso que tenga intersección con el año laboral
    });


    // Ajustar fechas y calcular días hábiles
    const adjustedRecesses = relevantRecesses.map(receso => {
      const adjustedStart = receso.startDate < userStartDate ? userStartDate : receso.startDate;
      const adjustedEnd = receso.endDate > userEndDate ? userEndDate : receso.endDate;

      const allDays = eachDayOfInterval({ start: adjustedStart, end: adjustedEnd });
      const businessDays = allDays.filter(date => !isWeekend(date)).length;

      return {
        ...receso,
        startDate: adjustedStart,
        endDate: adjustedEnd,
        businessDays: businessDays
      };
    });

  
    return adjustedRecesses;
  }
}
