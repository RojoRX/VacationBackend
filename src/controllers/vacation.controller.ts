import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';

@Controller('vacations')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get(':carnetIdentidad/:year')
  async getVacationInfo(
    @Param('carnetIdentidad') carnetIdentidad: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.vacationService.getVacationInfo(carnetIdentidad, year);
  }

  @Get('current/:year/:carnetIdentidad')
  async getCurrentYearVacationData(
    @Param('year', ParseIntPipe) year: number,
    @Param('carnetIdentidad') carnetIdentidad: string,
  ): Promise<any> {
    return this.vacationService.getCurrentYearVacationData(carnetIdentidad, year);
  }
}
