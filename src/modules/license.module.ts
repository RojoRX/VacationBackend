import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from 'src/entities/license.entity';
import { LicenseService } from 'src/services/license.service';
import { LicenseController } from 'src/controllers/license.controller';
import { User } from 'src/entities/user.entity';
import { UserModule } from './user.module';
import { VacationModule } from './vacation.module'; // forwardRef para evitar la referencia circular

@Module({
  imports: [
    TypeOrmModule.forFeature([License, User]),
    UserModule,
    forwardRef(() => VacationModule), // Aquí se usa forwardRef
  ],
  providers: [LicenseService],
  controllers: [LicenseController],
  exports: [LicenseService],
})
export class LicenseModule {}
