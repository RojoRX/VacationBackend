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

  async signIn(
    identifier: string, // puede ser username o ci
    pass: string
  ): Promise<{ accessToken: string; userData: any }> {
    // Buscar usuario por username o ci
    const user = await this.usersService.findByUsernameOrCi(identifier);

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!user || !isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const userRoleMapped = mapRole(user.role); // Usamos tu mapRole para obtener el string final del rol


    const payload = { sub: user.id, username: user.username, role: userRoleMapped, };
    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      userData: {
        id: user.id,
        username: user.username,
        email: user.email ?? null,
        role: mapRole(user.role),
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
