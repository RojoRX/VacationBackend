import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NonHoliday } from 'src/entities/nonholiday.entity'; // Asegúrate de que la ruta sea correcta
import { NonHolidayService } from '../services/nonholiday.service';
import { NonHolidayController } from '../controllers/nonholiday.controller';
import { UserModule } from './user.module';

@Module({
  imports: [TypeOrmModule.forFeature([NonHoliday]),
UserModule],
  providers: [NonHolidayService],
  controllers: [NonHolidayController],
  exports: [NonHolidayService],
})
export class NonHolidayModule {}
