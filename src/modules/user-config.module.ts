import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserConfig } from 'src/entities/user-config.entity';
import { User } from 'src/entities/user.entity';
import { UserConfigService } from 'src/services/user-config.service';
import { UserConfigController } from 'src/controllers/user-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserConfig, User])],
  providers: [UserConfigService],
  controllers: [UserConfigController],
  exports: [UserConfigService],
})
export class UserConfigModule {}
