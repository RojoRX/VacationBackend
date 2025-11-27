// src/licenses/license-validation.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License, LicenseType } from 'src/entities/license.entity'; // Asegúrate de que el path sea correcto
import { User } from 'src/entities/user.entity'; // Asegúrate de que el path sea correcto
import { getYear, parseISO, setYear, format } from 'date-fns';
import { VacationService } from './vacation.service'; // Ajusta el path real de tu servicio de vacaciones
import { DetalleGestion, ResumenGeneral } from '../interfaces/vacation-debt.interface'; // <-- Importa las interfaces

@Injectable()
export class LicenseValidationService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private vacationService: VacationService,
  ) { }

  /**
   * Verifica si un usuario puede solicitar una nueva licencia (especialmente de VACACION).
   * Devuelve un objeto con `canRequest: boolean` y un `reason?: string` si no puede.
   * Este método es para un cuadro informativo en el frontend.
   *
   * @param ci Carnet de Identidad del usuario.
   * @returns Promise<{ canRequest: boolean; reason?: string }>
   */

async checkPermissionToRequest(ci: string): Promise<{ canRequest: boolean; reason?: string; availableDays?: number }> {
    console.log(`[LicenseValidationService] Iniciando verificación de permiso para CI: ${ci}`);
    try {
      const user = await this.userRepository.findOne({ where: { ci: ci } });
      if (!user) {
        console.log(`[LicenseValidationService] Usuario con CI ${ci} no encontrado.`);
        return { canRequest: false, reason: 'Usuario no encontrado.' };
      }
      console.log(`[LicenseValidationService] Usuario encontrado: ${user.fullName} (ID: ${user.id})`);

      const lastVacationRequest = await this.licenseRepository.findOne({
        where: {
          user: { id: user.id },
          licenseType: LicenseType.VACATION,
          deleted: false,
        },
        order: { issuedDate: 'DESC' },
      });

      if (!lastVacationRequest) {
        console.log(`[LicenseValidationService] No se encontraron solicitudes de VACACION previas para el usuario ${user.fullName}.`);
        // MODIFICACIÓN: Llamar al nuevo método que solo verifica disponibilidad sin días solicitados
        return this.checkVacationDaysAvailability(user.ci);
      }

      console.log(`[LicenseValidationService] Última solicitud de VACACION encontrada (ID: ${lastVacationRequest.id}) para el usuario ${user.fullName}.`);
      console.log(`[LicenseValidationService] Aprobación supervisor: ${lastVacationRequest.immediateSupervisorApproval}, Aprobación RRHH: ${lastVacationRequest.personalDepartmentApproval}`);

      const supApproval = lastVacationRequest.immediateSupervisorApproval;
      const deptApproval = lastVacationRequest.personalDepartmentApproval;

      // Bloqueamos solo si alguna aprobación sigue pendiente (null)
      if (supApproval === null || deptApproval === null) {
        console.log(`[LicenseValidationService] La última solicitud de VACACION del usuario ${user.fullName} (ID: ${lastVacationRequest.id}) NO ha sido completamente aprobada.`);
        const { availableDays } = await this.checkVacationDaysAvailability(user.ci);
        return {
          canRequest: false,
          reason: `Tienes una solicitud de vacaciones anterior (ID: ${lastVacationRequest.id}) que aún no ha sido completamente aprobada`,
          availableDays
        };
      }

      // Si están en otros estados como SUSPENDED, REJECTED, etc., ya no se bloquea
      console.log(`[LicenseValidationService] Última solicitud de VACACION no está pendiente, estado sup: ${supApproval}, dept: ${deptApproval}`);

      console.log(`[LicenseValidationService] La última solicitud de VACACION del usuario ${user.fullName} (ID: ${lastVacationRequest.id}) está completamente aprobada.`);
      // MODIFICACIÓN: Llamar al nuevo método que solo verifica disponibilidad sin días solicitados
      return this.checkVacationDaysAvailability(user.ci);
    } catch (error) {
      console.error(`[LicenseValidationService] ERROR inesperado en checkPermissionToRequest para CI ${ci}:`, error);
      return {
        canRequest: false,
        reason: 'Error interno al verificar el estado de las solicitudes. Intente de nuevo más tarde.',
      };
    }
  }

  /**
   * NUEVO MÉTODO: Solo verifica la disponibilidad de días sin validar días solicitados
   * Para uso del frontend en la sección informativa
   */
  private async checkVacationDaysAvailability(ci: string): Promise<{ canRequest: boolean; reason?: string; availableDays?: number }> {
    console.log(`[LicenseValidationService] Iniciando verificación de disponibilidad de días para CI: ${ci}`);
    const user = await this.userRepository.findOne({ where: { ci: ci } });
    if (!user) {
      console.log(`[LicenseValidationService] Error interno: Usuario con CI ${ci} no encontrado en checkVacationDaysAvailability.`);
      return { canRequest: false, reason: 'Usuario no encontrado para verificar días de vacaciones.' };
    }

    const fechaIngresoUser = parseISO(user.fecha_ingreso);
    const currentYear = getYear(new Date());
    const today = new Date();

    try {
      // Crear la fecha ajustada al año actual
      let endDateForDebtCalculation = setYear(fechaIngresoUser, currentYear);

      // Si ese aniversario ya pasó, usamos el próximo año
      if (endDateForDebtCalculation < today) {
        endDateForDebtCalculation = setYear(fechaIngresoUser, currentYear + 1);
      }
      
      const formattedDate = format(endDateForDebtCalculation, 'yyyy-MM-dd');

      console.log(`[LicenseValidationService] Fecha de ingreso del usuario (original): ${user.fecha_ingreso}`);
      console.log(`[LicenseValidationService] Fecha de cálculo de deuda (formateada): ${formattedDate}`);

      console.log(`[LicenseValidationService] Llamando a vacationService.calculateAccumulatedDebt con CI: ${ci} y fecha: ${formattedDate}`);
      const debtCalculationResult = await this.vacationService.calculateAccumulatedDebt(
        user.ci,
        formattedDate
      );
      console.log(`[LicenseValidationService] Resultado de calculateAccumulatedDebt recibido.`);

      const detalles = debtCalculationResult.detalles;
      if (!detalles || detalles.length === 0) {
        console.log(`[LicenseValidationService] Detalles de deuda vacíos para CI ${ci}.`);
        return { canRequest: false, reason: 'No se pudo calcular los días de vacaciones disponibles. Detalles vacíos.', availableDays: 0 };
      }

      const lastGestion: DetalleGestion = detalles[detalles.length - 1];
      const availableDays = lastGestion.diasDisponibles;

      console.log(`[LicenseValidationService] Última gestión de vacaciones analizada (endDate: ${lastGestion.endDate}). Días disponibles proyectados: ${availableDays}`);

      // MODIFICACIÓN: Solo verificar si hay días disponibles, sin comparar con días solicitados
      if (availableDays <= 0) {
        console.log(`[LicenseValidationService] Usuario ${user.fullName} no tiene días disponibles (${availableDays} <= 0).`);
        return {
          canRequest: false,
          reason: `No tienes días de vacaciones disponibles para solicitar. Saldo actual proyectado: ${availableDays} día(s).`,
          availableDays: availableDays,
        };
      }

      // MODIFICACIÓN: Si hay días disponibles (> 0), permitir la solicitud
      console.log(`[LicenseValidationService] Usuario ${user.fullName} tiene días disponibles: ${availableDays}. Permitiendo solicitud.`);
      return { 
        canRequest: true, 
        reason: `Tienes ${availableDays} día(s) de vacaciones disponibles proyectados.`,
        availableDays: availableDays 
      };
    } catch (debtError) {
      console.error(`[LicenseValidationService] ERROR al calcular la deuda de vacaciones para CI ${ci}:`, debtError);
      return {
        canRequest: false,
        reason: 'Error al consultar la disponibilidad de días de vacaciones. Intente de nuevo más tarde.',
        availableDays: 0
      };
    }
  }

  /**
   * MÉTODO ORIGINAL: Para validación específica al crear una licencia
   * Este SÍ recibe los días solicitados y hace la comparación
   */
  private async checkAvailableVacationDays(ci: string, requestedDays: number): Promise<{ canRequest: boolean; reason?: string; availableDays?: number }> {
    console.log(`[LicenseValidationService] Validación específica para creación - CI: ${ci}, Días solicitados: ${requestedDays}`);
    
    // Primero obtenemos la disponibilidad general
    const availabilityResult = await this.checkVacationDaysAvailability(ci);
    
    // Si no hay disponibilidad general, retornamos el resultado
    if (!availabilityResult.canRequest) {
      return availabilityResult;
    }
    
    // Si hay disponibilidad, verificamos que los días solicitados no excedan los disponibles
    const availableDays = availabilityResult.availableDays || 0;
    
    if (requestedDays > availableDays) {
      console.log(`[LicenseValidationService] Días solicitados (${requestedDays}) exceden los disponibles (${availableDays}) para el usuario.`);
      return {
        canRequest: false,
        reason: `Has solicitado ${requestedDays} día(s), pero solo tienes ${availableDays} día(s) de vacaciones disponibles proyectados.`,
        availableDays: availableDays,
      };
    }
    
    console.log(`[LicenseValidationService] Validación específica exitosa. Días solicitados: ${requestedDays}, Disponibles: ${availableDays}`);
    return { 
      canRequest: true, 
      availableDays: availableDays 
    };
  }
}