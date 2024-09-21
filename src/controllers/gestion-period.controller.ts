// src/controllers/gestion-period.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { GestionPeriodService } from 'src/services/gestion-period.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Gestiones de un Usuario')
@Controller('gestion-periods')
export class GestionPeriodController {
  constructor(private readonly gestionPeriodService: GestionPeriodService) {}

  @Get('gestions/:carnetIdentidad')
  @ApiOperation({ summary: 'Obtener gestiones disponibles por carnet de identidad' })
  @ApiResponse({ status: 200, description: 'Lista de gestiones disponibles', type: Array })
  @ApiResponse({ status: 404, description: 'No se encontraron gestiones para el carnet de identidad proporcionado' })
  @ApiParam({ name: 'carnetIdentidad', required: true, description: 'Carnet de identidad del usuario para consultar gestiones' })
  async getAvailableGestions(@Param('carnetIdentidad') carnetIdentidad: string) {
    return await this.gestionPeriodService.getAvailableGestions(carnetIdentidad);
  }
}
