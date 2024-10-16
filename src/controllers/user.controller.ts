// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param, Res, HttpStatus, Patch, ParseIntPipe, Put, HttpException, Query } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from 'src/services/user.service';
import { User } from 'src/entities/user.entity';
import { RoleEnum } from 'src/enums/role.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UpdateRoleDto } from 'src/dto/update-role.dto';

@ApiTags('Usuarios')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiBody({ type: User, description: 'Datos del usuario a crear' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente', type: User })
  @ApiResponse({ status: 400, description: 'Error en los datos de entrada' })
  async createUser(@Body() body: { ci: string; username: string; password: string }, @Res() res: Response) {
    try {
      const user = await this.userService.createUserFromApi(body.ci, body.username, body.password);
      return res.status(HttpStatus.CREATED).json(user);
    } catch (error) {
      return res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

  @Get('find/:ci')
  @ApiOperation({ summary: 'Buscar un usuario por su carnet' })
  @ApiParam({ name: 'ci', required: true, description: 'Carnet del usuario a buscar' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado', type: User })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
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
  @ApiOperation({ summary: 'Validar la contraseña del usuario' })
  @ApiParam({ name: 'username', required: true, description: 'Nombre de usuario para validar la contraseña' })
  @ApiResponse({ status: 200, description: 'Contraseña válida' })
  @ApiResponse({ status: 401, description: 'Contraseña inválida' })
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

  @Patch(':id/department')
  @ApiOperation({ summary: 'Actualizar el departamento del usuario' })
  @ApiParam({ name: 'id', required: true, description: 'ID del usuario a actualizar' })
  @ApiBody({ type: Number, description: 'ID del nuevo departamento' })
  @ApiResponse({ status: 200, description: 'Departamento actualizado exitosamente' })
  async updateDepartment(
    @Param('id') userId: number,
    @Body('departmentId') departmentId: number
  ): Promise<void> {
    return this.userService.updateDepartment(userId, departmentId);
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Actualizar el rol del usuario' })
  @ApiParam({ name: 'id', required: true, description: 'ID del usuario a actualizar' })
  @ApiBody({ type: UpdateRoleDto, description: 'Nuevo rol del usuario' })  // Usar el DTO aquí
  @ApiResponse({ status: 200, description: 'Rol actualizado correctamente' })
  async updateUserRole(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateRoleDto: UpdateRoleDto  // Usar el DTO aquí
  ) {
    await this.userService.updateUserRole(userId, updateRoleDto.role);
    return { message: 'Rol actualizado correctamente.' };
  }

  @ApiOperation({ summary: 'Search for users by CI' })
  @ApiQuery({ name: 'ci', required: true, description: 'Carnet de Identidad (CI) to search for users' })
  @ApiQuery({ name: 'skip', required: false, description: 'Number of records to skip for pagination', type: Number })
  @ApiQuery({ name: 'take', required: false, description: 'Number of records to take for pagination', type: Number })
  @ApiResponse({ status: 200, description: 'List of users that match the search criteria', type: [User] })
  @ApiResponse({ status: 404, description: 'No users found matching the criteria' })
  @Get('search-by-ci')
  async searchUsersByCI(
    @Query('ci') ci: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 10,
  ): Promise<Omit<User, 'password'>[]> {
    if (!ci || ci.trim() === '') {
      throw new HttpException('CI is required', HttpStatus.BAD_REQUEST);
    }

    const users = await this.userService.searchUsersByCI(ci, skip, take);

    if (users.length === 0) {
      throw new HttpException('No users found', HttpStatus.NOT_FOUND);
    }

    return users;
  }
}
