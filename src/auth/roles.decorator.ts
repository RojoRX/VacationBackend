import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { RoleEnum } from 'src/enums/role.enum';
// Define una clave constante para los metadatos.
// Esto ayuda a evitar errores tipográficos y es una buena práctica.
export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar los roles permitidos para una ruta o un controlador.
 *
 * @param roles Una lista de roles que tienen permiso para acceder a la ruta.
 * @returns Un CustomDecorator que adjunta los roles como metadatos.
 */
export const Roles = (...roles: RoleEnum[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);