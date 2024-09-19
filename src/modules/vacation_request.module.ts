// vacation_request.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRequest } from 'src/entities/vacation_request.entity';
import { VacationRequestService } from 'src/services/vacation_request.service';
import { VacationRequestController } from 'src/controllers/vacation_request.controller';
import { UserService } from 'src/services/user.service';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { HttpModule } from '@nestjs/axios';
import { User } from 'src/entities/user.entity';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { Department } from 'src/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VacationRequest, User, NonHoliday, Department]),
    HttpModule, // Importa HttpModule para permitir llamadas a APIs externas
  ],
  controllers: [VacationRequestController],
  providers: [VacationRequestService, UserService, NonHolidayService],
  exports: [VacationRequestService], // Exporta el servicio si se requiere en otros módulos
})
export class VacationRequestModule {}
