import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/user.entity";
import { Repository } from "typeorm";
import { Notification } from "src/entities/notification.entity";
import { NotificationResponseDto } from "src/dto/notification-response.dto";

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async notifyUser(recipientId: number, message: string, senderId?: number) {
    const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
    if (!recipient) throw new Error('Recipient not found');
  
    const sender = senderId
      ? await this.userRepository.findOne({ where: { id: senderId } })
      : null;
  
    const notification = this.notificationRepo.create({
      message, // Asegúrate de que el campo 'message' esté bien definido en la entidad Notification
      recipient,
      sender,
    });
  
    return this.notificationRepo.save(notification);
  }

  async getUnreadNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { recipient: { id: userId }, read: false },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(notificationId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.read = true;
    return this.notificationRepo.save(notification);  // Asegúrate de guardar la notificación después de marcarla como leída
  }
  
  async getNotificationsByUser(userId: number): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    // Mapear las notificaciones a la forma del DTO
    return notifications.map(notification => ({
      id: notification.id,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    }));
  }
}
