import { Controller, Post, Body, Param, Get, Patch } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";
import { NotificationService } from "src/services/notification.service";
import { NotificationResponseDto } from "src/dto/notification-response.dto";

@ApiTags('Notificaciones') // Agrupa las rutas bajo esta etiqueta en Swagger
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post(':recipientId')
  @ApiOperation({ summary: 'Notificar a un usuario' })
  @ApiParam({ name: 'recipientId', description: 'ID del usuario que recibirá la notificación' })
  @ApiBody({ schema: { properties: { message: { type: 'string' }, senderId: { type: 'number', required: null } } } })
  @ApiResponse({ status: 201, description: 'Notificación creada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Usuario destinatario no encontrado.' })
  async notifyUser(
    @Param('recipientId') recipientId: number,
    @Body('message') message: string,
    @Body('senderId') senderId?: number,
  ) {
    return await this.notificationService.notifyUser(recipientId, message, senderId);
  }

  @Get(':userId/unread')
  @ApiOperation({ summary: 'Obtener notificaciones no leídas de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones no leídas.' })
  async getUnreadNotifications(@Param('userId') userId: number) {
    return await this.notificationService.getUnreadNotifications(userId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiParam({ name: 'notificationId', description: 'ID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída.' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada.' })
  async markAsRead(@Param('notificationId') notificationId: number) {
    return await this.notificationService.markAsRead(notificationId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Obtener todas las notificaciones de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones del usuario.' })
  async getNotificationsByUser(@Param('userId') userId: number): Promise<NotificationResponseDto[]> {
    return await this.notificationService.getNotificationsByUser(userId);
  }
}
