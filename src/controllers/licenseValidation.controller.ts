// src/licenses/licenses.controller.ts

import {
  Controller,
  Get,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'; // Opcional: para Swagger/OpenAPI

import { LicenseValidationService } from 'src/services/license-validation.service';// Tu servicio de validación

// --- DTO para la respuesta del endpoint can-request ---
// Define la estructura del JSON que se enviará como respuesta.
class CanRequestLicenseResponseDto {
  canRequest: boolean;
  reason?: string;
}

@ApiTags('Licenses Validation') // Opcional: categoriza los endpoints en la UI de Swagger
@Controller('licenses-validation')
export class LicensesValidationController {
  constructor(
    // Inyecta únicamente el servicio de validación que necesitas para este controlador.
    private readonly licenseValidationService: LicenseValidationService,
  ) {}

  /**
   * Endpoint para verificar si un usuario puede solicitar una nueva licencia de vacaciones.
   * Devuelve un estado booleano y un motivo si no es posible.
   * Ideal para habilitar/deshabilitar elementos en la interfaz de usuario del frontend.
   */
  @Get('can-request/:ci')
  @HttpCode(HttpStatus.OK) // Asegura que la respuesta HTTP sea 200 OK
  @ApiOperation({ summary: 'Verificar si un usuario puede solicitar una licencia de vacaciones' })
  @ApiParam({
    name: 'ci',
    description: 'Carnet de identidad (CI) del usuario a verificar',
    type: 'string',
    example: '12345678', // Ejemplo de CI
  })
  @ApiResponse({
    status: 200,
    description: 'Retorna si el usuario puede solicitar una licencia y el motivo si no es posible.',
    type: CanRequestLicenseResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor al procesar la verificación.',
  })
  async canRequestLicense(
    @Param('ci') ci: string,
  ): Promise<CanRequestLicenseResponseDto> {
    // Llama al método de tu servicio de validación que devuelve el objeto { canRequest, reason }.
    // Este método ya maneja sus propios errores y los devuelve en el `reason`.
    return this.licenseValidationService.checkPermissionToRequest(ci);
  }
}