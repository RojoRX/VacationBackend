import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities/user.entity'; // Ajusta la ruta según tu estructura
import * as bcrypt from 'bcrypt';
import { Department } from 'src/entities/department.entity';

@Injectable()
export class UserService {
  private readonly apiUrl = process.env.API_BASE_URL || 'http://localhost:1337/api/personas';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly httpService: HttpService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,

  ) {}

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

    const newUser = this.userRepository.create({
      ci,
      fecha_ingreso: apiData.attributes.fecha_ingreso,
      username,
      password: hashedPassword,
    });
    return this.userRepository.save(newUser);
  }

  async findByCarnet(ci: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { ci } });
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { username } });
  }

  async validatePassword(username: string, password: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  //permitir la actualización del departamento de un usuario.
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

  async findById(userId: number): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { id: userId }, relations: ['department'] });
  }
}
