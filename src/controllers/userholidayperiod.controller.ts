// src/controllers/userholidayperiod.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Res, HttpStatus, NotFoundException, BadRequestException, HttpException, ParseIntPipe } from '@nestjs/common';
import { UserHolidayPeriodService } from 'src/services/userholidayperiod.service';
import { UserHolidayPeriod } from 'src/entities/userholidayperiod.entity';
import { Response } from 'express';
import { HolidayPeriodName } from 'src/entities/holydayperiod.entity'; // Asegúrate de importar el enum desde el archivo correcto
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateUserHolidayPeriodDto } from 'src/dto/create-user-holiday-period.dto';
import { UserHolidayPeriodDto } from 'src/dto/userholidayperiod.dto';
import { UpdateUserHolidayPeriodDto } from 'src/dto/updateUserHolidayPeriod.dto';

@ApiTags('Recesos Personalizados')
@Controller('user-holiday-periods')
export class UserHolidayPeriodController {
  constructor(private readonly userHolidayPeriodService: UserHolidayPeriodService) { }

  @Post()
  @ApiOperation({ summary: 'Crear un período de vacaciones para un usuario' })
  @ApiBody({ type: CreateUserHolidayPeriodDto })
  @ApiResponse({ status: 201, description: 'Período de vacaciones creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al crear el período de vacaciones' })
  async createUserHolidayPeriod(
    @Body() body: CreateUserHolidayPeriodDto,
  ): Promise<UserHolidayPeriod> {
    return this.userHolidayPeriodService.createUserHolidayPeriod(body);
  }

  @Get(':userId/:year')
  @ApiOperation({ summary: 'Obtener períodos de vacaciones de un usuario por año' })
  @ApiResponse({ status: 200, description: 'Períodos de vacaciones obtenidos exitosamente' })
  @ApiResponse({ status: 404, description: 'No se encontraron períodos de vacaciones' })
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
  @ApiOperation({ summary: 'Actualizar un período de vacaciones' })
  @ApiResponse({ status: 200, description: 'Período de vacaciones actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al actualizar el período de vacaciones' })
@Put(':id')
async updateUserHolidayPeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateData: {
      name?: HolidayPeriodName;
      startDate?: string;
      endDate?: string;
      userId?: number;
    },
  ) {
    return this.userHolidayPeriodService.updateUserHolidayPeriod(id, updateData);
  }
    

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un período de vacaciones' })
  @ApiResponse({ status: 204, description: 'Período de vacaciones eliminado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error al eliminar el período de vacaciones' })
  async deleteUserHolidayPeriod(@Param('id') id: number, @Res() res: Response): Promise<void> {
    try {
      await this.userHolidayPeriodService.deleteUserHolidayPeriod(id);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({ message: 'Error deleting holiday period', error });
    }
  }




  @Get(':userId')
  @ApiOperation({ summary: 'Obtener todos períodos de vacaciones de un usuario' })
  @ApiResponse({ status: 200, description: 'Períodos de vacaciones obtenidos exitosamente' })
  @ApiResponse({ status: 404, description: 'No se encontraron períodos de vacaciones' })
  async getHolidays(@Param('userId', ParseIntPipe) userId: number): Promise<UserHolidayPeriodDto[]> {
    console.log(`Recibiendo userId: ${userId} de la solicitud.`);
    return this.userHolidayPeriodService.getAllUserHolidayPeriods(userId);
  }



}
