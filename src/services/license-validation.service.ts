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

  async checkPermissionToRequest(ci: string): Promise<{ canRequest: boolean; reason?: string; availableDays?: number }> { // MODIFICADO
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
        // Llama a checkAvailableVacationDays y devuelve su resultado, que ahora incluirá availableDays
        return this.checkAvailableVacationDays(user.ci, 1);
      }

      console.log(`[LicenseValidationService] Última solicitud de VACACION encontrada (ID: ${lastVacationRequest.id}) para el usuario ${user.fullName}.`);
      console.log(`[LicenseValidationService] Aprobación supervisor: ${lastVacationRequest.immediateSupervisorApproval}, Aprobación RRHH: ${lastVacationRequest.personalDepartmentApproval}`);

      const supApproval = lastVacationRequest.immediateSupervisorApproval;
      const deptApproval = lastVacationRequest.personalDepartmentApproval;

      // Bloqueamos solo si alguna aprobación sigue pendiente (null)
      if (supApproval === null || deptApproval === null) {
        console.log(`[LicenseValidationService] La última solicitud de VACACION del usuario ${user.fullName} (ID: ${lastVacationRequest.id}) NO ha sido completamente aprobada.`);
        const { availableDays } = await this.checkAvailableVacationDays(user.ci, 1);
        return {
          canRequest: false,
          reason: `Tienes una solicitud de vacaciones anterior (ID: ${lastVacationRequest.id}) que aún no ha sido completamente aprobada`,
          availableDays
        };
      }

      // Si están en otros estados como SUSPENDED, REJECTED, etc., ya no se bloquea
      console.log(`[LicenseValidationService] Última solicitud de VACACION no está pendiente, estado sup: ${supApproval}, dept: ${deptApproval}`);


      console.log(`[LicenseValidationService] La última solicitud de VACACION del usuario ${user.fullName} (ID: ${lastVacationRequest.id}) está completamente aprobada.`);
      // Si está aprobada, llama a checkAvailableVacationDays y devuelve su resultado completo
      return this.checkAvailableVacationDays(user.ci, 1);
    } catch (error) {
      console.error(`[LicenseValidationService] ERROR inesperado en checkPermissionToRequest para CI ${ci}:`, error);
      return {
        canRequest: false,
        reason: 'Error interno al verificar el estado de las solicitudes. Intente de nuevo más tarde.',
      };
    }
  }


  private async checkAvailableVacationDays(ci: string, requestedDays: number): Promise<{ canRequest: boolean; reason?: string; availableDays?: number }> { // MODIFICADO
    console.log(`[LicenseValidationService] Iniciando verificación de días de vacaciones para CI: ${ci}`);
    const user = await this.userRepository.findOne({ where: { ci: ci } });
    if (!user) {
      console.log(`[LicenseValidationService] Error interno: Usuario con CI ${ci} no encontrado en checkAvailableVacationDays.`);
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
      // Formatear la fecha a ISO string (YYYY-MM-DD)
      const formattedDate = format(endDateForDebtCalculation, 'yyyy-MM-dd');

      console.log(`[LicenseValidationService] Fecha de ingreso del usuario (original): ${user.fecha_ingreso}`);
      console.log(`[LicenseValidationService] Fecha de cálculo de deuda (formateada): ${formattedDate}`);

      console.log(`[LicenseValidationService] Llamando a vacationService.calculateAccumulatedDebt con CI: ${ci} y fecha: ${formattedDate}`);
      const debtCalculationResult = await this.vacationService.calculateAccumulatedDebt(
        user.ci,
        formattedDate // Enviamos el string formateado en lugar del objeto Date
      );
      console.log(`[LicenseValidationService] Resultado de calculateAccumulatedDebt recibido.`);

      const detalles = debtCalculationResult.detalles;
      if (!detalles || detalles.length === 0) {
        console.log(`[LicenseValidationService] Detalles de deuda vacíos para CI ${ci}.`);
        return { canRequest: false, reason: 'No se pudo calcular los días de vacaciones disponibles. Detalles vacíos.', availableDays: 0 }; // Añade 0 días disponibles
      }

      const lastGestion: DetalleGestion = detalles[detalles.length - 1];
      const availableDays = lastGestion.diasDisponibles;

      console.log(`[LicenseValidationService] Última gestión de vacaciones analizada (endDate: ${lastGestion.endDate}). Días disponibles proyectados: ${availableDays}`);

      if (availableDays <= 0) {
        console.log(`[LicenseValidationService] Usuario ${user.fullName} no tiene días disponibles (${availableDays} <= 0).`);
        return {
          canRequest: false,
          reason: `No tienes días de vacaciones disponibles para solicitar. Saldo actual proyectado: ${availableDays} día(s).`,
          availableDays: availableDays, // Devuelve los días disponibles
        };
      }

      if (requestedDays > availableDays) {
        console.log(`[LicenseValidationService] Días solicitados (${requestedDays}) exceden los disponibles (${availableDays}) para el usuario ${user.fullName}.`);
        return {
          canRequest: false,
          reason: `Has solicitado ${requestedDays} día(s), pero solo tienes ${availableDays} día(s) de vacaciones disponibles proyectados.`,
          availableDays: availableDays, // Devuelve los días disponibles
        };
      }

      console.log(`[LicenseValidationService] Validación de días de vacaciones exitosa para el usuario ${user.fullName}. Días disponibles: ${availableDays}.`);
      return { canRequest: true, availableDays: availableDays }; // Devuelve los días disponibles
    } catch (debtError) {
      console.error(`[LicenseValidationService] ERROR al calcular la deuda de vacaciones para CI ${ci}:`, debtError);
      return {
        canRequest: false,
        reason: 'Error al consultar la disponibilidad de días de vacaciones. Intente de nuevo más tarde.',
        availableDays: 0 // En caso de error, puedes devolver 0 días disponibles
      };
    }
  }

  /**
   * Método de validación final para cuando se intenta crear una licencia.
   * Lanza excepciones si no se cumplen las condiciones.
   * Este método sería llamado por el controlador al recibir una solicitud `POST /licenses`.
   *
   * @param userId ID del usuario que solicita la licencia.
   * @param licenseType Tipo de licencia solicitada.
   * @param requestedDays Días totales solicitados (solo relevante para VACACION).
   */
  async validateLicenseCreation(
    userId: number,
    licenseType: LicenseType,
    requestedDays: number,
  ): Promise<void> {
    console.log(`[LicenseValidationService] Iniciando validación para creación de licencia. Usuario ID: ${userId}, Tipo: ${licenseType}, Días: ${requestedDays}`);
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      console.log(`[LicenseValidationService] Usuario con ID ${userId} no encontrado para validación de creación.`);
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }
    console.log(`[LicenseValidationService] Usuario encontrado para validación de creación: ${user.fullName}`);

    // Si la licencia es de tipo VACACION, aplicamos las validaciones específicas
    if (licenseType === LicenseType.VACATION) {
      console.log(`[LicenseValidationService] Tipo de licencia es VACACION. Aplicando validaciones específicas.`);
      // 1. Validar última solicitud de VACACION pendiente
      const lastVacationRequest = await this.licenseRepository.findOne({
        where: {
          user: { id: userId },
          licenseType: LicenseType.VACATION,
          deleted: false,
        },
        order: { issuedDate: 'DESC' },
      });

      if (lastVacationRequest) {
        const supApproval = lastVacationRequest.immediateSupervisorApproval;
        const deptApproval = lastVacationRequest.personalDepartmentApproval;

        // Bloqueamos solo si alguna aprobación sigue pendiente
        if (supApproval === null || deptApproval === null) {
          throw new BadRequestException(
            `No puedes solicitar una nueva licencia de vacaciones. Tienes una solicitud anterior (ID: ${lastVacationRequest.id}) que aún no ha sido completamente aprobada.`,
          );
        }

        console.log(`[LicenseValidationService] Última solicitud de VACACION está en estado no pendiente (sup: ${supApproval}, dept: ${deptApproval}).`);
      }


      // 2. Validar días disponibles
      console.log(`[LicenseValidationService] Verificando días disponibles para el usuario ${user.fullName} para ${requestedDays} días.`);
      const { canRequest, reason } = await this.checkAvailableVacationDays(user.ci, requestedDays);
      if (!canRequest) {
        console.log(`[LicenseValidationService] Fallo en la validación de días disponibles. Motivo: ${reason}`);
        throw new BadRequestException(reason || 'No se puede crear la licencia de vacaciones por días insuficientes o un error de cálculo.');
      }
      console.log(`[LicenseValidationService] Validación de días disponibles OK.`);
    } else {
      console.log(`[LicenseValidationService] Tipo de licencia ${licenseType}. No se aplican validaciones específicas de VACACION.`);
    }

    // Aquí puedes añadir validaciones para otros tipos de licencia si es necesario
    // else if (licenseType === LicenseType.LICENCIA_MEDICA) { /* ... */ }

    console.log(`[LicenseValidationService] Validación exitosa para la creación de licencia de tipo ${licenseType} para el usuario ${user.fullName}.`);
  }
}