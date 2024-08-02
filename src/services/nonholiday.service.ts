import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity';

@Injectable()
export class NonHolidayService {
  constructor(
    @InjectRepository(NonHoliday)
    private readonly nonHolidayRepository: Repository<NonHoliday>
  ) {}

  // Devuelve un arreglo de objetos NonHoliday para un año específico
  async getNonHolidayDays(year: number): Promise<NonHoliday[]> {
    return this.nonHolidayRepository.find({ where: { year } });
  }

  // Agrega un nuevo día no hábil
  async addNonHoliday(nonHoliday: NonHoliday): Promise<NonHoliday> {
    return this.nonHolidayRepository.save(nonHoliday);
  }

  // Actualiza un día no hábil existente
  async updateNonHoliday(id: number, nonHoliday: Partial<NonHoliday>): Promise<NonHoliday> {
    await this.nonHolidayRepository.update(id, nonHoliday);
    return this.nonHolidayRepository.findOne({ where: { id } });
  }

  // Elimina un día no hábil por su id
  async deleteNonHoliday(id: number): Promise<void> {
    await this.nonHolidayRepository.delete(id);
  }
}
