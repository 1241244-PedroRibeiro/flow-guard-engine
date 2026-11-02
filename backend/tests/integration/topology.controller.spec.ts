import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../../src/presentation/http/guards/JwtAuthGuard';
import { RolesGuard } from '../../src/presentation/http/guards/RolesGuard';
import { PlantSectorController } from '../../src/presentation/http/controllers/PlantSectorController';
import { ConveyorLineController } from '../../src/presentation/http/controllers/ConveyorLineController';
import { PlantTopologyService } from '../../src/application/topology/PlantTopologyService';
import { InMemoryPlantTopologyRepository } from '../helpers/fakes/InMemoryPlantTopologyRepository';
import { JwtTokenService } from '../../src/infrastructure/security/JwtTokenService';
import { UserRole } from '../../src/domain/user/UserRole';
import { GlobalExceptionFilter } from '../../src/presentation/global_exception.filter';

describe('Topology Controllers (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let operatorToken: string;
  let sectorId: string;
  const uniqueId = Date.now().toString().slice(-6);

  beforeAll(async () => {
    // Cria um módulo de teste isolado (sem ligar à BD real)
    const moduleRef = await Test.createTestingModule({
      controllers: [PlantSectorController, ConveyorLineController],
      providers: [
        PlantTopologyService,
        {
          provide: 'IPlantTopologyRepository',
          useClass: InMemoryPlantTopologyRepository, // Usa o Fake em memória
        },
        {
          provide: PlantTopologyService,
          useFactory: (repo) => new PlantTopologyService(repo),
          inject: ['IPlantTopologyRepository'],
        },
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
        {
          provide: 'ITokenService',
          useClass: JwtTokenService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    
    await app.init();

    // Gera tokens válidos
    const jwtService = new JwtTokenService();
    adminToken = jwtService.sign({ sub: 'admin-id', email: 'a@a.com', roles: [UserRole.ADMINISTRATOR] });
    operatorToken = jwtService.sign({ sub: 'op-id', email: 'o@o.com', roles: [UserRole.OPERATOR] });
  });

  afterAll(async () => { 
    await app.close(); 
  });

  it('POST /api/v1/plant-sectors -> 201 (Admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/plant-sectors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectorCode: `SEC-TEST-${uniqueId}`, name: 'Test Sector' });
    
    expect(res.status).toBe(201);
    sectorId = res.body.id;
  });

  it('POST /api/v1/plant-sectors -> 403 (Operator)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/plant-sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sectorCode: `SEC-TEST-2-${uniqueId}`, name: 'Test Sector 2' });
    
    expect(res.status).toBe(403);
  });

  it('POST /api/v1/conveyor-lines -> 201 (Admin)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/conveyor-lines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sectorId, lineCode: `LINE-TEST-${uniqueId}`, name: 'Test Line' });
    
    expect(res.status).toBe(201);
    expect(res.body.activeSensorCount).toBe(0);
  });

  it('GET /api/v1/conveyor-lines -> 200 (Operator)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conveyor-lines?sectorId=${sectorId}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});