import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { PlantTopologyService } from '../../../application/topology/PlantTopologyService';
import { Roles } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { CreatePlantSectorCommand } from '../../../application/topology/dto/CreatePlantSectorCommand';
import { UpdatePlantSectorCommand } from '../../../application/topology/dto/UpdatePlantSectorCommand';

@Controller('plant-sectors')
export class PlantSectorController {
  constructor(private readonly topologyService: PlantTopologyService) {}

  @Post()
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async create(@Body() body: CreatePlantSectorCommand) {
    return this.topologyService.createSector(body);
  }

  @Get()
  async findAll(@Query('isActive') isActive?: string) {
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;
    return this.topologyService.findAllSectors(activeFilter);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.topologyService.findSectorById(id);
  }

  @Put(':id')
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async update(@Param('id') id: string, @Body() body: UpdatePlantSectorCommand) {
    return this.topologyService.updateSector(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.topologyService.deleteSector(id);
  }
}