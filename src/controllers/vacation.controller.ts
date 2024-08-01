import { Controller, Get, Param } from '@nestjs/common';
import { VacationService } from 'src/services/vacation.service';

@Controller('vacations')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Get(':carnetIdentidad')
  async getRemainingVacationDays(@Param('carnetIdentidad') carnetIdentidad: string): Promise<any> {
    const result = await this.vacationService.calculateRemainingVacationDays(carnetIdentidad);
    return result;
  }
}
