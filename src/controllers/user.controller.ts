// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param, Res, HttpStatus, Patch, ParseIntPipe, Put, HttpException, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from 'src/services/user.service';
import { User } from 'src/entities/user.entity';
import { RoleEnum } from 'src/enums/role.enum';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateRoleDto } from 'src/dto/update-role.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { UpdateUserDto } from 'src/dto/update-user.dto';

@ApiTags('Usuarios')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

@Post()
@UsePipes(new ValidationPipe({ transform: true }))
@ApiOperation({
  summary: 'Registrar los datos personales de un usuario',
  description: 'Este endpoint permite registrar información personal de un usuario, sin incluir credenciales de acceso.',
})
@ApiBody({
  type: CreateUserDto,
  description: 'Datos personales del usuario a registrar (sin username ni password)',
  examples: {
    administrativo: {
      summary: 'Ejemplo de usuario administrativo',
      value: {
        ci: '1234567',
        fullName: 'Juan Pérez',
        celular: '77777777',
        email: 'juan.perez@uatf.edu.bo',
        profesion: 'Ingeniería de Sistemas',
        fecha_ingreso: '2023-01-01',
        position: 'Auxiliar Administrativo',
        tipoEmpleado: 'ADMINISTRATIVO',
        role: 'ADMIN',
        academicUnitId: 1,
        professionId: 2,
        departmentId: 3
      },
    },
    docente: {
      summary: 'Ejemplo de usuario docente',
      value: {
        ci: '7654321',
        fullName: 'Ana López',
        fecha_ingreso: '2023-01-15',
        position: 'Docente Titular',
        tipoEmpleado: 'DOCENTE',
        role: 'USER',
        academicUnitId: 2,
        professionId: 5
      },
    },
  },
})
@ApiResponse({
  status: HttpStatus.CREATED,
  description: 'Datos del usuario registrados exitosamente',
  schema: {
    example: {
      id: 1,
      ci: '1234567',
      fullName: 'Juan Pérez',
      celular: '77777777',
      email: 'juan.perez@uatf.edu.bo',
      profesion: 'Ingeniería de Sistemas',
      academicUnit: {
        id: 1,
        name: 'Facultad de Tecnología',
      },
      department: {
        id: 3,
        name: 'Departamento de Sistemas',
      },
      fecha_ingreso: '2023-01-01',
      position: 'Auxiliar Administrativo',
      tipoEmpleado: 'ADMINISTRATIVO',
      role: 'ADMIN',
      createdAt: '2023-06-15T10:30:00.000Z',
      updatedAt: '2023-06-15T10:30:00.000Z',
    },
  },
})
@ApiResponse({
  status: HttpStatus.BAD_REQUEST,
  description: 'Error en los datos de entrada o duplicado',
  schema: {
    example: {
      statusCode: 400,
      message: 'El CI ya está registrado',
      error: 'Bad Request',
    },
  },
})
@ApiResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: 'No autorizado (token inválido o ausente)',
})
@ApiResponse({
  status: HttpStatus.FORBIDDEN,
  description: 'No tiene permisos para realizar esta acción',
})
async createUserData(
  @Body() createUserDto: CreateUserDto,
  @Res() res: Response,
) {
  try {
    const newUser = await this.userService.registerUserData(createUserDto);
    return res.status(HttpStatus.CREATED).json(newUser);
  } catch (error) {
    return res
      .status(error.status || HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
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

  @Get(':userId')
  @ApiOperation({ summary: 'Obtener información básica de un usuario por su ID' })
  @ApiParam({ name: 'userId', required: true, description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Información básica del usuario', type: User })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado' })
  async getUserBasicInfo(@Param('userId') userId: number): Promise<Omit<User, 'password'>> {
    return this.userService.findById(userId);
  }

  @Patch(':userId')
@ApiOperation({ summary: 'Actualizar campos específicos de un usuario' })
@ApiParam({ name: 'userId', required: true, description: 'ID del usuario a actualizar' })
@ApiBody({
  description: 'Datos a actualizar del usuario',
  schema: {
    type: 'object',
    properties: {
      fullName: { type: 'string', description: 'Nombre completo del usuario' },
      celular: { type: 'string', description: 'Número de celular del usuario' },
      profesion: { type: 'string', description: 'Profesión del usuario' },
      position: { type: 'string', description: 'Puesto del usuario' },
      departmentId: { type: 'number', description: 'ID del departamento al que pertenece el usuario' },
    },
  },
})


@ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente', type: User })
@ApiResponse({ status: 400, description: 'Datos inválidos o usuario/departamento no encontrado' })
async updateUserFields(
  @Param('userId', ParseIntPipe) userId: number,
  @Body() updateData: Partial<{
    fullName: string;
    celular: string;
    profesion: string;
    position: string;
    departmentId: number;
  }>,
  @Res() res: Response
) {
  try {
    const updatedUser = await this.userService.updateUserFields(userId, updateData);
    return res.status(HttpStatus.OK).json(updatedUser);
  } catch (error) {
    return res.status(error.status || HttpStatus.BAD_REQUEST).json({ message: error.message });
  }
}


@Put(':id')
  @ApiOperation({ summary: 'Actualizar datos de un usuario (excepto rol y contraseña)' })
  @ApiParam({ name: 'id', type: Number, description: 'ID del usuario a actualizar' })
  @ApiBody({ type: UpdateUserDto, description: 'Datos a actualizar del usuario (sin rol ni contraseña)' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado correctamente', type: User })
  @ApiResponse({ status: 400, description: 'Datos inválidos o duplicados' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    return this.userService.updateUser(id, updateUserDto);
  }

}
