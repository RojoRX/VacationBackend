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

  // Notificar a un usuario específico con recurso opcional
async notifyUser({
  recipientId,
  message,
  senderId,
  resourceType,
  resourceId,
}: {
  recipientId: number;
  message: string;
  senderId?: number;
  resourceType?: 'VACATION' | 'LICENSE';
  resourceId?: number;
}) {
  const recipient = await this.userRepository.findOne({
    where: { id: recipientId },
    relations: ['department', 'academicUnit'], // ⚠️ Necesario para comparar áreas
  });
  if (!recipient) throw new Error('Recipient not found');

  const sender = senderId
    ? await this.userRepository.findOne({
        where: { id: senderId },
        relations: ['department', 'academicUnit'], // ⚠️ También necesitamos esta info del emisor
      })
    : null;

  // ✅ Validación para evitar que supervisores ajenos reciban notificaciones
  if (recipient.role === RoleEnum.SUPERVISOR && sender) {
    const isSameDepartment =
      sender.department && recipient.department?.id === sender.department.id;

    const isSameAcademicUnit =
      sender.academicUnit && recipient.academicUnit?.id === sender.academicUnit.id;

    if (!isSameDepartment && !isSameAcademicUnit) {
      throw new Error(
        'No se puede notificar a un supervisor que no pertenece al área del remitente',
      );
    }
  }

  const notification = this.notificationRepo.create({
    message,
    recipient,
    sender,
    resourceType,
    resourceId,
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

  // Obtener todas las notificaciones de un usuario
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
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
    }));
  }

  // Notificar a todos los administradores
  async notifyAdmins(message: string, senderId?: number, resourceType?: 'VACATION' | 'LICENSE', resourceId?: number) {
    const admins = await this.userRepository.find({
      where: { role: RoleEnum.ADMIN },
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
        resourceType,
        resourceId,
      }),
    );

    await this.notificationRepo.save(notifications);
  }

  // Obtener notificaciones de todos los administradores
  async getNotificationsForAdmins(): Promise<NotificationResponseDto[]> {
    const admins = await this.userRepository.find({
      where: { role: RoleEnum.ADMIN },
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
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
    }));
  }

  // Notificar a administradores y supervisores del mismo departamento o unidad académica
  async notifyRelevantSupervisorsAndAdmins(
    message: string,
    senderId: number,
    resourceType?: 'VACATION' | 'LICENSE',
    resourceId?: number,
  ) {
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
      relations: ['department', 'academicUnit'],
    });

    if (!sender) return;

    const users = await this.userRepository.find({
      where: [
        { role: RoleEnum.ADMIN },
        { role: RoleEnum.SUPERVISOR },
      ],
      relations: ['department', 'academicUnit'],
    });

    const relevantUsers = users.filter(user => {
      if (user.role === RoleEnum.ADMIN) return true;
      if (sender.department && user.department?.id === sender.department.id) return true;
      if (sender.academicUnit && user.academicUnit?.id === sender.academicUnit.id) return true;
      return false;
    });

    const notifications = relevantUsers.map((user) =>
      this.notificationRepo.create({
        message,
        recipient: user,
        sender,
        resourceType,
        resourceId,
      }),
    );

    await this.notificationRepo.save(notifications);
  }
}
