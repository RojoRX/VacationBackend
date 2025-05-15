import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneralHolidayPeriod } from 'src/entities/generalHolidayPeriod.entity';
import { Repository, Not, Between, Brackets } from 'typeorm';
import { HolidayPeriodName } from 'src/entities/generalHolidayPeriod.entity';
import { CreateGeneralHolidayPeriodDto } from 'src/dto/create-general-holiday-period.dto';
import { format } from 'date-fns';

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

    const startDateUTC = new Date(dto.startDate);
    const endDateUTC = new Date(dto.endDate);

    // Obtener la representación ISO 8601 sin la 'Z' para almacenar
    const startDateToStore = startDateUTC.toISOString().slice(0, 19).replace('T', ' ');
    const endDateToStore = endDateUTC.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Después de formatear para almacenar: ${startDateToStore} - ${endDateToStore}`);

    const startForValidation = new Date(dto.startDate);
    const endForValidation = new Date(dto.endDate);

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

    const year = startDateUTC.getUTCFullYear();

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
        start: startDateUTC.toISOString(),
        end: endDateUTC.toISOString()
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
  // Actualizar un receso general existente
async updateGeneralHolidayPeriod(id: number, holidayPeriod: GeneralHolidayPeriod): Promise<GeneralHolidayPeriod> {
  const existingPeriod = await this.generalHolidayPeriodRepository.findOne({ where: { id } });

  if (!existingPeriod) {
    throw new NotFoundException(`Receso con id ${id} no encontrado.`);
  }

  const start = new Date(holidayPeriod.startDate);
  const end = new Date(holidayPeriod.endDate);

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

  const conflictingPeriod = await this.generalHolidayPeriodRepository.findOne({
    where: { year, name: holidayPeriod.name, id: Not(id) },
  });

  if (conflictingPeriod) {
    throw new BadRequestException(`Ya existe un receso general de "${holidayPeriod.name}" para el año ${year}.`);
  }

  const overlapping = await this.generalHolidayPeriodRepository.findOne({
    where: {
      year,
      startDate: Between(start, end),
      id: Not(id),
    },
  });

  if (overlapping) {
    throw new BadRequestException('Las fechas se superponen con otro receso general en el mismo año.');
  }

  // Función para formatear la fecha correctamente
  const formatDateToSQL = (date: Date): string =>
    date.toISOString().slice(0, 19).replace('T', ' ');

  const updatedPeriod = {
    ...holidayPeriod,
    year,
    startDate: formatDateToSQL(start),
    endDate: formatDateToSQL(end),
  };

  await this.generalHolidayPeriodRepository.update(id, updatedPeriod);
  return this.generalHolidayPeriodRepository.findOne({ where: { id } });
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
