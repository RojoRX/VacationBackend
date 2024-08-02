import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { NonHoliday } from 'src/entities/nonholiday.entity';

@Controller('non-holidays')
export class NonHolidayController {
  constructor(private readonly nonHolidayService: NonHolidayService) {}

  // Devuelve los días no hábiles para un año específico
  @Get(':year')
  async getNonHolidayDays(@Param('year') year: number): Promise<NonHoliday[]> {
    return this.nonHolidayService.getNonHolidayDays(year);
  }

  // Agrega un nuevo día no hábil
  @Post()
  async addNonHoliday(@Body() body: { year: number, days: number }): Promise<NonHoliday> {
    const { year, days } = body;
    const nonHoliday = new NonHoliday();
    nonHoliday.year = year;
    nonHoliday.days = days;
    return this.nonHolidayService.addNonHoliday(nonHoliday);
  }

  // Actualiza un día no hábil existente
  @Put(':id')
  async updateNonHoliday(@Param('id') id: number, @Body() body: { year: number, days: number }): Promise<NonHoliday> {
    const { year, days } = body;
    const nonHoliday = { year, days };
    return this.nonHolidayService.updateNonHoliday(id, nonHoliday);
  }

  // Elimina un día no hábil por su id
  @Delete(':id')
  async deleteNonHoliday(@Param('id') id: number): Promise<void> {
    return this.nonHolidayService.deleteNonHoliday(id);
  }
}
