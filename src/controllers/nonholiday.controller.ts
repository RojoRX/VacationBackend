import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { NonHoliday } from 'src/entities/nonholiday.entity';

@Controller('non-holidays')
export class NonHolidayController {
  constructor(private readonly nonHolidayService: NonHolidayService) {}

  @Get()
  async getAll(@Query('year') year: number): Promise<NonHoliday[]> {
    return this.nonHolidayService.getNonHolidayDays(year);
  }

  @Post()
  async add(@Body() nonHoliday: NonHoliday): Promise<NonHoliday> {
    return this.nonHolidayService.addNonHoliday(nonHoliday);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() nonHoliday: Partial<NonHoliday>,
  ): Promise<NonHoliday> {
    return this.nonHolidayService.updateNonHoliday(id, nonHoliday);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.nonHolidayService.deleteNonHoliday(id);
  }
}
