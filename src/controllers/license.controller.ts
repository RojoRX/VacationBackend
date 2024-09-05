import { Controller, Post, Get, Param, Put, Delete, Body, Query } from '@nestjs/common';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';

// src/controllers/license.controller.ts
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
}
