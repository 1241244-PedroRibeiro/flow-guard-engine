import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { PlantTopologyService } from '../../../application/topology/PlantTopologyService';
import { Roles } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { CreateConveyorLineCommand } from '../../../application/topology/dto/CreateConveyorLineCommand';
import { UpdateLineOperationalStatusCommand } from '../../../application/topology/dto/UpdateLineOperationalStatusCommand';

@Controller('conveyor-lines')
export class ConveyorLineController {
  constructor(private readonly topologyService: PlantTopologyService) {}

  @Post()
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  async create(@Body() body: CreateConveyorLineCommand) {
    return this.topologyService.createConveyorLine(body);
  }

  @Get()
  async findAll(
    @Query('sectorId') sectorId?: string,
    @Query('operationalStatus') operationalStatus?: string,
  ) {
    return this.topologyService.findLineHealthSummaries({ sectorId, operationalStatus });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.topologyService.findLineSummaryById(id);
  }

  @Patch(':id/operational-status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateLineOperationalStatusCommand,
  ) {
    return this.topologyService.updateLineStatus(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ENGINEER, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.topologyService.deleteLine(id);
  }
}