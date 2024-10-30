import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { VacationPolicyService } from 'src/services/vacation-policy.service';
import { CreateVacationPolicyDto } from 'src/entities/create-vacation-policy.dto';
import { UpdateVacationPolicyDto } from 'src/entities/update-vacation-policy.dto';
import { VacationPolicy } from 'src/entities/vacationPolicy.entity';

@ApiTags('Vacation Policies')
@Controller('vacation-policies')
export class VacationPolicyController {
  constructor(private readonly vacationPolicyService: VacationPolicyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vacation policy' })
  @ApiBody({ type: CreateVacationPolicyDto, description: 'Data to create a new vacation policy' })
  @ApiResponse({
    status: 201,
    description: 'The vacation policy has been successfully created.',
    type: VacationPolicy,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid input data.',
  })
  async createPolicy(@Body() dto: CreateVacationPolicyDto): Promise<VacationPolicy> {
    return await this.vacationPolicyService.createPolicy(dto.minYears, dto.maxYears, dto.vacationDays);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vacation policies' })
  @ApiResponse({
    status: 200,
    description: 'List of all vacation policies',
    type: [VacationPolicy],
  })
  async getAllPolicies(): Promise<VacationPolicy[]> {
    return await this.vacationPolicyService.getAllPolicies();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vacation policy by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID of the vacation policy to retrieve',
  })
  @ApiResponse({
    status: 200,
    description: 'The vacation policy with the specified ID',
    type: VacationPolicy,
  })
  @ApiResponse({
    status: 404,
    description: 'Vacation policy not found',
  })
  async getPolicyById(@Param('id') id: number): Promise<VacationPolicy> {
    return await this.vacationPolicyService.getPolicyById(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vacation policy by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID of the vacation policy to update',
  })
  @ApiBody({ type: UpdateVacationPolicyDto, description: 'Data to update the vacation policy' })
  @ApiResponse({
    status: 200,
    description: 'The vacation policy has been successfully updated',
    type: VacationPolicy,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid input data.',
  })
  @ApiResponse({
    status: 404,
    description: 'Vacation policy not found',
  })
  async updatePolicy(
    @Param('id') id: number,
    @Body() dto: UpdateVacationPolicyDto,
  ): Promise<VacationPolicy> {
    return await this.vacationPolicyService.updatePolicy(id, dto.minYears, dto.maxYears, dto.vacationDays);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vacation policy by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID of the vacation policy to delete',
  })
  @ApiResponse({
    status: 204,
    description: 'The vacation policy has been successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Vacation policy not found',
  })
  async deletePolicy(@Param('id') id: number): Promise<void> {
    await this.vacationPolicyService.deletePolicy(id);
  }
}
