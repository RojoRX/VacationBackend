import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';


@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService, private reflector: Reflector, private configService: ConfigService,) { }
    // 👈 Inyectamos ConfigService
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            // 💡 See this condition
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
            throw new UnauthorizedException();
        }
try {
        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
            //console.error('[AuthGuard] ERROR: La variable de entorno JWT_SECRET no está configurada.');
            throw new UnauthorizedException('Configuración de JWT inválida.');
        }
        //console.log('[AuthGuard] Token extraído:', token);
        //console.log('[AuthGuard] Usando secreto JWT:', secret ? '***OCULTADO***' : 'NO CONFIGURADO');

        const payload = await this.jwtService.verifyAsync(token, {
            secret: secret,
        });

       // console.log('[AuthGuard] JWT Payload decodificado:', payload);

        // --- CAMBIO AQUÍ ---
        // Verifica si el payload contiene 'sub' en lugar de 'id'
        if (!payload || typeof payload.sub === 'undefined') { // CAMBIO: de payload.id a payload.sub
           // console.error('[AuthGuard] El payload del JWT decodificado no contiene una propiedad "sub" o es nulo. Payload:', payload);
            throw new UnauthorizedException('Información de usuario incompleta en el token JWT. Falta ID (sub).');
        }
        if (typeof payload.role === 'undefined') {
           // console.warn('[AuthGuard] Advertencia: El payload del JWT decodificado no contiene una propiedad "role". Payload:', payload);
        }
        // --- FIN CAMBIO ---

        // Asigna el ID del usuario desde 'sub' a 'user.id'
        // Esto asegura que request.user.id tenga el valor correcto para el controlador.
        request['user'] = {
            id: payload.sub, // CAMBIO: Mapea 'sub' a 'id'
            role: payload.role, // Asegúrate de que tu JWT esté incluyendo 'role' si lo necesitas en el controlador
            // Puedes mapear otras propiedades si las necesitas en req.user
            username: payload.username // Por ejemplo
        };


    } catch (error) {
        console.error('[AuthGuard] Error durante la verificación del token JWT:', error.message);
        if (error.name === 'TokenExpiredError') {
            throw new UnauthorizedException('El token de autorización ha expirado.');
        } else if (error.name === 'JsonWebTokenError') {
            throw new UnauthorizedException('Token de autorización inválido.');
        } else {
            throw new UnauthorizedException('Error de autenticación inesperado.');
        }
    }
    return true;
}

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}



