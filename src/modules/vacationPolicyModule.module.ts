import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationPolicyService } from 'src/services/vacation-policy.service';
import { VacationPolicyController } from 'src/controllers/vacation-policy.controller';
import { VacationPolicy } from 'src/entities/vacationPolicy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VacationPolicy])], // Importa el repositorio de la entidad VacationPolicy
  controllers: [VacationPolicyController],               // Registra el controlador del módulo
  providers: [VacationPolicyService],                    // Registra el servicio del módulo
  exports: [VacationPolicyService],                      // Exporta el servicio para que pueda ser usado en otros módulos
})
export class VacationPolicyModule {}
