// src/controllers/department.controller.ts
import { Controller, Post, Put, Delete, Get, Param, Body, UseGuards } from '@nestjs/common';
import { DepartmentService } from 'src/services/department.service';
import { Department } from 'src/entities/department.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { CreateDepartmentDto, UpdateDepartmentDto } from 'src/dto/department.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RoleEnum } from 'src/enums/role.enum';

@ApiTags('Departamentos') // Etiqueta para agrupar en Swagger
@Controller('departments')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleEnum.ADMIN)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo departamento' })
  @ApiResponse({ status: 201, description: 'Departamento creado exitosamente.', type: Department })
  @ApiBody({ type: CreateDepartmentDto }) // DTO para el cuerpo de la solicitud
  async createDepartment(@Body() body: CreateDepartmentDto): Promise<Department> {
    const { name, isCareer } = body;
    return this.departmentService.createDepartment(name, isCareer);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un departamento existente' })
  @ApiResponse({ status: 200, description: 'Departamento actualizado exitosamente.', type: Department })
  @ApiResponse({ status: 404, description: 'Departamento no encontrado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del departamento a actualizar' })
  @ApiBody({ type: UpdateDepartmentDto }) // DTO para el cuerpo de la solicitud
  async updateDepartment(
    @Param('id') id: number,
    @Body() body: UpdateDepartmentDto,
  ): Promise<Department> {
    const { name, isCareer } = body;
    return this.departmentService.updateDepartment(id, name, isCareer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un departamento' })
  @ApiResponse({ status: 204, description: 'Departamento eliminado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Departamento no encontrado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del departamento a eliminar' })
  async deleteDepartment(@Param('id') id: number): Promise<void> {
    return this.departmentService.deleteDepartment(id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los departamentos' })
  @ApiResponse({ status: 200, description: 'Lista de departamentos', type: [Department] })
  async getDepartments(): Promise<Department[]> {
    return this.departmentService.getDepartments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un departamento por ID' })
  @ApiResponse({ status: 200, description: 'Departamento encontrado.', type: Department })
  @ApiResponse({ status: 404, description: 'Departamento no encontrado.' })
  @ApiParam({ name: 'id', required: true, description: 'ID del departamento a obtener' })
  async getDepartmentById(@Param('id') id: number): Promise<Department> {
    return this.departmentService.getDepartmentById(id);
  }
}
