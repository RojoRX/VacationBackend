// src/controllers/license.controller.ts
import { Controller, Post, Get, Param, Put, Delete, Body, Query, Patch, ParseIntPipe, BadRequestException, NotFoundException, Req, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { LicenseService } from 'src/services/license.service';
import { License } from 'src/entities/license.entity';
import { LicenseResponseDto } from 'src/dto/license-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { User } from 'src/entities/user.entity';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RoleEnum } from 'src/enums/role.enum';
import { CustomRequest } from 'src/interfaces/request.interface';

@ApiTags('Licencias')
@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) { }

  @Get('total-for-user')
  @ApiOperation({ summary: 'Obtener el total de licencias para un usuario' })
  @ApiQuery({ name: 'userId', required: true, type: Number, description: 'ID del usuario' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Fecha de inicio' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Fecha de fin' })
  @ApiResponse({ status: 200, description: 'Total de licencias y días', type: Object })
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
  @ApiOperation({ summary: 'Crear una nueva licencia' })
  @ApiParam({ name: 'userId', required: true, description: 'ID del usuario para el que se crea la licencia' })
  @ApiBody({ type: License, description: 'Datos de la licencia a crear' })
  @ApiResponse({ status: 201, description: 'Licencia creada exitosamente', type: LicenseResponseDto })
  @ApiResponse({ status: 400, description: 'Error al crear la licencia' })
  async create(
    @Param('userId') userId: number,
    @Body() licenseData: Partial<License>
  ): Promise<LicenseResponseDto> {
    return this.licenseService.createLicense(userId, licenseData);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las licencias' })
  @ApiResponse({ status: 200, description: 'Lista de licencias', type: [LicenseResponseDto] })
  async findAll(): Promise<LicenseResponseDto[]> {
    return this.licenseService.findAllLicenses();
  }

  @Get('hr-pending')
  @ApiOperation({ summary: 'Licencias pendientes de aprobación por RRHH' })
  @ApiResponse({ status: 200, description: 'Lista de licencias pendientes' })
  async getPendingLicensesForHR() {
    return this.licenseService.getPendingLicensesForHR();
  }
  @Get('deleted')
  async getDeletedLicenses(): Promise<LicenseResponseDto[]> {
    return this.licenseService.getDeletedLicenses();
  }


  @Get(':id')
  @ApiOperation({ summary: 'Obtener una licencia por ID' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Licencia encontrada', type: LicenseResponseDto })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async findOne(@Param('id') id: number): Promise<LicenseResponseDto> {
    return this.licenseService.findOneLicense(id);
  }

@Put(':id')
@ApiOperation({ summary: 'Actualizar una licencia' })
@ApiParam({ name: 'id', required: true, description: 'ID de la licencia a actualizar' })
@ApiBody({ type: License, description: 'Datos de la licencia a actualizar' })
@ApiResponse({ status: 200, description: 'Licencia actualizada exitosamente', type: LicenseResponseDto })
@ApiResponse({ status: 404, description: 'Licencia no encontrada' })
async update(
  @Param('id') id: number,
  @Body() updateData: Partial<License>,
): Promise<LicenseResponseDto> {
  // 🔹 Eliminar campos automáticos que no deben actualizarse
  delete updateData.totalDays;
  delete updateData.issuedDate;

  return this.licenseService.updateLicense(id, updateData);
}


  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Eliminar una licencia (borrado lógico)' })
  @ApiParam({ name: 'id', required: true, description: 'ID de la licencia a eliminar' })
  @ApiResponse({ status: 204, description: 'Licencia eliminada exitosamente' })
  @ApiResponse({ status: 403, description: 'No tiene permiso para eliminar esta licencia' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async remove(
    @Param('id') id: number,
    @Req() req: CustomRequest,
  ): Promise<void> {
    console.log(`[LicensesController] Intentando eliminar licencia con ID: ${id}`);

    // Asegúrate de que req.user exista y contenga el ID del usuario
    if (!req.user || !req.user.id) {
      console.error('[LicensesController] Error: req.user o req.user.id no está disponible después del AuthGuard.');
      throw new UnauthorizedException('No se pudo obtener la información del usuario autenticado.');
    }

    const requestingUserId = req.user.id;
    console.log(`[LicensesController] Usuario autenticado (requestingUserId): ${requestingUserId}`);
    console.log(`[LicensesController] Rol del usuario autenticado: ${req.user.role}`);


    try {
      await this.licenseService.removeLicense(id, requestingUserId);
      console.log(`[LicensesController] Licencia ${id} eliminada exitosamente por el usuario ${requestingUserId}.`);
    } catch (error) {
      console.error(`[LicensesController] Error al intentar eliminar licencia ${id}:`, error.message);
      // Re-lanzar el error para que NestJS lo maneje y devuelva la respuesta adecuada
      throw error;
    }
  }


  @Get('authorized/:userId')
  @ApiOperation({ summary: 'Obtener licencias autorizadas para un usuario' })
  @ApiParam({ name: 'userId', required: true, description: 'ID del usuario' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Fecha de inicio' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Fecha de fin' })
  @ApiResponse({ status: 200, description: 'Total de días autorizados y solicitudes', type: Object })
  async getAuthorizedLicenses(
    @Param('userId') userId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ totalAuthorizedDays: number; requests: LicenseResponseDto[] }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.licenseService.getTotalAuthorizedLicensesForUser(userId, start, end);
  }


  @Patch(':licenseId/personal-approval')
  @ApiOperation({ summary: 'Actualizar la aprobación del departamento personal' })
  @ApiParam({ name: 'licenseId', required: true, description: 'ID de la licencia' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approval: { type: 'boolean', description: 'Estado de aprobación' },
      },
      required: ['approval'],
    },
  })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  async updatePersonalApproval(
    @Param('licenseId') licenseId: number,
    @Body('approval') approval: boolean,
    @Req() req: any // user ya viene del token
  ) {
    return this.licenseService.updatePersonalDepartmentApproval(
      licenseId,
      req.user,   // <-- aquí pasamos el user completo, NO el id
      approval
    );
  }




  @Patch(':licenseId/approve')
  @ApiOperation({ summary: 'Aprobar o rechazar una licencia por el supervisor' })
  @ApiParam({ name: 'licenseId', required: true, description: 'ID de la licencia' })
  @ApiQuery({ name: 'supervisorId', required: true, type: Number, description: 'ID del supervisor' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approval: { type: 'boolean', description: 'true para aprobar, false para rechazar' },
      },
      required: ['approval'],
    },
  })
  @ApiResponse({ status: 200, description: 'Licencia aprobada o rechazada', type: LicenseResponseDto })
  async approveLicense(
    @Param('licenseId') licenseId: number,
    @Query('supervisorId') supervisorId: number,
    @Body('approval') approval: boolean,
  ): Promise<LicenseResponseDto> {
    return this.licenseService.approveLicense(licenseId, supervisorId, approval);
  }


  @Get('department/:supervisorId')
  @ApiOperation({ summary: 'Obtener las licencias del departamento del supervisor' })
  @ApiParam({ name: 'supervisorId', required: true, description: 'ID del supervisor' })
  @ApiResponse({ status: 200, description: 'Lista de licencias del departamento', type: [LicenseResponseDto] }) // Cambia License a LicenseResponseDto
  async findLicensesByDepartment(
    @Param('supervisorId') supervisorId: number,
  ): Promise<LicenseResponseDto[]> { // Cambia el tipo de retorno a LicenseResponseDto[]
    return this.licenseService.findLicensesByDepartment(supervisorId);
  }

  // --- ¡CAMBIOS AQUÍ! ---
  @UseGuards(AuthGuard, RolesGuard) // 1. Aplica AMBOS guards en este orden.
  @Roles(RoleEnum.ADMIN)               // 2. Especifica que solo el rol 'ADMIN' puede acceder.
  // --- FIN DE CAMBIOS ---
  @Delete(':id/admin-remove') // Una ruta más específica para la eliminación por admin
  @HttpCode(HttpStatus.NO_CONTENT) // Retorna 204 No Content para eliminaciones exitosas
  @ApiOperation({
    summary: 'Elimina lógicamente una licencia por un administrador',
    description: 'Permite a un administrador marcar una licencia como eliminada (borrado lógico) sin requerir validaciones adicionales de estado o aprobación.',
  })
  @ApiResponse({ status: 204, description: 'Licencia eliminada correctamente' })
  @ApiResponse({ status: 400, description: 'La licencia ya fue eliminada' })
  @ApiResponse({ status: 403, description: 'No tienes permiso para realizar esta acción (solo administradores)' }) // Importante: ahora RolesGuard lanzará 403
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async adminRemoveLicense(
    @Param('id', ParseIntPipe) licenseId: number,
  ): Promise<void> {
    // La lógica de verificación de rol ya está en los guards.
    // El servicio solo necesita la lógica de negocio de la eliminación.
    await this.licenseService.adminRemoveLicense(licenseId);
  }



  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtener todas las licencias de un usuario' }) // Descripción del endpoint
  @ApiParam({ name: 'userId', type: Number, description: 'ID del usuario' }) // Parámetro documentado
  @ApiResponse({
    status: 200,
    description: 'Licencias obtenidas con éxito.',
    type: [LicenseResponseDto], // Tipo de respuesta esperada (lista de DTOs)
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o licencias no encontradas.',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud incorrecta o parámetro inválido.',
  })
  async getAllLicensesForUser(
    @Param('userId', ParseIntPipe) userId: number
  ): Promise<LicenseResponseDto[]> {
    return this.licenseService.getAllLicensesForUser(userId);
  }


  @Post('user/:userId/multiple')
  @ApiOperation({ summary: 'Registrar múltiples licencias aprobadas para un usuario' })
  @ApiParam({ name: 'userId', type: Number, description: 'ID del usuario al que se le registrarán las licencias' })
  @ApiBody({
    description: 'Arreglo de licencias a registrar',
    type: [License],
    examples: {
      example1: {
        summary: 'Licencias de años anteriores',
        value: [
          {
            licenseType: 'VACACION',
            timeRequested: 'Varios Días',
            startDate: '2023-07-01',
            endDate: '2023-07-10',
          },
          {
            licenseType: 'VACACION',
            timeRequested: 'Día Completo',
            startDate: '2024-02-03',
            endDate: '2024-02-03',
          }
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Licencias registradas correctamente',
    type: [LicenseResponseDto],
  })
  async createMultipleLicenses(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() licensesData: Partial<License>[],
  ): Promise<LicenseResponseDto[]> {
    return this.licenseService.createMultipleLicenses(userId, licensesData);
  }
}
