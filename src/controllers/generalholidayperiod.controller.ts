// src/controllers/general-holiday-period.controller.ts
import { Controller, Get, Param, Res, HttpStatus, Post, Body, Put } from "@nestjs/common";
import { GeneralHolidayPeriod } from "src/entities/generalHolidayPeriod.entity";
import { GeneralHolidayPeriodService } from "src/services/generalHolidayPeriod.service";
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('Recesos Generales')
@Controller('general-holiday-periods')
export class GeneralHolidayPeriodController {
  constructor(private readonly generalHolidayPeriodService: GeneralHolidayPeriodService) {}

  @Get(':year')
  @ApiOperation({ summary: 'Obtener periodos de vacaciones generales por año' })
  @ApiResponse({ status: 200, description: 'Lista de periodos de vacaciones generales', type: [GeneralHolidayPeriod] })
  @ApiResponse({ status: 500, description: 'Error al recuperar los periodos de vacaciones generales' })
  @ApiParam({ name: 'year', required: true, description: 'Año para el cual se solicitan los periodos de vacaciones' })
  async getGeneralHolidayPeriods(@Param('year') year: number, @Res() res: Response): Promise<void> {
    try {
      const holidayPeriods = await this.generalHolidayPeriodService.getGeneralHolidayPeriods(year);
      res.status(HttpStatus.OK).json(holidayPeriods);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Error retrieving general holiday periods', error });
    }
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo periodo de vacaciones generales' })
  @ApiResponse({ status: 201, description: 'Periodo de vacaciones general creado exitosamente', type: GeneralHolidayPeriod })
  @ApiResponse({ status: 400, description: 'Error al crear el periodo de vacaciones generales' })
  @ApiBody({ type: GeneralHolidayPeriod, description: 'Datos del periodo de vacaciones a crear' })
  async createGeneralHolidayPeriod(@Body() holidayPeriod: GeneralHolidayPeriod, @Res() res: Response): Promise<void> {
    try {
      const newHolidayPeriod = await this.generalHolidayPeriodService.createGeneralHolidayPeriod(holidayPeriod);
      res.status(HttpStatus.CREATED).json(newHolidayPeriod);
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error creating general holiday period', error });
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un periodo de vacaciones generales' })
  @ApiResponse({ status: 200, description: 'Periodo de vacaciones general actualizado exitosamente', type: GeneralHolidayPeriod })
  @ApiResponse({ status: 400, description: 'Error al actualizar el periodo de vacaciones generales' })
  @ApiResponse({ status: 404, description: 'Periodo de vacaciones generales no encontrado' })
  @ApiParam({ name: 'id', required: true, description: 'ID del periodo de vacaciones a actualizar' })
  @ApiBody({ type: GeneralHolidayPeriod, description: 'Datos del periodo de vacaciones a actualizar' })
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
