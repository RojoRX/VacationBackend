// src/controllers/userholidayperiod.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Res, HttpStatus } from '@nestjs/common';
import { UserHolidayPeriodService } from 'src/services/userholidayperiod.service';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
import { Response } from 'express';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity'; // Asegúrate de importar el enum desde el archivo correcto

@Controller('user-holiday-periods')
export class UserHolidayPeriodController {
  constructor(private readonly userHolidayPeriodService: UserHolidayPeriodService) {}

  @Post()
  async createUserHolidayPeriod(@Body() body: { name: HolidayPeriodName; startDate: string; endDate: string; year: number; userId: number }, @Res() res: Response): Promise<void> {
    try {
      // El cuerpo ya está en el formato correcto
      const newHolidayPeriod = await this.userHolidayPeriodService.createUserHolidayPeriod(body);
      res.status(HttpStatus.CREATED).json(newHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error creating holiday period', error });
    }
  }

  @Get(':userId/:year')
  async getUserHolidayPeriods(
    @Param('userId') userId: number,
    @Param('year') year: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const holidayPeriods = await this.userHolidayPeriodService.getUserHolidayPeriods(userId, year);
      if (holidayPeriods.length === 0) {
        res.status(HttpStatus.OK).json({ message: 'No se encontraron períodos de vacaciones para este usuario y año' });
      } else {
        res.status(HttpStatus.OK).json(holidayPeriods);
      }
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error retrieving holiday periods', error });
    }
  }

  @Put(':id')
  async updateUserHolidayPeriod(
    @Param('id') id: number,
    @Body() body: Partial<UserHolidayPeriod>,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const updatedHolidayPeriod = await this.userHolidayPeriodService.updateUserHolidayPeriod(id, body);
      res.status(HttpStatus.OK).json(updatedHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error updating holiday period', error });
    }
  }

  @Delete(':id')
  async deleteUserHolidayPeriod(@Param('id') id: number, @Res() res: Response): Promise<void> {
    try {
      await this.userHolidayPeriodService.deleteUserHolidayPeriod(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error deleting holiday period', error });
    }
  }
}
