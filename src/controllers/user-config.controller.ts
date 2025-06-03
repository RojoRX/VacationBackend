import { Controller, Post, Body, Param, Get, Patch, Delete } from '@nestjs/common';
import { UserConfigService } from 'src/services/user-config.service';
import { CreateUserConfigDto } from 'src/dto/create-user-config.dto';
import { UpdateUserConfigDto } from 'src/dto/update-user-config.dto';

@Controller('user-config')
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Post()
  create(@Body() dto: CreateUserConfigDto) {
    return this.userConfigService.create(dto);
  }

  @Get(':userId')
  findByUser(@Param('userId') userId: string) {
    return this.userConfigService.findByUserId(Number(userId));
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() dto: UpdateUserConfigDto) {
    return this.userConfigService.update(Number(userId), dto);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.userConfigService.delete(Number(userId));
  }
}
