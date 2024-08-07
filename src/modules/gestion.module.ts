import { Module } from '@nestjs/common';
import { GestionPeriodService } from 'src/services/gestion-period.service';
import { GestionPeriodController } from 'src/controllers/gestion-period.controller';
import { UserService } from 'src/services/user.service';
import { UserModule } from './user.module';

@Module({
    imports:[UserModule],
    providers: [GestionPeriodService],
    controllers: [GestionPeriodController],
})
export class GestionPeriodModule { }
