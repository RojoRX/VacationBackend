import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { JwtService } from '@nestjs/jwt';
import { mapRole } from './role.mapper'; // Asegúrate de que la ruta sea correcta
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService
  ) { }

  // ...
  async signIn(
    identifier: string,
    pass: string
  ): Promise<{ accessToken: string; userData: any }> {
    const user = await this.usersService.findByUsernameOrCi(identifier);

    // --- MODIFICACIÓN RECOMENDADA AQUÍ ---
    // Primero verifica si el usuario fue encontrado
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Ahora, solo si el usuario existe, compara la contraseña
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // --- FIN MODIFICACIÓN ---

    const userRoleMapped = mapRole(user.role);

    // El payload ahora incluye 'sub' (ID), 'username', y 'role'
    const payload = { sub: user.id, username: user.username, role: userRoleMapped };
    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      userData: {
        id: user.id,
        username: user.username,
        email: user.email ?? null,
        role: mapRole(user.role), // Still good to map for userData display
        ci: user.ci,
        fullName: user.fullName,
        celular: user.celular ?? null,
        tipoEmpleado: user.tipoEmpleado,
        fechaIngreso: user.fecha_ingreso,
        department: user.department?.name ?? null,
        academicUnit: user.academicUnit?.name ?? null,
        profession: user.profession?.name ?? null,
      }
    };
  }



  async getUserById(id: number) {
    const user = await this.usersService.findById(id);

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    return {
      id: user.id,
      ci: user.ci,
      fecha_ingreso: user.fecha_ingreso,
      username: user.username,
      email: user.email,
      role: mapRole(user.role),
      fullName: user.fullName,
      celular: user.celular,
      professionId: user.profession?.name ?? null,
      position: user.position,
      tipoEmpleado: user.tipoEmpleado,
      department: user.department?.name ?? null,
      academicUnit: user.academicUnit?.name ?? null,
      profession: user.profession?.name ?? null,
    };
  }


}
