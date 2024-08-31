import { Controller, Post, Get, Param, Put, Delete, Body, Query } from '@nestjs/common';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';

@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}
  
  @Get('total-for-user')
  async getTotalLicensesForUser(
    @Query('carnetIdentidad') carnetIdentidad: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalLicenses: number; totalDays: number }> {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    return this.licenseService.getTotalLicensesForUser(carnetIdentidad, startDateObj, endDateObj);
  }

  @Post()
  async create(@Body() licenseData: Partial<License>): Promise<License> {
    return this.licenseService.createLicense(licenseData);
  }

  @Get()
  async findAll(): Promise<License[]> {
    return this.licenseService.findAllLicenses();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<License> {
    return this.licenseService.findOneLicense(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateData: Partial<License>,
  ): Promise<License> {
    return this.licenseService.updateLicense(id, updateData);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.licenseService.removeLicense(id);
  }
}
