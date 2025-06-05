// Importa 'Request' de 'express' para extender su tipo base
import { Request } from 'express';

/**
 * @interface JwtPayload
 * Define la estructura esperada del payload de tu JSON Web Token (JWT).
 * Estas propiedades son las que tu AuthGuard extrae del token.
 */
export interface JwtPayload {
  id: number;    // La ID del usuario autenticado.
  role: string;  // El rol del usuario autenticado (ej. 'ADMIN', 'USER', 'SUPERVISOR').
  // Puedes añadir más propiedades aquí si tu JWT las contiene (ej. email?: string; username?: string;).
}

/**
 * @interface CustomRequest
 * Extiende la interfaz 'Request' de Express para incluir la propiedad 'user'
 * con el tipo 'JwtPayload'. Esto proporciona un tipado fuerte y autocompletado
 * para la información del usuario autenticado en los controladores y guards.
 */
export interface CustomRequest extends Request {
  user: JwtPayload;
}