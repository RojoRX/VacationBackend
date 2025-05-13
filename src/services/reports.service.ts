import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from '../entities/license.entity';
import { type } from 'os';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
  ) { }

async generateMonthlyReport(params: {
  year?: number;
  month?: number;
  employeeType: string; // 'ADMINISTRATIVO' | 'DOCENTE' | 'ALL'
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte');

  worksheet.addRow(['Mes', 'Año', 'Solicitudes', 'Días']).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCE5FF' }
    };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  const query = this.licenseRepository
    .createQueryBuilder('license')
    .select([
      'EXTRACT(MONTH FROM license.startDate) AS month',
      'EXTRACT(YEAR FROM license.startDate) AS year',
      'user.tipoEmpleado AS employeetype',
      'COUNT(license.id) AS totalrequests',
      'SUM(license.totalDays) AS totaldays'
    ])
    .leftJoin('license.user', 'user')
    .where('license.personalDepartmentApproval = :approved', { approved: true })
    .groupBy('EXTRACT(MONTH FROM license.startDate), EXTRACT(YEAR FROM license.startDate), user.tipoEmpleado')
    .orderBy('year, month');

  if (params.year) {
    query.andWhere('EXTRACT(YEAR FROM license.startDate) = :year', { year: params.year });
  }

  if (params.month) {
    query.andWhere('EXTRACT(MONTH FROM license.startDate) = :month', { month: params.month });
  }

  if (params.employeeType !== 'ALL') {
    query.andWhere('user.tipoEmpleado = :employeeType', {
      employeeType: params.employeeType
    });
  }

  const reportData = await query.getRawMany();
  console.log('📊 Datos obtenidos:', reportData);

  // Agrupar por tipo
  const groupedData = {
    ADMINISTRATIVO: [] as any[],
    DOCENTE: [] as any[]
  };

  reportData.forEach(item => {
    const type = item.employeetype?.toUpperCase();
    if (type === 'ADMINISTRATIVO' || type === 'DOCENTE') {
      groupedData[type].push(item);
    }
  });

  // Procesar tipos
  const tipos = params.employeeType === 'ALL'
    ? ['ADMINISTRATIVO', 'DOCENTE']
    : [params.employeeType];

  let totalAdministrativos = 0;
  let totalDocentes = 0;

  for (const type of tipos) {
    if (params.employeeType === 'ALL') {
      worksheet.addRow([]);
      const titleRow = worksheet.addRow([`Tipo: ${type}`]);
      titleRow.font = { bold: true };
    }

    const items = groupedData[type] || [];

    items.forEach(item => {
      worksheet.addRow([
        this.getMonthName(Number(item.month)),
        item.year,
        Number(item.totalrequests),
        Number(item.totaldays)
      ]);

      if (type === 'ADMINISTRATIVO') {
        totalAdministrativos += Number(item.totaldays);
      } else if (type === 'DOCENTE') {
        totalDocentes += Number(item.totaldays);
      }
    });
  }

  // Totales si es ALL
  if (params.employeeType === 'ALL') {
    worksheet.addRow([]);
    const totalTitle = worksheet.addRow(['Totales por tipo de empleado']);
    totalTitle.font = { bold: true };

    worksheet.addRow(['Administrativos', '', '', totalAdministrativos]);
    worksheet.addRow(['Docentes', '', '', totalDocentes]);
  }

  // Autoajuste de ancho de columnas
  worksheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const cellLength = cell.value?.toString().length || 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = maxLength + 2;
  });

  return await workbook.xlsx.writeBuffer();
}




  private getMonthName(monthNumber: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1];
  }
}