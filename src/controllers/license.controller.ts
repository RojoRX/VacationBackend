// src/controllers/license.controller.ts
import { Controller, Post, Get, Param, Put, Delete, Body, Query, Patch } from '@nestjs/common';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';

@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('total-for-user')
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
  async create(
    @Param('userId') userId: number,
    @Body() licenseData: Partial<License>
  ): Promise<LicenseResponseDto> {
    return this.licenseService.createLicense(userId, licenseData);
  }

  @Get()
  async findAll(): Promise<LicenseResponseDto[]> {
    return this.licenseService.findAllLicenses();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<LicenseResponseDto> {
    return this.licenseService.findOneLicense(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateData: Partial<License>,
  ): Promise<LicenseResponseDto> {
    return this.licenseService.updateLicense(id, updateData);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.licenseService.removeLicense(id);
  }

  // Endpoint para obtener las licencias autorizadas y el total de días
  @Get('authorized/:userId')
  async getAuthorizedLicenses(
    @Param('userId') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalAuthorizedDays: number; requests: LicenseResponseDto[] }> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.licenseService.getTotalAuthorizedLicensesForUser(userId, start, end);
  }

  // Endpoint para actualizar el estado de aprobación del supervisor inmediato
  @Patch(':licenseId/supervisor-approval')
  async updateImmediateSupervisorApproval(
    @Param('licenseId') licenseId: number,
    @Body('approval') approval: boolean,
  ): Promise<License> {
    return this.licenseService.updateImmediateSupervisorApproval(licenseId, approval);
  }

  // Endpoint para actualizar el estado de aprobación del departamento personal
  @Patch(':licenseId/personal-approval')
  async updatePersonalDepartmentApproval(
    @Param('licenseId') licenseId: number,
    @Body('approval') approval: boolean,
  ): Promise<License> {
    return this.licenseService.updatePersonalDepartmentApproval(licenseId, approval);
  }

// Endpoint para que el supervisor apruebe o rechace una licencia
@Patch(':licenseId/approve')
async approveLicense(
  @Param('licenseId') licenseId: number,
  @Query('supervisorId') supervisorId: number,
  @Body('approval') approval: boolean,
): Promise<LicenseResponseDto> {
  return this.licenseService.approveLicense(licenseId, supervisorId, approval);
}

  // Nuevo endpoint para obtener las licencias del departamento del supervisor
  @Get('department/:supervisorId')
  async findLicensesByDepartment(
    @Param('supervisorId') supervisorId: number,
  ): Promise<License[]> {
    return this.licenseService.findLicensesByDepartment(supervisorId);
  }
}
