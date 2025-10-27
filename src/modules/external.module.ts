import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExternalService } from 'src/services/external.service';
import { ExternalController } from 'src/controllers/external.controller';

@Module({
  imports: [HttpModule],
  providers: [ExternalService],
  controllers: [ExternalController],
  exports: [ExternalService], // para usarlo en otros módulos
})
export class ExternalModule {}
