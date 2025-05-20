import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profession } from 'src/entities/profession.entity';
import { ProfessionService } from 'src/services/profession.service';
import { ProfessionController } from 'src/controllers/profession.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Profession])],
  controllers: [ProfessionController],
  providers: [ProfessionService],
  exports: [ProfessionService],
})
export class ProfessionModule {}
