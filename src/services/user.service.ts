import { Injectable, HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
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
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { Profession } from 'src/entities/profession.entity';
import { AcademicUnit } from 'src/entities/academic-unit.entity';
import { CredentialDto } from 'src/dto/credentials.dto';
@Injectable()
export class UserService {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Profession) private readonly profesionRepository: Repository<Profession>,
    @InjectRepository(AcademicUnit) private readonly academicUnitRepository: Repository<AcademicUnit>,
  ) { }

  // Método para crear usuarios internamente con generación automática de credenciales
  async registerUserData(createUserDto: CreateUserDto): Promise<User> {
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

    // 3. Validar fecha de ingreso
    const fechaIngreso = new Date(createUserDto.fecha_ingreso);
    if (isNaN(fechaIngreso.getTime())) {
      throw new BadRequestException('Fecha de ingreso no válida');
    }
    if (fechaIngreso > new Date()) {
      throw new BadRequestException('La fecha de ingreso no puede ser futura');
    }

    // 4. Validar profesión y unidad académica
    const profession = await this.profesionRepository.findOne({ where: { id: normalizedDto.professionId } });
    if (!profession) {
      throw new BadRequestException('Profesión no encontrada.');
    }

    const academicUnit = await this.academicUnitRepository.findOne({ where: { id: normalizedDto.academicUnitId } });
    if (!academicUnit) {
      throw new BadRequestException('Unidad académica no encontrada.');
    }

    // 5. Crear usuario sin credenciales
    const user = this.userRepository.create({
      ci: normalizedDto.ci,
      email: normalizedDto.email,
      fullName: normalizedDto.fullName,
      celular: normalizedDto.celular,
      profession,
      academicUnit,
      fecha_ingreso: normalizedDto.fecha_ingreso,
      position: normalizedDto.position,
      tipoEmpleado: createUserDto.tipoEmpleado,
      role: normalizedDto.role || RoleEnum.USER,
      department: normalizedDto.departmentId ? { id: normalizedDto.departmentId } : null,
    });

    // 6. Guardar y retornar
    const savedUser = await this.userRepository.save(user);
    return savedUser;
  }
  async createUserCredentials(ci: string, credentialsDto: CredentialDto): Promise<{ username: string, temporaryPassword?: string }> {
    const user = await this.userRepository.findOne({ where: { ci } });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.username || user.password) {
      throw new BadRequestException('Este usuario ya tiene credenciales asignadas');
    }

    let username = credentialsDto.username;

    // Si no se proporciona username, generar uno automáticamente
    if (!username) {
      if (!user.fullName || !user.ci) {
        throw new BadRequestException('No se puede generar un username automáticamente por falta de información');
      }

      const nombre = user.fullName.trim().toLowerCase().split(' ');
      const baseUsername = `${nombre[0]}.${nombre[1] || 'user'}${user.ci.slice(-3)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      username = baseUsername;

      let counter = 1;
      while (await this.userRepository.findOne({ where: { username } })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
    } else {
      // Validar que el username proporcionado sea único
      const existingUserByUsername = await this.userRepository.findOne({ where: { username } });
      if (existingUserByUsername) {
        throw new BadRequestException('El nombre de usuario ya está en uso');
      }
    }

    // Generar o usar contraseña
    const password = credentialsDto.password || generateMemorablePassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    user.username = username;
    user.password = hashedPassword;

    await this.userRepository.save(user);

    return {
      username,
      temporaryPassword: credentialsDto.password ? undefined : password
    };
  }
  async updateUserPasswordByAdmin(
    ci: string,
    credentialsDto: { password?: string }
  ): Promise<{ username: string; temporaryPassword?: string }> {
    const user = await this.userRepository.findOne({ where: { ci } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.username || !user.password) {
      throw new BadRequestException('Este usuario aún no tiene credenciales asignadas');
    }

    const newPassword = credentialsDto.password || generateMemorablePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await this.userRepository.save(user);

    return {
      username: user.username,
      temporaryPassword: credentialsDto.password ? undefined : newPassword,
    };
  }
  async findByCarnet(ci: string): Promise<Omit<User, 'password'> | undefined> {
    const user = await this.userRepository.findOne({
      where: { ci },
      relations: ['department', 'academicUnit', 'profession'],
    });
    return this.transformUser(user);
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.userRepository.findOne({
      where: { username },
      relations: ['department', 'academicUnit', 'profession'],
    });
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

  // Ajusta findById para aceptar relaciones opcionales
// Ajusta findById para retornar siempre las relaciones específicas y aceptar otras opcionales
async findById(userId: number, options?: { relations?: string[] }): Promise<Omit<User, 'password'> | undefined> {
  const defaultRelations = ['department', 'academicUnit', 'profession'];
  const allRelations = options?.relations
    ? [...new Set([...defaultRelations, ...options.relations])] // Combina y elimina duplicados
    : defaultRelations; // Si no hay opciones, usa solo las por defecto

  const user = await this.userRepository.findOne({
    where: { id: userId },
    relations: allRelations, // Siempre incluye las relaciones por defecto
  });
  console.log(this.transformUser(user));
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
      relations: ['department', 'academicUnit', 'profession'],
    });
    return users.map(user => this.transformUser(user));
  }


  async getUserBasicInfoById(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['department', 'academicUnit', 'profession'], });
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    console.log("Info Basica")
    return this.transformUser(user) as Omit<User, 'password'>;
  }
  //User Interface
async updateUserFields(
  userId: number,
  updateData: Partial<{
    email: string; // Nuevo campo permitido para actualización
    celular: string;
  }>
): Promise<Omit<User, 'password'>> {
  // 1. Buscar al usuario por su ID
  const user = await this.userRepository.findOne({
    where: { id: userId },
    // Ya no necesitamos cargar relaciones si solo actualizamos email y celular directamente en el usuario
    // Si 'email' o 'celular' son campos de la entidad 'User' directamente, las relaciones son irrelevantes aquí.
  });

  // 2. Verificar si el usuario existe
  if (!user) {
    throw new BadRequestException('Usuario no encontrado.');
  }

  // 3. Aplicar las actualizaciones solo para email y celular
  // Usamos el operador '??' (nullish coalescing) para asegurar que solo se actualicen si el valor está presente en updateData
  user.email = updateData.email ?? user.email;
  user.celular = updateData.celular ?? user.celular;

  // 4. Guardar los cambios en la base de datos
  await this.userRepository.save(user);

  // 5. Transformar y retornar el usuario actualizado (sin la contraseña)
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
        profession: user.profession,
        fecha_ingreso: user.fecha_ingreso,
        position: user.position, // Incluir el campo position
        // Excluir la contraseña del retorno
      };
    }
    // Si no se encuentra información, lanzar un error
    throw new BadRequestException('Usuario no encontrado en la base de datos ni en la API externa.');
  }

  // Admin interface
  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    console.log('Datos recibidos para actualizar usuario:', updateUserDto);

    const normalizedDto = normalizeUserData(updateUserDto);

    // Validar CI único si se cambió
    if (normalizedDto.ci && normalizedDto.ci !== user.ci) {
      const existingUserByCi = await this.userRepository.findOne({ where: { ci: normalizedDto.ci } });
      if (existingUserByCi && existingUserByCi.id !== user.id) {
        throw new BadRequestException('El CI ya está registrado por otro usuario');
      }
    }

    // Validar email único si se cambió
    if (normalizedDto.email && normalizedDto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({ where: { email: normalizedDto.email } });
      if (existingEmail && existingEmail.id !== user.id) {
        throw new BadRequestException('El email ya está registrado por otro usuario');
      }
    }

    // Validar fecha de ingreso
    if (normalizedDto.fecha_ingreso) {
      const fechaIngreso = parseDatePreservingLocal(normalizedDto.fecha_ingreso); // ✅ mantiene el día
      if (isNaN(fechaIngreso.getTime())) {
        throw new BadRequestException('Fecha de ingreso no válida');
      }
      if (fechaIngreso > new Date()) {
        throw new BadRequestException('La fecha de ingreso no puede ser futura');
      }
      user.fecha_ingreso = normalizedDto.fecha_ingreso;
    }

    // Relación: Departamento
    if (normalizedDto.departmentId) {
      const department = await this.departmentRepository.findOne({ where: { id: normalizedDto.departmentId } });
      if (!department) {
        throw new BadRequestException('Departamento no encontrado');
      }
      user.department = department;
    }

    // Relación: Unidad Académica
    if (normalizedDto.academicUnitId) {
      const academicUnit = await this.academicUnitRepository.findOne({ where: { id: normalizedDto.academicUnitId } });
      if (!academicUnit) {
        throw new BadRequestException('Unidad académica no encontrada');
      }
      user.academicUnit = academicUnit;
    }

    // Relación: Profesión
    if (normalizedDto.professionId) {
      const profession = await this.profesionRepository.findOne({ where: { id: normalizedDto.professionId } });
      if (!profession) {
        throw new BadRequestException('Profesión no encontrada');
      }
      user.profession = profession;
    }

    // Asignar campos simples (sin modificar username ni password)
    user.fullName = normalizedDto.fullName ?? user.fullName;
    user.ci = normalizedDto.ci ?? user.ci;
    user.email = normalizedDto.email ?? user.email;
    user.celular = normalizedDto.celular ?? user.celular;
    user.position = normalizedDto.position ?? user.position;
    user.tipoEmpleado = normalizedDto.tipoEmpleado ?? user.tipoEmpleado;
    user.role = normalizedDto.role ?? user.role;

    // Guardar usuario actualizado
    const updatedUser = await this.userRepository.save(user);
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }
//Autenticacion 
  async findOne(username: string): Promise<User | undefined> {
    return this.userRepository.findOne({
      where: { username },
      relations: ['department', 'academicUnit', 'profession'], // agrega las relaciones que necesites
    });
  }
}



function parseDatePreservingLocal(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // OJO: month en Date constructor es 0-indexado
  return new Date(year, month - 1, day);
}


