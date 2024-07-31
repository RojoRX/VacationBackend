import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UserService } from 'src/services/user.service';
import { User } from 'src/interfaces/user.interface';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.userService.findAll().toPromise();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    const userId = parseInt(id, 10); // Convert the id to a number
    const user = await this.userService.findOne(userId).toPromise();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  @Get('carnet/:carnetIdentidad')
  async findByCarnet(@Param('carnetIdentidad') carnetIdentidad: string): Promise<User> {
    const user = await this.userService.findByCarnet(carnetIdentidad).toPromise();
    if (!user) {
      throw new NotFoundException(`User with Carnet ${carnetIdentidad} not found`);
    }
    return user;
  }
}
