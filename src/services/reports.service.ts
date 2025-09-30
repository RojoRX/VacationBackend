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

    try {
      const user = await this.userRepository.findOne({
        where: { ci: params.ci },
        relations: ['department', 'academicUnit'],
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Cabecera con datos del usuario
      worksheet.addRow(['Reporte detallado de licencias por usuario']).font = { bold: true, size: 14 };
      worksheet.addRow([]);
      worksheet.addRow(['Nombre completo', user.fullName]);
      worksheet.addRow(['Carnet de identidad', user.ci]);
      worksheet.addRow(['Correo electrónico', user.email || '—']);
      worksheet.addRow(['Tipo de empleado', user.tipoEmpleado]);
      worksheet.addRow(['Fecha de ingreso', user.fecha_ingreso]);
      worksheet.addRow(['Cargo/Posición', user.position || '—']);
      worksheet.addRow(['Unidad académica', user.academicUnit?.name || '—']);
      worksheet.addRow(['Departamento', user.department?.name || '—']);
      worksheet.addRow([]);

      // Encabezado de tabla
      worksheet.addRow([
        'ID', 'Tipo', 'Tiempo Solicitado', 'Fecha Inicio', 'Fecha Fin',
        'Días Totales', 'Emitido', 'Aprobación Supervisor', 'Aprobación Personal',
        'Estado', 'Mes', 'Año'
      ]).eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFCCE5FF' },
        };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Licencias del usuario con filtro de fecha, excluyendo eliminadas
      const qb = this.licenseRepository.createQueryBuilder('license')
        .leftJoinAndSelect('license.user', 'user')
        .where('user.ci = :ci', { ci: params.ci })
        .andWhere('license.deleted = false');

      if (params.year) {
        qb.andWhere('EXTRACT(YEAR FROM license.startDate) = :year', { year: params.year });
      }

      if (params.month) {
        qb.andWhere('EXTRACT(MONTH FROM license.startDate) = :month', { month: params.month });
      }

      const licenses = await qb.getMany();
      console.log('📄 Licencias encontradas:', licenses.length);

      let totalAprobadas = 0;
      let totalNoAprobadas = 0;

      for (const lic of licenses) {
        const estado = lic.personalDepartmentApproval ? 'Aprobada' : 'No aprobada';

        worksheet.addRow([
          lic.id,
          lic.licenseType,
          lic.timeRequested,
          lic.startDate,
          lic.endDate,
          lic.totalDays,
          lic.issuedDate.toISOString().split('T')[0],
          lic.immediateSupervisorApproval ? 'Sí' : 'No',
          lic.personalDepartmentApproval ? 'Sí' : 'No',
          estado,
          this.getMonthName(new Date(lic.startDate).getMonth() + 1),
          new Date(lic.startDate).getFullYear()
        ]);

        if (lic.personalDepartmentApproval) {
          totalAprobadas += Number(lic.totalDays);
        } else {
          totalNoAprobadas += Number(lic.totalDays);
        }
      }

      worksheet.addRow([]);
      worksheet.addRow(['Subtotal días aprobados', '', '', '', '', totalAprobadas]);
      worksheet.addRow(['Subtotal días no aprobados', '', '', '', '', totalNoAprobadas]);
      const totalRow = worksheet.addRow(['Total días solicitados', '', '', '', '', totalAprobadas + totalNoAprobadas]);
      totalRow.font = { bold: true };

      // Ajustar ancho de columnas
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
      throw error;
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

    const user = await this.userRepository.findOne({
      where: { ci: params.ci },
      relations: ['department', 'academicUnit', 'profession'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Cabecera
    worksheet.addRow(['Reporte de vacaciones por usuario']).font = { bold: true, size: 14 };
    worksheet.addRow([]);
    worksheet.addRow(['Nombre completo', user.fullName]);
    worksheet.addRow(['CI', user.ci]);
    worksheet.addRow(['Correo', user.email || '—']);
    worksheet.addRow(['Tipo de empleado', user.tipoEmpleado]);
    worksheet.addRow(['Fecha de ingreso', user.fecha_ingreso]);
    worksheet.addRow(['Cargo', user.position || '—']);
    worksheet.addRow(['Unidad académica', user.academicUnit?.name || '—']);
    worksheet.addRow(['Departamento', user.department?.name || '—']);
    worksheet.addRow(['Profesión', user.profession?.name || '—']);
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

    const query = this.vacationRepository
      .createQueryBuilder('vacation')
      .leftJoin('vacation.user', 'user')
      .where('user.ci = :ci', { ci: params.ci })
      .andWhere('vacation.deleted = false'); // <-- filtro agregado para excluir eliminados

    if (params.year) {
      query.andWhere('EXTRACT(YEAR FROM vacation.startDate) = :year', { year: params.year });
    }

    if (params.month) {
      query.andWhere('EXTRACT(MONTH FROM vacation.startDate) = :month', { month: params.month });
    }

    const vacaciones = await query.getMany();

    const statusTranslations: Record<string, string> = {
      PENDING: 'Pendiente',
      AUTHORIZED: 'Autorizada',
      POSTPONED: 'Postergada',
      DENIED: 'Denegada',
      SUSPENDED: 'Suspendida',
    };

    let totalDias = 0;
    const statusCounter: Record<string, number> = {};

    for (const vac of vacaciones) {
      const statusEsp = statusTranslations[vac.status] || vac.status;

      worksheet.addRow([
        vac.id,
        vac.requestDate,
        vac.startDate,
        vac.endDate,
        vac.totalDays,
        statusEsp,
        vac.returnDate || '—',
        vac.approvedByHR ? 'Sí' : 'No',
        vac.approvedBySupervisor ? 'Sí' : 'No',
        vac.managementPeriodStart,
        vac.managementPeriodEnd,
      ]);

      // Solo contar días tomados si el estado es AUTHORIZED o SUSPENDED
      if (vac.status === 'AUTHORIZED' || vac.status === 'SUSPENDED') {
        totalDias += vac.totalDays;
      }
      statusCounter[statusEsp] = (statusCounter[statusEsp] || 0) + vac.totalDays;

    }

    worksheet.addRow([]);
    worksheet.addRow(['Resumen de días por estado']).font = { bold: true };

    for (const estado in statusCounter) {
      worksheet.addRow([estado, statusCounter[estado]]);
    }

    const totalRow = worksheet.addRow(['Total días tomados', totalDias]);
    totalRow.font = { bold: true };

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
  async generateGlobalUserReport(params: {
    from?: string;   // rango fecha inicio (YYYY-MM-DD)
    to?: string;     // rango fecha fin (YYYY-MM-DD)
    year?: number;   // opcional, si no usan from/to
    month?: number;  // opcional
    employeeType?: string; // 'ADMINISTRATIVO' | 'DOCENTE' | 'ALL'
  }) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte General Usuarios');

    // 🔹 Generar leyenda de filtros
    let filterText = 'Reporte de todos los usuarios';
    if (params.from && params.to) {
      filterText = `Reporte generado desde ${params.from} al ${params.to}`;
    } else if (params.year && params.month) {
      const monthName = [
        '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ][params.month];
      filterText = `Reporte generado para ${monthName} de ${params.year}`;
    } else if (params.year) {
      filterText = `Reporte generado para el año ${params.year}`;
    }

    if (params.employeeType && params.employeeType !== 'ALL') {
      filterText += ` - Tipo de empleado: ${params.employeeType}`;
    }

    // 🔹 Cabecera del reporte
    worksheet.addRow(['Reporte general de usuarios']).font = { bold: true, size: 14 };
    worksheet.addRow([filterText]).font = { italic: true, size: 12, color: { argb: 'FF0000FF' } };
    worksheet.addRow([]);

    // 🔹 Encabezados de columnas
    worksheet.addRow([
      'Usuario', 'CI', 'Tipo Empleado', 'Departamento', 'Unidad Académica',
      'Tipo Licencia', 'Tiempo Solicitado', 'Inicio', 'Fin',
      'Días Totales', 'Emitido', 'Supervisor', 'RRHH', 'Estado'
    ]).eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE5FF' } };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 🔹 Consulta de datos
    const qb = this.licenseRepository.createQueryBuilder('license')
      .leftJoinAndSelect('license.user', 'user')
      .leftJoinAndSelect('user.department', 'department')
      .leftJoinAndSelect('user.academicUnit', 'academicUnit')
      .where('license.deleted = false');

    if (params.year) qb.andWhere('EXTRACT(YEAR FROM license.startDate) = :year', { year: params.year });
    if (params.month) qb.andWhere('EXTRACT(MONTH FROM license.startDate) = :month', { month: params.month });
    if (params.from) qb.andWhere('license.startDate >= :from', { from: params.from });
    if (params.to) qb.andWhere('license.endDate <= :to', { to: params.to });
    if (params.employeeType && params.employeeType !== 'ALL') qb.andWhere('user.tipoEmpleado = :employeeType', { employeeType: params.employeeType });

    const licenses = await qb.getMany();

    for (const lic of licenses) {
      worksheet.addRow([
        lic.user.fullName,
        lic.user.ci,
        lic.user.tipoEmpleado,
        lic.user.department?.name || '—',
        lic.user.academicUnit?.name || '—',
        lic.licenseType,
        lic.timeRequested,
        lic.startDate,
        lic.endDate,
        lic.totalDays,
        lic.issuedDate?.toISOString().split('T')[0] || '—',
        lic.immediateSupervisorApproval ? 'Sí' : 'No',
        lic.personalDepartmentApproval ? 'Sí' : 'No',
        lic.personalDepartmentApproval ? 'Aprobada' : 'No aprobada',
      ]);
    }

    // 🔹 Ajuste de ancho de columnas
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
