// src/vacation-rules-config/vacation-rules-config.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRulesConfig } from '../entities/vacation-rules-config.entity';
import { VacationRulesConfigService } from 'src/services/vacation-rules-config.service';
import { VacationRulesConfigController } from 'src/controllers/vacation-rules-config.controller';// ← Importa el controlador

@Module({
  imports: [TypeOrmModule.forFeature([VacationRulesConfig])],
  providers: [VacationRulesConfigService],
  controllers: [VacationRulesConfigController], // ← Agrega el controlador aquí
  exports: [VacationRulesConfigService],
})
export class VacationRulesConfigModule {}
