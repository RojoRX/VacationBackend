import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';
import { VacationResponse } from 'src/interfaces/vacation-response.interface';

@Controller('vacations')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get()
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
}
