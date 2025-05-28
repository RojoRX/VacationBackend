import { Controller, Post, Body, Param, Get, Patch } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam } from "@nestjs/swagger";
import { NotificationService } from "src/services/notification.service";
import { NotificationResponseDto } from "src/dto/notification-response.dto";

@ApiTags('Notificaciones')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  // Notificar a un usuario específico
  @Post(':recipientId')
  @ApiOperation({ summary: 'Notificar a un usuario' })
  @ApiParam({ name: 'recipientId', description: 'ID del usuario que recibirá la notificación' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        senderId: { type: 'number', nullable: true },
        resourceType: { type: 'string', enum: ['VACATION', 'LICENSE'], nullable: true },
        resourceId: { type: 'number', nullable: true },
      },
      required: ['message'],
    },
  })
  @ApiResponse({ status: 201, description: 'Notificación creada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Usuario destinatario no encontrado.' })
  async notifyUser(
    @Param('recipientId') recipientId: number,
    @Body() body: {
      message: string;
      senderId?: number;
      resourceType?: 'VACATION' | 'LICENSE';
      resourceId?: number;
    },
  ) {
    return await this.notificationService.notifyUser({
      recipientId,
      ...body,
    });
  }


  // Notificar a todos los administradores
  @Post('admins')
  @ApiOperation({ summary: 'Notificar a todos los administradores' })
  @ApiBody({ schema: { properties: { message: { type: 'string' }, senderId: { type: 'number', required: null } } } })
  @ApiResponse({ status: 201, description: 'Notificación enviada a todos los administradores.' })
  async notifyAdmins(
    @Body('message') message: string,
    @Body('senderId') senderId?: number,
  ) {
    return await this.notificationService.notifyAdmins(message, senderId);
  }
  // Aquí va el método de las notificaciones
  @Get('admins')
  @ApiOperation({ summary: 'Obtener todas las notificaciones de los administradores' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones para todos los administradores.' })
  async getNotificationsForAdmins(): Promise<NotificationResponseDto[]> {
    return await this.notificationService.getNotificationsForAdmins();
  }
  // Obtener notificaciones no leídas de un usuario
  @Get(':userId/unread')
  @ApiOperation({ summary: 'Obtener notificaciones no leídas de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones no leídas.' })
  async getUnreadNotifications(@Param('userId') userId: number) {
    return await this.notificationService.getUnreadNotifications(userId);
  }

  // Marcar una notificación como leída
  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiParam({ name: 'notificationId', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída.' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada.' })
  async markAsRead(@Param('notificationId') notificationId: number) {
    return await this.notificationService.markAsRead(notificationId);
  }

  // Obtener todas las notificaciones de un usuario
  @Get(':userId')
  @ApiOperation({ summary: 'Obtener todas las notificaciones de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones del usuario.' })
  async getNotificationsByUser(@Param('userId') userId: number): Promise<NotificationResponseDto[]> {
    return await this.notificationService.getNotificationsByUser(userId);
  }


}
