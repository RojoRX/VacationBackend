import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Informacion Vacaciones')
@Controller('vacations')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener información de días de vacaciones' })
  @ApiQuery({ name: 'carnetIdentidad', required: true, description: 'Carnet de identidad del usuario' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Fecha de inicio del rango' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Fecha de fin del rango' })
  @ApiResponse({
    status: 200,
    description: 'Información de vacaciones calculada exitosamente',
    type: Object, // Usa Object aquí si VacationResponse es solo un tipo
  })
  @ApiResponse({ status: 400, description: 'Faltan parámetros obligatorios o fechas inválidas' })
  async getVacationInfo(
    @Query('carnetIdentidad') carnetIdentidad: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<VacationResponse> {
    if (!carnetIdentidad || !startDate || !endDate) {
      throw new BadRequestException('Faltan parámetros obligatorios.');
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Fechas inválidas.');
    }

    return this.vacationService.calculateVacationDays(carnetIdentidad, startDateTime, endDateTime);
  }

   // Nuevo endpoint que calcula automáticamente el período basado en el CI
   @Get('automatic-period')
   @ApiOperation({ summary: 'Calcular automáticamente el período de vacaciones basado en el CI' })
   @ApiQuery({ name: 'carnetIdentidad', required: true, description: 'Carnet de identidad del usuario' })
   @ApiResponse({
     status: 200,
     description: 'Información de vacaciones calculada exitosamente con fechas automáticas',
     type: Object, // Usa Object aquí si VacationResponse es solo un tipo
   })
   @ApiResponse({ status: 400, description: 'El usuario no existe o no tiene fecha de ingreso válida' })
   async getAutomaticVacationPeriod(
     @Query('carnetIdentidad') carnetIdentidad: string
   ): Promise<VacationResponse> {
     if (!carnetIdentidad) {
       throw new BadRequestException('El carnet de identidad es obligatorio.');
     }
 
     return this.vacationService.calculateVacationPeriodByCI(carnetIdentidad);
   }

  @Get('accumulated-debt')
  @ApiOperation({ summary: 'Calcular la deuda acumulativa de días de vacaciones hasta una fecha específica' })
  @ApiQuery({ name: 'carnetIdentidad', required: true, description: 'Carnet de identidad del usuario' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Fecha de fin del rango para calcular la deuda acumulativa' })
  @ApiResponse({
    status: 200,
    description: 'Deuda acumulativa calculada exitosamente',
    schema: {
      example: {
        deudaAcumulativa: 10,
        detalles: [
          {
            startDate: '2018-03-15',
            endDate: '2019-03-14',
            deuda: 2,
            diasDeVacacion: 15,
            diasDeVacacionRestantes: 13
          },
          {
            startDate: '2019-03-15',
            endDate: '2020-03-14',
            deuda: 3,
            diasDeVacacion: 15,
            diasDeVacacionRestantes: 12
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 400, description: 'El usuario no existe o la fecha es inválida' })
  async getAccumulatedDebt(
    @Query('carnetIdentidad') carnetIdentidad: string,
    @Query('endDate') endDate: string
  ): Promise<{ deudaAcumulativa: number, detalles: any[] }> {
    if (!carnetIdentidad || !endDate) {
      throw new BadRequestException('Faltan parámetros obligatorios.');
    }

    const endDateTime = new Date(endDate);

    if (isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Fecha inválida.');
    }

    return this.vacationService.calculateAccumulatedDebt(carnetIdentidad, endDateTime);
  }

  @Get('debt-since-date')
  @ApiOperation({ summary: 'Calcular la deuda acumulativa de días de vacaciones desde una fecha específica hasta otra' })
  @ApiQuery({ name: 'carnetIdentidad', required: true, description: 'Carnet de identidad del usuario' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Fecha de inicio del rango para calcular la deuda acumulativa' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Fecha de fin del rango para calcular la deuda acumulativa' })
  @ApiResponse({
    status: 200,
    description: 'Deuda acumulativa calculada exitosamente',
    schema: {
      example: {
        deudaAcumulativa: 10,
        detalles: [
          {
            startDate: '2020-03-15',
            endDate: '2021-03-14',
            deuda: 2,
            diasDeVacacion: 15,
            diasDeVacacionRestantes: 13,
            deudaAcumulativaHastaEstaGestion: 2,
            deudaAcumulativaAnterior: 0,
            diasDisponibles: 13
          }
        ],
        resumenGeneral: {
          deudaTotal: 10,
          diasDisponiblesActuales: 13,
          gestionesConDeuda: 1,
          gestionesSinDeuda: 0,
          promedioDeudaPorGestion: 2,
          primeraGestion: '2020-03-15',
          ultimaGestion: '2021-03-14'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'El usuario no existe o las fechas son inválidas' })
  async getDebtSinceDate(
    @Query('carnetIdentidad') carnetIdentidad: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<{
    deudaAcumulativa: number;
    detalles: any[];
    resumenGeneral: any;
  }> {
    if (!carnetIdentidad || !startDate || !endDate) {
      throw new BadRequestException('Faltan parámetros obligatorios.');
    }
  
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
  
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Fechas inválidas.');
    }
  
    return this.vacationService.calculateDebtSinceDate(carnetIdentidad, startDateTime, endDateTime);
  }
  
}
