import { Controller, Get, Param, Res, HttpStatus, Post, Body, Put } from '@nestjs/common';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { HolidayPeriodService } from 'src/services/holydayperiod.service';
import { Response } from 'express';

@Controller('holiday-periods')
export class HolidayPeriodController {
  constructor(private readonly holidayPeriodService: HolidayPeriodService) {}

  @Get(':year')
  async getHolidayPeriods(@Param('year') year: number, @Res() res: Response): Promise<void> {
    try {
      const holidayPeriods = await this.holidayPeriodService.getHolidayPeriods(year);
      res.status(HttpStatus.OK).json(holidayPeriods);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error retrieving holiday periods', error });
    }
  }

  @Post()
  async createHolidayPeriod(@Body() holidayPeriod: HolidayPeriod, @Res() res: Response): Promise<void> {
    try {
      const newHolidayPeriod = await this.holidayPeriodService.createHolidayPeriod(holidayPeriod);
      res.status(HttpStatus.CREATED).json(newHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error creating holiday period', error });
    }
  }

  @Put(':id')
  async updateHolidayPeriod(
    @Param('id') id: number,
    @Body() holidayPeriod: HolidayPeriod,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const updatedHolidayPeriod = await this.holidayPeriodService.updateHolidayPeriod(id, holidayPeriod);
      res.status(HttpStatus.OK).json(updatedHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error updating holiday period', error });
    }
  }
}
