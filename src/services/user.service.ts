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
  async findByUsernameOrCi(identifier: string): Promise<User | undefined> {
    return this.userRepository.findOne({
      where: [
        { username: identifier },
        { ci: identifier }
      ],
      relations: ['department', 'academicUnit', 'profession']
    });
  }
 async getAllUsersWithDetails(): Promise<
    Array<{
      id: number;
      ci: string;
      fullName: string;
      role: RoleEnum; // Es mejor mantenerlo tipado como RoleEnum
      department?: string | null; // Puede ser string o null si no tiene
      academicUnit?: string | null; // Puede ser string o null si no tiene
      email?: string | null;
      position?: string | null;
      celular?: string | null;
      profession?: string | null;
      tipoEmpleado?: string | null;
    }>
  > {
    const users = await this.userRepository.find({
      // Eliminamos la cláusula 'where' para obtener todos los usuarios
      relations: ['department', 'academicUnit', 'profession'], // Aseguramos que estas relaciones se carguen
      select: [
        'id',
        'ci',
        'fullName',
        'role',
        'email',
        'position',
        'celular', // Añade celular si lo quieres mostrar
        'tipoEmpleado', // Añade tipoEmpleado si lo quieres mostrar
        // Las relaciones 'department', 'academicUnit', 'profession' no se listan aquí en 'select' directamente,
        // pero sus propiedades serán accesibles si se cargan en 'relations'.
      ],
      order: {
        // Ordena primero por el nombre del departamento y luego por la unidad académica
        // TypeORM 0.3.x+ permite ordenar por propiedades de relaciones.
        // Si tienes problemas con esto en tu versión de TypeORM, consulta la nota a continuación.
        department: { name: 'ASC' },
        academicUnit: { name: 'ASC' },
        fullName: 'ASC', // Luego por el nombre completo del usuario
      },
    });

    // Mapeamos los usuarios para aplanar los datos y devolver solo lo necesario para el frontend
    return users.map(user => ({
      id: user.id,
      ci: user.ci,
      fullName: user.fullName,
      role: user.role,
      department: user.department ? user.department.name : null, // Accede al nombre del departamento
      academicUnit: user.academicUnit ? user.academicUnit.name : null, // Accede al nombre de la unidad académica
      email: user.email || null,
      position: user.position || null,
      celular: user.celular || null,
      profession: user.profession ? user.profession.name : null, // Accede al nombre de la profesión
      tipoEmpleado: user.tipoEmpleado || null,
    }));
  }
  async updateRole(id: number, newRole: RoleEnum): Promise<User> {
    // 1. Iniciar una transacción para asegurar la atomicidad de las operaciones
    //    Esto es crucial si vamos a actualizar dos usuarios diferentes (el nuevo supervisor y el antiguo)
    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Verificar si el usuario a actualizar existe y cargar sus relaciones
      const userToUpdate = await queryRunner.manager.findOne(User, {
        where: { id },
        relations: ['department', 'academicUnit'], // Cargar relaciones para validación de supervisor
      });

      if (!userToUpdate) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
      }

      // Si el rol es el mismo y no es supervisor (no hay lógica de reemplazo para otros roles),
      // no hacemos nada y devolvemos el usuario actual.
      if (userToUpdate.role === newRole && newRole !== RoleEnum.SUPERVISOR) {
        return userToUpdate; // Retorna el userToUpdate original si el rol no cambia y no es supervisor
      }

      const oldRole = userToUpdate.role; // Guardamos el rol actual del usuario

      // 3. Aplicar lógica de validación según el nuevo rol
      if (newRole === RoleEnum.SUPERVISOR) {
        // 3.1. Validar que el usuario tenga un departamento o unidad académica asignados
        if (!userToUpdate.department && !userToUpdate.academicUnit) {
          throw new BadRequestException(
            'Para asignar el rol de Supervisor, el usuario debe tener un Departamento o una Unidad Académica asignados.',
          );
        }

        // 3.2. Buscar un supervisor existente en la misma unidad/departamento
        const existingSupervisorQuery = queryRunner.manager.createQueryBuilder(User, 'user')
          .where('user.role = :supervisorRole', { supervisorRole: RoleEnum.SUPERVISOR })
          .andWhere('user.id != :currentUserId', { currentUserId: id }); // Excluir al usuario que estamos actualizando

        if (userToUpdate.department) {
          existingSupervisorQuery.andWhere('user.department.id = :departmentId', {
            departmentId: userToUpdate.department.id,
          });
        } else if (userToUpdate.academicUnit) {
          existingSupervisorQuery.andWhere('user.academicUnit.id = :academicUnitId', {
            academicUnitId: userToUpdate.academicUnit.id,
          });
        }

        const existingSupervisor = await existingSupervisorQuery.getOne();

        // 3.3. Si se encontró un supervisor anterior, desasignarle el rol de Supervisor
        if (existingSupervisor) {
          existingSupervisor.role = RoleEnum.USER; // Asignar el rol 'USER' al supervisor anterior
          await queryRunner.manager.save(existingSupervisor); // Guardar el cambio al supervisor anterior
          console.log(`Supervisor anterior (ID: ${existingSupervisor.id}, Rol: ${oldRole}) desasignado del ${
            userToUpdate.department ? 'Departamento' : 'Unidad Académica'
          } y asignado a USER.`);
        }

        // 3.4. Si el usuario que estamos actualizando ya era supervisor de la misma unidad/dpto
        // y le estamos asignando el mismo rol de supervisor, no es un cambio.
        // La validación anterior `userToUpdate.role === newRole` ya debería haberlo capturado si no hay reemplazo.
        // Pero si hay reemplazo, siempre aplicamos la lógica.

      } else if (newRole === RoleEnum.ADMIN) {
        // 3.5. Validar límite máximo de administradores
        const MAX_ADMINS = 10;
        const adminCount = await queryRunner.manager.count(User, {
          where: { role: RoleEnum.ADMIN },
        });

        // Si el usuario actual no era admin, y al añadirlo se excede el límite
        if (oldRole !== RoleEnum.ADMIN && adminCount >= MAX_ADMINS) {
          throw new BadRequestException(
            `No se puede asignar el rol de Administrador. Ya existen ${MAX_ADMINS} administradores (límite máximo).`,
          );
        }
      }
      // Si el nuevo rol es 'USER' o cualquier otro que no sea Supervisor/Admin,
      // no se aplican restricciones especiales aquí, solo se actualizará el rol del usuario.

      // 4. Asignar el nuevo rol al usuario principal
      userToUpdate.role = newRole;
      const updatedUser = await queryRunner.manager.save(userToUpdate); // Guardar el usuario principal

      // 5. Confirmar la transacción
      await queryRunner.commitTransaction();

      return updatedUser;
    } catch (error) {
      // 6. Si ocurre un error, revertir la transacción
      await queryRunner.rollbackTransaction();
      // Re-lanzar la excepción para que sea manejada por el controlador o la capa superior
      throw error;
    } finally {
      // 7. Liberar el queryRunner
      await queryRunner.release();
    }
  }
}


function parseDatePreservingLocal(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // OJO: month en Date constructor es 0-indexado
  return new Date(year, month - 1, day);
}


