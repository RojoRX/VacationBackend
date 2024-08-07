import { Controller, Get, Param } from '@nestjs/common';
import { GestionPeriodService } from 'src/services/gestion-period.service';

@Controller('gestion-periods')
export class GestionPeriodController {
  constructor(private readonly gestionPeriodService: GestionPeriodService) {}

  @Get('gestions/:carnetIdentidad')
  async getAvailableGestions(@Param('carnetIdentidad') carnetIdentidad: string) {
    return await this.gestionPeriodService.getAvailableGestions(carnetIdentidad);
  }
}
