// src/controllers/holiday-period.controller.ts
import { Controller, Get, Param, Res, HttpStatus, Post, Body, Put, UseGuards } from '@nestjs/common';
import { HolidayPeriod } from 'src/entities/holydayperiod.entity';
import { HolidayPeriodService } from 'src/services/holydayperiod.service';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RoleEnum } from 'src/enums/role.enum';

@ApiTags('holiday-periods')
@Controller('holiday-periods')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleEnum.ADMIN)
export class HolidayPeriodController {
  constructor(private readonly holidayPeriodService: HolidayPeriodService) {}

  @Get(':year')
  @ApiOperation({ summary: 'Obtener periodos de vacaciones por año' })
  @ApiResponse({ status: 200, description: 'Lista de periodos de vacaciones', type: [HolidayPeriod] })
  @ApiResponse({ status: 500, description: 'Error al recuperar los periodos de vacaciones' })
  @ApiParam({ name: 'year', required: true, description: 'Año para el cual se solicitan los periodos de vacaciones' })
  async getHolidayPeriods(@Param('year') year: number, @Res() res: Response): Promise<void> {
    try {
      const holidayPeriods = await this.holidayPeriodService.getHolidayPeriods(year);
      res.status(HttpStatus.OK).json(holidayPeriods);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error retrieving holiday periods', error });
    }
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo periodo de vacaciones' })
  @ApiResponse({ status: 201, description: 'Periodo de vacaciones creado exitosamente', type: HolidayPeriod })
  @ApiResponse({ status: 400, description: 'Error al crear el periodo de vacaciones' })
  @ApiBody({ type: HolidayPeriod, description: 'Datos del periodo de vacaciones a crear' })
  async createHolidayPeriod(@Body() holidayPeriod: HolidayPeriod, @Res() res: Response): Promise<void> {
    try {
      const newHolidayPeriod = await this.holidayPeriodService.createHolidayPeriod(holidayPeriod);
      res.status(HttpStatus.CREATED).json(newHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error creating holiday period', error });
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un periodo de vacaciones' })
  @ApiResponse({ status: 200, description: 'Periodo de vacaciones actualizado exitosamente', type: HolidayPeriod })
  @ApiResponse({ status: 400, description: 'Error al actualizar el periodo de vacaciones' })
  @ApiResponse({ status: 404, description: 'Periodo de vacaciones no encontrado' })
  @ApiParam({ name: 'id', required: true, description: 'ID del periodo de vacaciones a actualizar' })
  @ApiBody({ type: HolidayPeriod, description: 'Datos del periodo de vacaciones a actualizar' })
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
