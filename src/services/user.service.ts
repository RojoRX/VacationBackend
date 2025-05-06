import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Department } from 'src/entities/department.entity';
import { RoleEnum } from 'src/enums/role.enum';
import { lastValueFrom } from 'rxjs';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { 
  generateUsername, 
  generateMemorablePassword 
} from '../utils/credential.utils';
import { normalizeUserData } from 'src/utils/normalizeUserData';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

// Método para crear usuarios internamente con generación automática de credenciales
async createUser(createUserDto: CreateUserDto): Promise<Omit<User, 'password'> & { temporaryPassword?: string }> {
  const normalizedDto = normalizeUserData(createUserDto);
  // 1. Validar CI único
  const existingUserByCi = await this.userRepository.findOne({ 
    where: { ci: createUserDto.ci } 
  });
  if (existingUserByCi) {
    throw new BadRequestException('El CI ya está registrado');
  }

  // 2. Validar email único (si se proporciona)
  if (createUserDto.email) {
    const existingUserByEmail = await this.userRepository.findOne({ 
      where: { email: createUserDto.email } 
    });
    if (existingUserByEmail) {
      throw new BadRequestException('El email ya está registrado');
    }
  }

  // 3. Generar username automático si no se proporcionó
  const username = createUserDto.username || generateUsername(
    createUserDto.fullName, 
    createUserDto.ci
  );

  // 4. Validar username único
  const existingUserByUsername = await this.userRepository.findOne({ 
    where: { username } 
  });
  if (existingUserByUsername) {
    throw new BadRequestException('El nombre de usuario ya está en uso');
  }

// Validar fecha (además de las otras validaciones existentes)
const fechaIngreso = new Date(createUserDto.fecha_ingreso);
if (isNaN(fechaIngreso.getTime())) {
  throw new BadRequestException('Fecha de ingreso no válida');
}

// Validar que no sea fecha futura (opcional)
if (fechaIngreso > new Date()) {
  throw new BadRequestException('La fecha de ingreso no puede ser futura');
}
  // 5. Generar contraseña automática si no se proporcionó
  const password = createUserDto.password || generateMemorablePassword();
  const hashedPassword = await bcrypt.hash(password, 10);

  // 6. Crear el usuario (incluyendo email si existe)
  const newUser = this.userRepository.create({
    ci: normalizedDto.ci,
    username,
    password: hashedPassword,
    email: normalizedDto.email,
    fullName: normalizedDto.fullName,
    celular: normalizedDto.celular,
    profesion: normalizedDto.profesion,
    fecha_ingreso: normalizedDto.fecha_ingreso,
    position: normalizedDto.position,
    tipoEmpleado: createUserDto.tipoEmpleado,
    role: normalizedDto.role || RoleEnum.USER,
    department: normalizedDto.departmentId ? { id: normalizedDto.departmentId } : null,
  });

  const savedUser = await this.userRepository.save(newUser);
  
  // 7. Retornar el usuario sin password hasheada + contraseña temporal
  const { password: _, ...userResponse } = savedUser;
  return {
    ...userResponse,
    temporaryPassword: createUserDto.password ? undefined : password, // Solo si se generó automáticamente
    id: savedUser.id, // esto es redundante si ya está en userResponse, pero explícito
    ci: savedUser.ci
  };
}



  async findByCarnet(ci: string): Promise<Omit<User, 'password'> | undefined> {
    const user = await this.userRepository.findOne({ where: { ci }, relations: ['department'] });
    return this.transformUser(user);
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { username } });
  }

  async validatePassword(username: string, password: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async updateDepartment(userId: number, departmentId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const department = await this.departmentRepository.findOne({ where: { id: departmentId } });
    if (!department) throw new Error('Department not found');
    user.department = department;
    await this.userRepository.save(user);
  }

  async findById(userId: number): Promise<Omit<User, 'password'> | undefined> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['department'],
    });
    return this.transformUser(user);
  }

  async updateUserRole(userId: number, newRole: RoleEnum): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (!Object.values(RoleEnum).includes(newRole)) {
      throw new BadRequestException('Rol inválido.');
    }
    user.role = newRole;
    await this.userRepository.save(user);
  }

  private transformUser(user?: User): Omit<User, 'password'> | undefined {
    if (!user) return undefined;
    const { password, ...userData } = user;
    return userData;
  }

  async searchUsersByCI(ci: string, skip = 0, take = 10): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      where: { ci: Like(`%${ci}%`) },
      skip,
      take,
      relations: ['department'],
    });
    return users.map(user => this.transformUser(user));
  }

  async getUserBasicInfoById(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    return this.transformUser(user) as Omit<User, 'password'>;
  }
  async updateUserFields(
    userId: number,
    updateData: Partial<{
      fullName: string;
      celular: string;
      profesion: string;
      position: string;
      departmentId: number;
    }>
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['department'],
    });

    if (!user) throw new BadRequestException('Usuario no encontrado.');

    if (updateData.departmentId !== undefined) {
      const department = await this.departmentRepository.findOne({ where: { id: updateData.departmentId } });
      if (!department) throw new BadRequestException('Departamento no encontrado.');
      user.department = department;
    }

    user.fullName = updateData.fullName ?? user.fullName;
    user.celular = updateData.celular ?? user.celular;
    user.profesion = updateData.profesion ?? user.profesion;
    user.position = updateData.position ?? user.position;

    await this.userRepository.save(user);
    return this.transformUser(user) as Omit<User, 'password'>;
  }


  async getUserData(carnetIdentidad: string): Promise<any> {
    // Buscar usuario en la base de datos
    const user = await this.findByCarnet(carnetIdentidad);
    
    if (user) {
      // Retornar datos del usuario desde la base de datos
      return {
        id: user.id,
        nombres: user.fullName,
        correo_electronico: user.username,
        profesion: user.profesion,
        fecha_ingreso: user.fecha_ingreso,
        position: user.position, // Incluir el campo position
        // Excluir la contraseña del retorno
      };
    }
    // Si no se encuentra información, lanzar un error
    throw new BadRequestException('Usuario no encontrado en la base de datos ni en la API externa.');
    }
}