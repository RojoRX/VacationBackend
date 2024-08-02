import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { HolidayPeriodService } from 'src/services/holydayperiod.service';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { DateTime } from 'luxon';

@Controller('holiday-periods')
export class HolidayPeriodController {
  constructor(private readonly holidayPeriodService: HolidayPeriodService) {}

  // Obtiene todos los períodos de receso
  @Get()
  async findAll(): Promise<HolidayPeriod[]> {
    return this.holidayPeriodService.findAll();
  }
  
  // Crea un nuevo período de receso
  @Post()
  createHolidayPeriod(@Body() holidayPeriod: Partial<HolidayPeriod>): Promise<HolidayPeriod> {
    return this.holidayPeriodService.createHolidayPeriod(holidayPeriod);
  }

  // Obtiene los períodos de receso para un año específico
  @Get(':year')
  async getHolidayPeriods(@Param('year', ParseIntPipe) year: number): Promise<HolidayPeriod[]> {
    const periods = await this.holidayPeriodService.getHolidayPeriods(year);
    return periods.map(period => ({
      ...period,
      startDate: DateTime.fromJSDate(period.startDate).toISO(),
      endDate: DateTime.fromJSDate(period.endDate).toISO(),
    }));
  }

  // Actualiza un período de receso existente
  @Put(':id')
  updateHolidayPeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() holidayPeriod: Partial<HolidayPeriod>,
  ): Promise<HolidayPeriod> {
    return this.holidayPeriodService.updateHolidayPeriod(id, holidayPeriod);
  }

  // Elimina un período de receso por su id
  @Delete(':id')
  deleteHolidayPeriod(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.holidayPeriodService.deleteHolidayPeriod(id);
  }
}
