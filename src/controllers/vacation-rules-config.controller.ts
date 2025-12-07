// src/vacation-rules-config/vacation-rules-config.controller.ts
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { VacationRulesConfigService } from 'src/services/vacation-rules-config.service';

@Controller('vacation-rules')
export class VacationRulesConfigController {
  constructor(private readonly service: VacationRulesConfigService) {}

  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  @Patch()
  updateConfig(@Body() body: { validarGestionesAnterioresConDias?: boolean }) {
    return this.service.updateConfig(body);
  }
}
