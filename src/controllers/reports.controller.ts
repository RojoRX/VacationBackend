// src/modules/reports/reports.controller.ts
import { Controller, Get, NotFoundException, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { ReportsService } from 'src/services/reports.service';
import { ReportFilterDto } from 'src/dto/report-filter.dto';
import { Response } from 'express';
import { UserReportFilterDto } from 'src/dto/user-report-filter.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

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
@Get('user-monthly')
@UsePipes(new ValidationPipe({ transform: true }))
async generateUserMonthlyReport(
  @Query() filter: UserReportFilterDto,
  @Res() res: Response
  
) {
  console.log('Tipo de filter.year:', typeof filter.year);
  console.log('Valor de filter.year:', filter.year);
  try {
    const buffer = await this.reportsService.generateUserMonthlyReport({
      ci: filter.ci,
      year: filter.year,
      month: filter.month
    });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=reporte_usuario_${filter.ci}.xlsx`,
    });

    res.end(buffer);
  } catch (error) {
    if (error instanceof NotFoundException) {
      return res.status(404).json({
        statusCode: 404,
        message: error.message,
        error: 'Not Found'
      });
    }
    
    res.status(500).json({
      statusCode: 500,
      message: 'Error al generar el reporte',
      error: error.message
    });
  }
}
 @Get('vacations/user')
  @ApiOperation({ summary: 'Reporte de vacaciones por usuario' })
  @ApiQuery({ name: 'ci', required: true, description: 'CI del usuario' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Año (opcional)' })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Mes (1-12, opcional)' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateUserVacationReport(
    @Query() filter: UserReportFilterDto,
    @Res() res: Response
  ) {
    try {
      const buffer = await this.reportsService.generateUserVacationReport({
        ci: filter.ci,
        year: filter.year,
        month: filter.month,
      });

      const filename = `reporte_usuario_vacaciones_${filter.ci}_${filter.year || 'todos'}_${filter.month || 'todos'}.xlsx`;

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${filename}`,
      });

      res.end(buffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return res.status(404).json({
          statusCode: 404,
          message: error.message,
          error: 'Not Found',
        });
      }

      res.status(500).json({
        statusCode: 500,
        message: 'Error al generar el reporte de vacaciones',
        error: error.message,
      });
    }
  }
}