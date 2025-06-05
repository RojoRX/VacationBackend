import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // Necesario para leer los metadatos
import { ROLES_KEY } from './roles.decorator';
import { RoleEnum } from 'src/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { } // Inyecta Reflector para acceder a los metadatos

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtener los roles requeridos para la ruta
    // El Reflector lee los metadatos asociados a la clave 'roles'
    // en el manejador de la ruta (el método del controlador) o en la clase del controlador.
    const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(ROLES_KEY, [
      context.getHandler(), // Obtiene metadatos del método (ej. @Delete('admin-remove'))
      context.getClass(),   // Obtiene metadatos de la clase (ej. @Controller('licenses'))
    ]);

    // Si no se han especificado roles requeridos para esta ruta,
    // significa que cualquier usuario autenticado puede acceder.
    if (!requiredRoles) {
      return true;
    }

    // 2. Obtener el usuario autenticado del objeto request
    // Asumimos que tu AuthGuard ya ha adjuntado el payload del JWT
    // (que incluye el rol) a `request.user`.
    const { user } = context.switchToHttp().getRequest();

    // Verificación de existencia del usuario y su rol
    // Si no hay un objeto user o no tiene una propiedad 'role', denegamos el acceso.
    if (!user || !user.role) {
      // Opcional: Podrías lanzar una UnauthorizedException si quieres un mensaje diferente
      // pero ForbiddenException es más apropiado si el problema es la falta de permiso.
      throw new ForbiddenException('No tiene los permisos necesarios para acceder a este recurso.');
    }

    // 3. Verificar si el rol del usuario está entre los roles permitidos
    // `some()` devuelve true si al menos uno de los roles requeridos coincide con el rol del usuario.
    // --- ¡Aquí el cambio en RolesGuard! ---
    // Convierte el rol del usuario a mayúsculas para la comparación
    const userRoleUpperCase = String(user.role).toUpperCase();
    const hasPermission = requiredRoles.some((role) => userRoleUpperCase === role);
    // ------------------------------------

    if (!hasPermission) {
      throw new ForbiddenException('No tiene los permisos necesarios para acceder a este recurso.');
    }

    return hasPermission;
  }
}