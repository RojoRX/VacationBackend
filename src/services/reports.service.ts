import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from '../entities/license.entity';
import { type } from 'os';
import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from 'src/entities/user.entity';
import { VacationRequest } from 'src/entities/vacation_request.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(VacationRequest)
    private vacationRepository: Repository<VacationRequest>,

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
        'license.personalDepartmentApproval AS approved',
        'COUNT(license.id) AS totalrequests',
        'SUM(license.totalDays) AS totaldays'
      ])
      .leftJoin('license.user', 'user')
      .groupBy(
        'EXTRACT(MONTH FROM license.startDate), EXTRACT(YEAR FROM license.startDate), user.tipoEmpleado, license.personalDepartmentApproval'
      )
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

    const tipos = params.employeeType === 'ALL'
      ? ['ADMINISTRATIVO', 'DOCENTE']
      : [params.employeeType];

    for (const type of tipos) {
      worksheet.addRow([]);
      const typeRow = worksheet.addRow([`Tipo: ${type}`]);
      typeRow.font = { bold: true };

      const aprobadas = reportData.filter(item =>
        item.employeetype === type && item.approved === true
      );
      const noAprobadas = reportData.filter(item =>
        item.employeetype === type && item.approved === false
      );

      let totalAprobadas = 0;
      let totalNoAprobadas = 0;

      // Aprobadas
      if (aprobadas.length > 0) {
        const subRow = worksheet.addRow(['Solicitudes aprobadas']);
        subRow.font = { italic: true };
        aprobadas.forEach(item => {
          worksheet.addRow([
            this.getMonthName(Number(item.month)),
            item.year,
            Number(item.totalrequests),
            Number(item.totaldays)
          ]);
          totalAprobadas += Number(item.totaldays);
        });
        worksheet.addRow(['Subtotal aprobadas', '', '', totalAprobadas]);
      }

      // No aprobadas
      if (noAprobadas.length > 0) {
        worksheet.addRow([]);
        const subRow = worksheet.addRow(['Solicitudes no aprobadas']);
        subRow.font = { italic: true };
        noAprobadas.forEach(item => {
          worksheet.addRow([
            this.getMonthName(Number(item.month)),
            item.year,
            Number(item.totalrequests),
            Number(item.totaldays)
          ]);
          totalNoAprobadas += Number(item.totaldays);
        });
        worksheet.addRow(['Subtotal no aprobadas', '', '', totalNoAprobadas]);
      }

      worksheet.addRow([]);
      const totalRow = worksheet.addRow(['Total días (todas las solicitudes)', '', '', totalAprobadas + totalNoAprobadas]);
      totalRow.font = { bold: true };
    }

    // Ajuste de ancho
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
  async generateUserMonthlyReport(params: {
    year?: number;
    month?: number;
    ci: string;
  }) {
    console.log('➡️ generateUserMonthlyReport llamado con los siguientes parámetros:', params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Usuario');

    // Obtener datos del usuario
    try {
      const user = await this.userRepository.findOne({
        where: { ci: params.ci },
      });

      console.log('👤 Datos del usuario obtenidos:', user);

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Cabecera con datos personales
      worksheet.addRow(['Reporte de licencias por usuario']).font = { bold: true, size: 14 };
      worksheet.addRow([]);
      worksheet.addRow(['Nombre completo', user.fullName]);
      worksheet.addRow(['Carnet de identidad', user.ci]);
      worksheet.addRow(['Correo electrónico', user.email || '—']);
      worksheet.addRow(['Tipo de empleado', user.tipoEmpleado]);
      worksheet.addRow(['Fecha de ingreso', user.fecha_ingreso]);
      worksheet.addRow(['Cargo/Posición', user.position || '—']);
      worksheet.addRow([]);

      // Cabecera de tabla
      worksheet.addRow(['Mes', 'Año', 'Estado', 'Solicitudes', 'Días']).eachCell(cell => {
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

      // Query de licencias por usuario
      const query = this.licenseRepository
        .createQueryBuilder('license')
        .select([
          'EXTRACT(MONTH FROM license.startDate) AS month',
          'EXTRACT(YEAR FROM license.startDate) AS year',
          'license.personalDepartmentApproval AS approved',
          'COUNT(license.id) AS totalrequests',
          'SUM(license.totalDays) AS totaldays'
        ])
        .leftJoin('license.user', 'user')
        .where('user.ci = :ci', { ci: params.ci })
        .groupBy('EXTRACT(MONTH FROM license.startDate), EXTRACT(YEAR FROM license.startDate), license.personalDepartmentApproval')
        .orderBy('year, month');

      if (params.year) {
        query.andWhere('EXTRACT(YEAR FROM license.startDate) = :year', { year: params.year });
      }

      if (params.month) {
        query.andWhere('EXTRACT(MONTH FROM license.startDate) = :month', { month: params.month });
      }

      const reportData = await query.getRawMany();
      console.log('📄 Resultado de la consulta de licencias:', reportData);

      let totalAprobadas = 0;
      let totalNoAprobadas = 0;

      for (const item of reportData) {
        const estado = item.approved ? 'Aprobadas' : 'No aprobadas';
        worksheet.addRow([
          this.getMonthName(Number(item.month)),
          item.year,
          estado,
          Number(item.totalrequests),
          Number(item.totaldays)
        ]);

        if (item.approved) {
          totalAprobadas += Number(item.totaldays);
        } else {
          totalNoAprobadas += Number(item.totaldays);
        }
      }

      worksheet.addRow([]);
      worksheet.addRow(['Subtotal días aprobados', '', '', '', totalAprobadas]);
      worksheet.addRow(['Subtotal días no aprobados', '', '', '', totalNoAprobadas]);
      const totalRow = worksheet.addRow(['Total días solicitados', '', '', '', totalAprobadas + totalNoAprobadas]);
      totalRow.font = { bold: true };

      // Ajuste de columnas
      worksheet.columns.forEach(column => {
        let maxLength = 12;
        column.eachCell?.({ includeEmpty: true }, cell => {
          const cellLength = cell.value?.toString().length || 0;
          maxLength = Math.max(maxLength, cellLength);
        });
        column.width = maxLength + 2;
      });

      return await workbook.xlsx.writeBuffer();

    } catch (error) {
      console.error('🔴 Error en generateUserMonthlyReport:', error);
      throw error; // Re-lanza el error para que lo capture el controlador
    }
  }

  private getMonthName(monthNumber: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1];
  }


  async generateUserVacationReport(params: {
    year?: number;
    month?: number;
    ci: string;
  }) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Vacaciones Usuario');

    const user = await this.userRepository.findOne({ where: { ci: params.ci } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    worksheet.addRow(['Reporte de vacaciones por usuario']).font = { bold: true, size: 14 };
    worksheet.addRow([]);
    worksheet.addRow(['Nombre completo', user.fullName]);
    worksheet.addRow(['CI', user.ci]);
    worksheet.addRow(['Correo', user.email || '—']);
    worksheet.addRow(['Tipo de empleado', user.tipoEmpleado]);
    worksheet.addRow(['Fecha de ingreso', user.fecha_ingreso]);
    worksheet.addRow(['Cargo', user.position || '—']);
    worksheet.addRow([]);

    // Encabezado
    worksheet.addRow([
      'ID', 'Fecha Solicitud', 'Inicio', 'Fin', 'Días', 'Estado',
      'Reintegro', 'Aprob. RRHH', 'Aprob. Supervisor',
      'Periodo Gestión Inicio', 'Periodo Gestión Fin'
    ]).eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Construcción del query con filtros
    const query = this.vacationRepository
      .createQueryBuilder('vacation')
      .leftJoin('vacation.user', 'user')
      .where('user.ci = :ci', { ci: params.ci });

    if (params.year) {
      query.andWhere('EXTRACT(YEAR FROM vacation.startDate) = :year', { year: params.year });
    }

    if (params.month) {
      query.andWhere('EXTRACT(MONTH FROM vacation.startDate) = :month', { month: params.month });
    }

    const vacaciones = await query.getMany();

    let totalDias = 0;
    const statusCounter: Record<string, number> = {};

    for (const vac of vacaciones) {
      worksheet.addRow([
        vac.id,
        vac.requestDate,
        vac.startDate,
        vac.endDate,
        vac.totalDays,
        vac.status,
        vac.returnDate || '—',
        vac.approvedByHR ? 'Sí' : 'No',
        vac.approvedBySupervisor ? 'Sí' : 'No',
        vac.managementPeriodStart,
        vac.managementPeriodEnd,
      ]);

      totalDias += vac.totalDays;
      statusCounter[vac.status] = (statusCounter[vac.status] || 0) + vac.totalDays;
    }

    worksheet.addRow([]);
    worksheet.addRow(['Resumen de días por estado']).font = { bold: true };

    for (const status of Object.keys(statusCounter)) {
      worksheet.addRow([status, statusCounter[status]]);
    }

    const totalRow = worksheet.addRow(['Total días tomados', totalDias]);
    totalRow.font = { bold: true };

    // Ajuste automático de columnas
    worksheet.columns.forEach(col => {
      let max = 12;
      col.eachCell?.({ includeEmpty: true }, cell => {
        const len = cell.value?.toString().length || 0;
        max = Math.max(max, len);
      });
      col.width = max + 2;
    });

    return await workbook.xlsx.writeBuffer();
  }
}
