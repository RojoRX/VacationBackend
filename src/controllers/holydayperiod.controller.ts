import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { HolidayPeriodService } from 'src/services/holydayperiod.service';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { DateTime } from 'luxon';

@Controller('holiday-periods')
export class HolidayPeriodController {
  constructor(private readonly holidayPeriodService: HolidayPeriodService) {}

  @Get()
  async findAll(): Promise<HolidayPeriod[]> {
    return this.holidayPeriodService.findAll();
  }
  
  @Post()
  createHolidayPeriod(@Body() holidayPeriod: Partial<HolidayPeriod>): Promise<HolidayPeriod> {
    return this.holidayPeriodService.createHolidayPeriod(holidayPeriod);
  }

  @Get(':year')
  async getHolidayPeriods(@Param('year', ParseIntPipe) year: number): Promise<HolidayPeriod[]> {
    const periods = await this.holidayPeriodService.getHolidayPeriods(year);
    return periods.map(period => ({
      ...period,
      startDate: DateTime.fromJSDate(period.startDate).toISO(),
      endDate: DateTime.fromJSDate(period.endDate).toISO(),
    }));
  }

  @Put(':id')
  updateHolidayPeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() holidayPeriod: Partial<HolidayPeriod>,
  ): Promise<HolidayPeriod> {
    return this.holidayPeriodService.updateHolidayPeriod(id, holidayPeriod);
  }

  @Delete(':id')
  deleteHolidayPeriod(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.holidayPeriodService.deleteHolidayPeriod(id);
  }
}
