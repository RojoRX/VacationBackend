// src/modules/reports/reports.controller.ts
import { Controller, Get, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ReportsService } from 'src/services/reports.service';
import { ReportFilterDto } from 'src/dto/report-filter.dto';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

@Get('monthly')
async generateMonthlyReport(
  @Query() filter: ReportFilterDto,
  @Res() res: Response
) {
  try {
    const buffer = await this.reportsService.generateMonthlyReport({
      year: filter.year,
      month: filter.month,
      employeeType: filter.employeeType
    });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=reporte_${filter.year}.xlsx`,
    });

    res.end(buffer);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      message: 'Error al generar el reporte',
      error: error.message,
    });
  }
}
}