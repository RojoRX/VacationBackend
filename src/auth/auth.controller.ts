import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignInDto } from './sign-in.dto';
import { AuthGuard } from './auth.guard';
import { Public } from './public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Retorna el token JWT.',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

@UseGuards(AuthGuard) // Aquí usas tu AuthGuard
  @Get('me')
  async getMe(@Req() req) {
    // 1. PRIMER CONSOLE.LOG: Verifica lo que tu AuthGuard ha puesto en req.user
    // 2. Llama al servicio para obtener el usuario completo por su ID
    //    (el ID que viene del token y que tu AuthGuard puso en req.user.id)
    const userDetails = await this.authService.getUserById(req.user.id); // <--- LÍNEA CLAVE
    // Asegúrate de que el objeto que devuelves aquí tenga el rol correcto
    return { userData: userDetails }; // Esto es lo que el frontend recibe como response.data.userData
  }
}
