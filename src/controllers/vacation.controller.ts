import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';

@Controller('vacations')
export class VacationController {
  constructor(
    private readonly vacationService: VacationService
  ) {}

  @Get()
  async getVacationInfo(
    @Query('carnetIdentidad') carnetIdentidad: string,
    @Query('year') year: number,
    @Query('currentDate') currentDate: string // Formato esperado 'YYYY-MM-DD'
  ) {
    // Convertir currentDate a objeto Date
    const currentDateObj = new Date(currentDate);

    // Llamar al servicio de vacaciones con el carnet de identidad, año y fecha actual
    return this.vacationService.calculateVacationDays(carnetIdentidad, year, currentDateObj);
  }
}
