import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { DateTime } from 'luxon';

@Injectable()
export class NonHolidayService {
  constructor(
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>,
  ) {}

  async getNonHolidayDays(year: number): Promise<NonHoliday[]> {
    return this.nonHolidayRepository.find({ where: { year } });
  }

  async getActiveNonHolidayDays(year: number, currentDate: Date): Promise<number> {
    const nonHolidays = await this.getNonHolidayDays(year);
    let totalNonHolidayDays = 0;

    for (const nonHoliday of nonHolidays) {
      const nonHolidayDate = DateTime.fromISO(nonHoliday.date);

      // Solo contar días no hábiles que ocurren antes de la fecha actual
      if (nonHolidayDate < DateTime.fromJSDate(currentDate)) {
        totalNonHolidayDays += 1;
      }
    }

    return totalNonHolidayDays;
  }

  async addNonHoliday(nonHoliday: NonHoliday): Promise<NonHoliday> {
    const date = DateTime.fromISO(nonHoliday.date);
    if (!date.isValid) {
      throw new BadRequestException(`La fecha proporcionada (${nonHoliday.date}) no es válida.`);
    }

    const year = date.year;
    if (year < 2000 || year > 2100) {
      throw new BadRequestException(`El año ${year} está fuera del rango permitido (2000 - 2100).`);
    }

    nonHoliday.date = date.toISODate(); // Normalizar fecha
    nonHoliday.year = year;

    if (!nonHoliday.description || nonHoliday.description.trim().length < 3) {
      throw new BadRequestException('La descripción debe tener al menos 3 caracteres.');
    }

    nonHoliday.description = nonHoliday.description.toUpperCase();

    const existing = await this.getNonHolidayByDate(year, nonHoliday.date);
    if (existing) {
      throw new BadRequestException(`El día ${nonHoliday.date} ya está registrado como no hábil.`);
    }

    return this.nonHolidayRepository.save(nonHoliday);
  }

  async updateNonHoliday(id: number, nonHoliday: Partial<NonHoliday>): Promise<NonHoliday> {
    const existing = await this.nonHolidayRepository.findOne({ where: { id } });
    if (!existing) {
      throw new BadRequestException(`No se encontró el día no hábil con ID ${id}.`);
    }

    if (nonHoliday.date) {
      const date = DateTime.fromISO(nonHoliday.date);
      if (!date.isValid) {
        throw new BadRequestException(`La fecha proporcionada (${nonHoliday.date}) no es válida.`);
      }

      const year = date.year;
      if (year < 2000 || year > 2100) {
        throw new BadRequestException(`El año ${year} está fuera del rango permitido (2000 - 2100).`);
      }

      nonHoliday.date = date.toISODate();
      nonHoliday.year = year;

      // Validar que no exista otro día no hábil en la nueva fecha
      const duplicate = await this.getNonHolidayByDate(year, nonHoliday.date);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`Ya existe un día no hábil registrado para la fecha ${nonHoliday.date}.`);
      }
    }

    if (nonHoliday.description) {
      if (nonHoliday.description.trim().length < 3) {
        throw new BadRequestException('La descripción debe tener al menos 3 caracteres.');
      }
      nonHoliday.description = nonHoliday.description.toUpperCase();
    }

    await this.nonHolidayRepository.update(id, nonHoliday);
    return this.nonHolidayRepository.findOne({ where: { id } });
  }

  async deleteNonHoliday(id: number): Promise<void> {
    await this.nonHolidayRepository.delete(id);
  }

  async getNonHolidayByDate(year: number, date: string): Promise<NonHoliday | null> {
    const normalizedDate = DateTime.fromISO(date).toISODate();
    return this.nonHolidayRepository.findOne({ where: { year, date: normalizedDate } });
  }

async getNonWorkingDaysInRange(startDate: string, endDate: string): Promise<string[]> {
  const start = DateTime.fromISO(startDate).startOf('day');
  const end = DateTime.fromISO(endDate).startOf('day');

  console.log('📅 Rango recibido:', { start: start.toISODate(), end: end.toISODate() });

  const allNonHolidays = await this.nonHolidayRepository.find();

  console.log('📋 Todos los días no hábiles registrados en la base de datos:');
  allNonHolidays.forEach(nh => {
    const isoDate = DateTime.fromISO(nh.date).toISODate();
    console.log(` - ${isoDate}`);
  });

  // Filtrar los días no hábiles que están dentro del rango
  const filteredDates = allNonHolidays
    .filter(nh => {
      const nhDate = DateTime.fromISO(nh.date).startOf('day');
      const isInRange = nhDate >= start && nhDate <= end;
      if (isInRange) {
        console.log(`✅ Día no hábil dentro del rango: ${nhDate.toISODate()}`);
      }
      return isInRange;
    })
    .map(nh => DateTime.fromISO(nh.date).toISODate());

  console.log('✅ Días no hábiles finales devueltos:', filteredDates);

  return filteredDates;
}



}
