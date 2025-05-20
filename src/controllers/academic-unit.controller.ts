// src/academic-unit/academic-unit.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { AcademicUnitService } from 'src/services/academic-unit.service';
import { AcademicUnit } from 'src/entities/academic-unit.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Unidades Académicas')
@Controller('academic-units')
export class AcademicUnitController {
  constructor(private readonly academicUnitService: AcademicUnitService) { }

  @Get()
  @ApiOperation({ summary: 'Listar todas las unidades académicas' })
  @ApiResponse({ status: 200, description: 'Lista devuelta correctamente' })
  findAll(): Promise<AcademicUnit[]> {
    return this.academicUnitService.findAll();
  }
  @Get('search') // ← Primero las rutas específicas
  async search(@Query('name') name: string): Promise<AcademicUnit[]> {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('El parámetro "name" es requerido y debe tener al menos 2 caracteres');
    }

    return this.academicUnitService.searchByName(name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una unidad académica por ID' })
  @ApiResponse({ status: 200, description: 'Unidad académica encontrada' })
  @ApiResponse({ status: 404, description: 'Unidad académica no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<AcademicUnit> {
    return this.academicUnitService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva unidad académica' })
  @ApiResponse({ status: 201, description: 'Unidad académica creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o duplicados' })
  create(@Body() data: Partial<AcademicUnit>): Promise<AcademicUnit> {
    return this.academicUnitService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una unidad académica existente' })
  @ApiResponse({ status: 200, description: 'Unidad académica actualizada' })
  @ApiResponse({ status: 404, description: 'Unidad académica no encontrada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o duplicados' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<AcademicUnit>,
  ): Promise<AcademicUnit> {
    return this.academicUnitService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una unidad académica' })
  @ApiResponse({ status: 200, description: 'Unidad académica eliminada' })
  @ApiResponse({ status: 404, description: 'Unidad académica no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.academicUnitService.remove(id);
  }

}
