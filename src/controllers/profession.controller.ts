import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ProfessionService } from 'src/services/profession.service';
import { CreateProfessionDto } from 'src/dto/create-profession.dto';
import { Profession } from 'src/entities/profession.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RoleEnum } from 'src/enums/role.enum';

@ApiTags('Profession')
@Controller('professions')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleEnum.ADMIN)
export class ProfessionController {
  constructor(private readonly professionService: ProfessionService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva profesión' })
  @ApiResponse({ status: 201, description: 'Profesión creada exitosamente', type: Profession })
  create(@Body() data: any) {
    return this.professionService.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una profesión por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la profesión' })
  @ApiResponse({ status: 200, description: 'Profesión actualizada exitosamente', type: Profession })
  @ApiResponse({ status: 404, description: 'Profesión no encontrada' })
  update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.professionService.update(id, data);
  }


  @Get()
  @ApiOperation({ summary: 'Obtener todas las profesiones' })
  @ApiResponse({ status: 200, description: 'Listado de profesiones', type: [Profession] })
  findAll() {
    return this.professionService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar profesiones por nombre' })
  @ApiQuery({ name: 'name', required: true, description: 'Nombre o parte del nombre de la profesión' })
  @ApiResponse({ status: 200, description: 'Profesiones encontradas', type: [Profession] })
  searchByName(@Query('name') name: string) {
    return this.professionService.searchByName(name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una profesión por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la profesión' })
  @ApiResponse({ status: 200, description: 'Profesión encontrada', type: Profession })
  @ApiResponse({ status: 404, description: 'Profesión no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.professionService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una profesión por ID' })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la profesión' })
  @ApiResponse({ status: 200, description: 'Profesión eliminada correctamente' })
  @ApiResponse({ status: 404, description: 'Profesión no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.professionService.remove(id);
  }
}
