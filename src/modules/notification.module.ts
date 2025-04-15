import { Module } from '@nestjs/common';
import { NotificationService } from 'src/services/notification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from 'src/entities/notification.entity';
import { User } from 'src/entities/user.entity';
import { NotificationController } from 'src/controllers/notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
      // Asegúrate de que Notification esté registrado en el módulo
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],  // Exporta el servicio para que otros módulos lo puedan usar
})
export class NotificationModule {}
