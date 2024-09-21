// src/controllers/license.controller.ts
import { Controller, Post, Get, Param, Put, Delete, Body, Query, Patch } from '@nestjs/common';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('Licencias')
@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('total-for-user')
  @ApiOperation({ summary: 'Obtener el total de licencias para un usuario' })
  @ApiQuery({ name: 'userId', required: true, type: Number, description: 'ID del usuario' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Fecha de inicio' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Fecha de fin' })
  @ApiResponse({ status: 200, description: 'Total de licencias y días', type: Object })
  async getTotalLicensesForUser(
    @Query('userId') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalLicenses: number; totalDays: number }> {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    return this.licenseService.getTotalLicensesForUser(userId, startDateObj, endDateObj);
  }

  @Post(':userId')
  @ApiOperation({ summary: 'Crear una nueva licencia' })
  @ApiParam({ name: 'userId', required: true, description: 'ID del usuario para el que se crea la licencia' })
  @ApiBody({ type: License, description: 'Datos de la licencia a crear' })
  @ApiResponse({ status: 201, description: 'Licencia creada exitosamente', type: LicenseResponseDto })
  @ApiResponse({ status: 400, description: 'Error al crear la licencia' })
  async create(
    @Param('userId') userId: number,
    @Body() licenseData: Partial<License>
  ): Promise<LicenseResponseDto> {
    return this.licenseService.createLicense(userId, licenseData);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las licencias' })
  @ApiResponse({ status: 200, description: 'Lista de licencias', type: [LicenseResponseDto] })
  async findAll(): Promise<LicenseResponseDto[]> {
    return this.licenseService.findAllLicenses();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una licencia por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Licencia encontrada', type: LicenseResponseDto })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async findOne(@Param('id') id: number): Promise<LicenseResponseDto> {
    return this.licenseService.findOneLicense(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una licencia' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la licencia a actualizar' })
  @ApiBody({ type: License, description: 'Datos de la licencia a actualizar' })
  @ApiResponse({ status: 200, description: 'Licencia actualizada exitosamente', type: LicenseResponseDto })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async update(
    @Param('id') id: number,
    @Body() updateData: Partial<License>,
  ): Promise<LicenseResponseDto> {
    return this.licenseService.updateLicense(id, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una licencia' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la licencia a eliminar' })
  @ApiResponse({ status: 204, description: 'Licencia eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async remove(@Param('id') id: number): Promise<void> {
    return this.licenseService.removeLicense(id);
  }

  @Get('authorized/:userId')
  @ApiOperation({ summary: 'Obtener licencias autorizadas para un usuario' })
  @ApiParam({ name: 'userId', required: true, description: 'ID del usuario' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Fecha de inicio' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Fecha de fin' })
  @ApiResponse({ status: 200, description: 'Total de días autorizados y solicitudes', type: Object })
  async getAuthorizedLicenses(
    @Param('userId') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalAuthorizedDays: number; requests: LicenseResponseDto[] }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.licenseService.getTotalAuthorizedLicensesForUser(userId, start, end);
  }

  @Patch(':licenseId/supervisor-approval')
  @ApiOperation({ summary: 'Actualizar la aprobación del supervisor inmediato' })
  @ApiParam({ name: 'licenseId', required: true, description: 'ID de la licencia' })
  @ApiBody({ type: Boolean, description: 'Estado de aprobación' })
  @ApiResponse({ status: 200, description: 'Licencia actualizada', type: License })
  async updateImmediateSupervisorApproval(
    @Param('licenseId') licenseId: number,
    @Body('approval') approval: boolean,
  ): Promise<License> {
    return this.licenseService.updateImmediateSupervisorApproval(licenseId, approval);
  }

  @Patch(':licenseId/personal-approval')
  @ApiOperation({ summary: 'Actualizar la aprobación del departamento personal' })
  @ApiParam({ name: 'licenseId', required: true, description: 'ID de la licencia' })
  @ApiBody({ type: Boolean, description: 'Estado de aprobación' })
  @ApiResponse({ status: 200, description: 'Licencia actualizada', type: License })
  async updatePersonalDepartmentApproval(
    @Param('licenseId') licenseId: number,
    @Body('approval') approval: boolean,
  ): Promise<License> {
    return this.licenseService.updatePersonalDepartmentApproval(licenseId, approval);
  }

  @Patch(':licenseId/approve')
  @ApiOperation({ summary: 'Aprobar o rechazar una licencia por el supervisor' })
  @ApiParam({ name: 'licenseId', required: true, description: 'ID de la licencia' })
  @ApiQuery({ name: 'supervisorId', required: true, type: Number, description: 'ID del supervisor' })
  @ApiBody({ type: Boolean, description: 'Estado de aprobación' })
  @ApiResponse({ status: 200, description: 'Licencia aprobada o rechazada', type: LicenseResponseDto })
  async approveLicense(
    @Param('licenseId') licenseId: number,
    @Query('supervisorId') supervisorId: number,
    @Body('approval') approval: boolean,
  ): Promise<LicenseResponseDto> {
    return this.licenseService.approveLicense(licenseId, supervisorId, approval);
  }

  @Get('department/:supervisorId')
  @ApiOperation({ summary: 'Obtener las licencias del departamento del supervisor' })
  @ApiParam({ name: 'supervisorId', required: true, description: 'ID del supervisor' })
  @ApiResponse({ status: 200, description: 'Lista de licencias del departamento', type: [License] })
  async findLicensesByDepartment(
    @Param('supervisorId') supervisorId: number,
  ): Promise<License[]> {
    return this.licenseService.findLicensesByDepartment(supervisorId);
  }
}
