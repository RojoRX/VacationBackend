import { Controller, Get, Param, Res, HttpStatus, Post, Body, Put } from "@nestjs/common";
import { GeneralHolidayPeriod } from "src/entities/generalHolidayPeriod.entity";
import { GeneralHolidayPeriodService } from "src/services/generalHolidayPeriod.service";
import { Response } from 'express';

@Controller('general-holiday-periods')
export class GeneralHolidayPeriodController {
  constructor(private readonly generalHolidayPeriodService: GeneralHolidayPeriodService) {}

  @Get(':year')
  async getGeneralHolidayPeriods(@Param('year') year: number, @Res() res: Response): Promise<void> {
    try {
      const holidayPeriods = await this.generalHolidayPeriodService.getGeneralHolidayPeriods(year);
      res.status(HttpStatus.OK).json(holidayPeriods);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error retrieving general holiday periods', error });
    }
  }

  @Post()
  async createGeneralHolidayPeriod(@Body() holidayPeriod: GeneralHolidayPeriod, @Res() res: Response): Promise<void> {
    try {
      const newHolidayPeriod = await this.generalHolidayPeriodService.createGeneralHolidayPeriod(holidayPeriod);
      res.status(HttpStatus.CREATED).json(newHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error creating general holiday period', error });
    }
  }

  @Put(':id')
  async updateGeneralHolidayPeriod(
    @Param('id') id: number,
    @Body() holidayPeriod: GeneralHolidayPeriod,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const updatedHolidayPeriod = await this.generalHolidayPeriodService.updateGeneralHolidayPeriod(id, holidayPeriod);
      res.status(HttpStatus.OK).json(updatedHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error updating general holiday period', error });
    }
  }
}
