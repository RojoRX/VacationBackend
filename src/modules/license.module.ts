import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { License } from 'src/entities/license.entity';
import { LicenseService } from 'src/services/license.service';
import { LicenseController } from 'src/controllers/license.controller';
import { User } from 'src/entities/user.entity';
import { UserModule } from './user.module';

@Module({
  imports: [TypeOrmModule.forFeature([License, User]),
  UserModule
  ],
  providers: [LicenseService],
  controllers: [LicenseController],
  exports: [LicenseService],
})
export class LicenseModule {}
