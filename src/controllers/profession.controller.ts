import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProfessionService } from 'src/services/profession.service';
import { CreateProfessionDto } from 'src/dto/create-profession.dto';
@ApiTags('Profession')
@Controller('professions')
export class ProfessionController {
  constructor(private readonly professionService: ProfessionService) {}

  @Post()
  create(@Body() dto: CreateProfessionDto) {
    return this.professionService.create(dto);
  }

  @Get()
  findAll() {
    return this.professionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.professionService.findOne(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.professionService.remove(+id);
  }
}
