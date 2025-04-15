import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/entities/user.entity";
import { Repository } from "typeorm";
import { Notification } from "src/entities/notification.entity";
import { NotificationResponseDto } from "src/dto/notification-response.dto";
import { RoleEnum } from "src/enums/role.enum";

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // Notificar a un usuario específico
  async notifyUser(recipientId: number, message: string, senderId?: number) {
    const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
    if (!recipient) throw new Error('Recipient not found');
  
    const sender = senderId
      ? await this.userRepository.findOne({ where: { id: senderId } })
      : null;
  
    const notification = this.notificationRepo.create({
      message,
      recipient,
      sender,
    });
  
    return this.notificationRepo.save(notification);
  }

  // Obtener notificaciones no leídas de un usuario
  async getUnreadNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { recipient: { id: userId }, read: false },
      order: { createdAt: 'DESC' },
    });
  }

  // Marcar una notificación como leída
  async markAsRead(notificationId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.read = true;
    return this.notificationRepo.save(notification);
  }

  // Obtener todas las notificaciones de un usuario (incluidas las leídas)
  async getNotificationsByUser(userId: number): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    return notifications.map(notification => ({
      id: notification.id,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    }));
  }

  // Notificar a todos los administradores
  async notifyAdmins(message: string, senderId?: number) {
    const admins = await this.userRepository.find({
      where: { role: RoleEnum.ADMIN },  // Usar RoleEnum.ADMIN para obtener solo administradores
    });
  
    if (!admins.length) return;
  
    const sender = senderId
      ? await this.userRepository.findOne({ where: { id: senderId } })
      : null;
  
    const notifications = admins.map((admin) =>
      this.notificationRepo.create({
        message,
        recipient: admin,
        sender,
      }),
    );
  
    await this.notificationRepo.save(notifications);
  }

  // Obtener notificaciones de todos los administradores
  async getNotificationsForAdmins(): Promise<NotificationResponseDto[]> {
    const admins = await this.userRepository.find({
      where: { role: RoleEnum.ADMIN }, // Asegúrate de que 'role' es una cadena, no un número
    });
    

    const allNotifications: Notification[] = [];
    for (const admin of admins) {
      const notifications = await this.notificationRepo.find({
        where: { recipient: { id: admin.id } },
        order: { createdAt: 'DESC' },
      });
      allNotifications.push(...notifications);
    }

    return allNotifications.map(notification => ({
      id: notification.id,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    }));
  }
  // Notificar a administradores y supervisores
async notifyAdminsAndSupervisors(message: string, senderId?: number) {
  const users = await this.userRepository.find({
    where: [
      { role: RoleEnum.ADMIN },
      { role: RoleEnum.SUPERVISOR }
    ],  // Obtener usuarios con rol ADMIN o SUPERVISOR
  });

  if (!users.length) return;

  const sender = senderId
    ? await this.userRepository.findOne({ where: { id: senderId } })
    : null;

  const notifications = users.map((user) =>
    this.notificationRepo.create({
      message,
      recipient: user,
      sender,
    }),
  );

  await this.notificationRepo.save(notifications);
}

}
