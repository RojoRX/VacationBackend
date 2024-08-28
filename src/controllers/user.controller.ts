import { Controller, Get, Post, Body, Param, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from 'src/services/user.service';
import { User } from 'src/entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async createUser(@Body() body: { ci: string; username: string; password: string }, @Res() res: Response) {
    try {
      const user = await this.userService.createUserFromApi(body.ci, body.username, body.password);
      return res.status(HttpStatus.CREATED).json(user);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get('find/:ci')
  async findUserByCarnet(@Param('ci') ci: string, @Res() res: Response) {
    try {
      const user = await this.userService.findByCarnet(ci);
      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).json({ message: 'User not found' });
      }
      return res.status(HttpStatus.OK).json(user);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get('validate/:username')
  async validateUserPassword(@Param('username') username: string, @Body('password') password: string, @Res() res: Response) {
    try {
      const isValid = await this.userService.validatePassword(username, password);
      if (!isValid) {
        return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid password' });
      }
      return res.status(HttpStatus.OK).json({ message: 'Password is valid' });
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }
}
