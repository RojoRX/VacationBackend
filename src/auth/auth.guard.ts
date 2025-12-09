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
import { UserService } from 'src/services/user.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private reflector: Reflector,
        private configService: ConfigService,
        private userService: UserService,   // Para validar tokenVersion
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        console.log('[AuthGuard] isPublic:', isPublic);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            console.log('[AuthGuard] No se encontró token en el request');
            throw new UnauthorizedException('Token no encontrado.');
        }

        console.log('[AuthGuard] Token extraído:', token);

        try {
            const secret = this.configService.get<string>('JWT_SECRET');

            if (!secret) {
                console.log('[AuthGuard] JWT_SECRET no configurado');
                throw new UnauthorizedException('Configuración de JWT inválida.');
            }

            const payload = await this.jwtService.verifyAsync(token, {
                secret: secret,
            });

            console.log('[AuthGuard] Payload decodificado:', payload);

            // Validación básica del payload
            if (!payload || typeof payload.sub === 'undefined') {
                console.log('[AuthGuard] Payload inválido o sin sub');
                throw new UnauthorizedException(
                    'Información de usuario incompleta en el token (sub).'
                );
            }

            // 🔥 Validación de tokenVersion
            const userInDb = await this.userService.findById(payload.sub);
            console.log('[AuthGuard] Usuario en DB:', userInDb);

            if (!userInDb) {
                console.log('[AuthGuard] Usuario no encontrado en la DB');
                throw new UnauthorizedException('Usuario no encontrado.');
            }

            console.log(
                '[AuthGuard] tokenVersion payload:',
                payload.tokenVersion,
                'tokenVersion DB:',
                userInDb.tokenVersion
            );

            if (Number(payload.tokenVersion) !== Number(userInDb.tokenVersion)) {
                console.log(
                    '[AuthGuard] Token desactualizado. Debe iniciar sesión nuevamente'
                );
                throw new UnauthorizedException(
                    'Token desactualizado. Por favor, inicie sesión nuevamente.'
                );
            }

            // Asignación a req.user
            request['user'] = {
                id: payload.sub,
                role: payload.role,
                username: payload.username,
            };

            console.log('[AuthGuard] request.user asignado:', request['user']);

        } catch (error) {
            console.error(
                '[AuthGuard] Error durante la verificación del token JWT:',
                error.message
            );

            if (error.name === 'TokenExpiredError') {
                throw new UnauthorizedException('El token ha expirado.');
            } else if (error.name === 'JsonWebTokenError') {
                throw new UnauthorizedException('Token inválido.');
            } else {
                throw new UnauthorizedException('Error de autenticación.');
            }
        }

        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
