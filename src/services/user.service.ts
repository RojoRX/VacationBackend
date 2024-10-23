import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from 'src/entities/user.entity'; // Ajusta la ruta según tu estructura
import * as bcrypt from 'bcrypt';
import { Department } from 'src/entities/department.entity';
import { RoleEnum } from 'src/enums/role.enum';

@Injectable()
export class UserService {
  private readonly apiUrl = process.env.API_BASE_URL || 'http://localhost:1337/api/personas';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) { }

  async verifyWithExternalApi(ci: string): Promise<any> {
    try {
      const response = await this.httpService.get<{ data: any }>(`${this.apiUrl}?filters[ci][$eq]=${ci}`).toPromise();
      return response.data.data[0] || null;
    } catch (error) {
      throw new HttpException('Error verifying user with external API', HttpStatus.BAD_GATEWAY);
    }
  }

  async createUserFromApi(ci: string, username: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const apiData = await this.verifyWithExternalApi(ci);

    if (!apiData) {
      throw new HttpException('User not found in external API', HttpStatus.NOT_FOUND);
    }

    const attributes = apiData.attributes;

    const newUser = this.userRepository.create({
      ci,
      username,
      password: hashedPassword,
      fullName: `${attributes.nombres || ''} ${attributes.apellido_paterno || ''} ${attributes.apellido_materno || ''}`.trim(),
      celular: attributes.celular || '',
      profesion: attributes.profesion || '',
      fecha_ingreso: attributes.fecha_ingreso,
      role: RoleEnum.USER,
      position: '', // Dejar vacío ya que no viene desde la API externa
    });

    return this.userRepository.save(newUser);
  }

  async findByCarnet(ci: string): Promise<Omit<User, 'password'> | undefined> {
    const user = await this.userRepository.findOne({ where: { ci } });
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

  // Permitir la actualización del departamento de un usuario.
  async updateDepartment(userId: number, departmentId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const department = await this.departmentRepository.findOne({ where: { id: departmentId } });
    if (!department) {
      throw new Error('Department not found');
    }
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

  // user.service.ts
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

    // Si el usuario no se encuentra en la base de datos, intentar consultar la API externa
    try {
      const apiUserData = await this.verifyWithExternalApi(carnetIdentidad);
      if (apiUserData) {
        return apiUserData.attributes;
      }
    } catch (error) {
      console.warn('Error verificando usuario con la API externa:', error.message);
    }

    // Si no se encuentra información, lanzar un error
    throw new BadRequestException('Usuario no encontrado en la base de datos ni en la API externa.');
  }

  async updateUserRole(userId: number, newRole: RoleEnum): Promise<void> {
    // Verificar si el usuario existe
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }

    // Verificar si el nuevo rol es válido
    if (!Object.values(RoleEnum).includes(newRole)) {
      throw new BadRequestException('Rol inválido.');
    }

    // Actualizar el rol del usuario
    user.role = newRole;
    await this.userRepository.save(user);
  }

  // Método helper para transformar el usuario
  private transformUser(user?: User): Omit<User, 'password'> | undefined {
    if (!user) return undefined;
    const { password, ...userData } = user; // Desestructuramos para omitir el password
    return userData; // Retornamos solo los campos que queremos
  }

  async searchUsersByCI(ci: string, skip = 0, take = 10): Promise<Omit<User, 'password'>[]> {
    // Buscar usuarios que coincidan parcial o completamente con el CI, con paginación
    const users = await this.userRepository.find({
      where: { ci: Like(`%${ci}%`) },
      skip,
      take,
    });

    // Transformar los usuarios para excluir el campo password antes de devolver
    return users.map(user => this.transformUser(user));
  }

  async getUserBasicInfoById(userId: number): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado.');
    }
    return this.transformUser(user) as Omit<User, 'password'>;
  }
  
}
