import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';
import { DateTime } from 'luxon';

@Controller('vacations')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get('current-year/:carnetIdentidad')
  async getCurrentYearVacationData(
    @Param('carnetIdentidad') carnetIdentidad: string,
    @Query('year') year: number
  ) {
    if (!year) {
      year = DateTime.now().year;
    }

    try {
      const vacationData = await this.vacationService.getCurrentYearVacationData(carnetIdentidad, year);
      return vacationData;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

}
