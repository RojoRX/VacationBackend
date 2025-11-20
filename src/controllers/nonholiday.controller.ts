import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { NonHolidayService } from 'src/services/nonholiday.service';
import { NonHoliday } from 'src/entities/nonholiday.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RoleEnum } from 'src/enums/role.enum';
import { Public } from 'src/auth/public.decorator'; // decorador que indica endpoint público

@ApiTags('Feriados o días No Hábiles')
@Controller('non-holidays')
export class NonHolidayController {
  constructor(private readonly nonHolidayService: NonHolidayService) { }

  // 🔹 Endpoints protegidos (solo ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Agregar un nuevo día no hábil' })
  @ApiBody({
    type: NonHoliday,
    description: 'Datos del día no hábil a agregar, incluye el campo "description"'
  })
  @ApiResponse({ status: 201, description: 'Día no hábil agregado exitosamente', type: NonHoliday })
  async add(@Body() nonHoliday: NonHoliday): Promise<NonHoliday> {
    return this.nonHolidayService.addNonHoliday(nonHoliday);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un día no hábil por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID del día no hábil a actualizar' })
  @ApiBody({ type: NonHoliday, description: 'Datos del día no hábil a actualizar' })
  @ApiResponse({ status: 200, description: 'Día no hábil actualizado', type: NonHoliday })
  @ApiResponse({ status: 404, description: 'Día no hábil no encontrado' })
  async update(
    @Param('id') id: number,
    @Body() nonHoliday: Partial<NonHoliday>,
  ): Promise<NonHoliday> {
    return this.nonHolidayService.updateNonHoliday(id, nonHoliday);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un día no hábil por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID del día no hábil a eliminar' })
  @ApiResponse({ status: 204, description: 'Día no hábil eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Día no hábil no encontrado' })
  async delete(@Param('id') id: number): Promise<void> {
    return this.nonHolidayService.deleteNonHoliday(id);
  }

  // 🔹 Endpoints públicos
  @Get('all')
  @ApiOperation({ summary: 'Obtener todos los días no hábiles' })
  @ApiResponse({ status: 200, description: 'Lista de días no hábiles', type: [NonHoliday] })
  async getAllNonHolidays() {
    return this.nonHolidayService.getAllNonHolidays();
  }

  @Get()
  @ApiOperation({ summary: 'Obtener días no hábiles de un año específico' })
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Año para obtener los días no hábiles' })
  @ApiResponse({ status: 200, description: 'Lista de días no hábiles', type: [NonHoliday] })
  async getAll(@Query('year') year: number): Promise<NonHoliday[]> {
    return this.nonHolidayService.getNonHolidayDays(year);
  }
}
