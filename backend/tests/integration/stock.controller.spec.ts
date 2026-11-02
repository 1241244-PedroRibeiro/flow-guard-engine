import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import { SparePartStockController } from '../../src/presentation/http/controllers/SparePartStockController';
import { SparePartsStockService } from '../../src/application/stock/SparePartsStockService';
import { GlobalExceptionFilter } from '../../src/presentation/global_exception.filter';
import { JwtAuthGuard } from '../../src/presentation/http/guards/JwtAuthGuard';
import { RolesGuard } from '../../src/presentation/http/guards/RolesGuard';
import { InMemorySparePartStockRepository } from '../helpers/fakes/InMemorySparePartStockRepository';
import { SparePartStock } from '../../src/domain/stock/SparePartStock';
import { PartCode } from '../../src/domain/common/PartCode';
import { AbstractStockQuantity } from '../../src/domain/common/AbstractStockQuantity';

const PART_UUID = '11111111-1111-4111-8111-111111111111';

describe('SparePartStockController', () => {
  let app: INestApplication;
  let repo: InMemorySparePartStockRepository;

  beforeEach(async () => {
    repo = new InMemorySparePartStockRepository();
    const part = SparePartStock.reconstitute({
      id: PART_UUID, partCode: PartCode.create('PRT-BRG-6204'), name: 'Bearing',
      stockUnits: AbstractStockQuantity.create(10), updatedAt: new Date()
    });
    repo.parts.set(PART_UUID, part);

    const moduleRef = await Test.createTestingModule({
      controllers: [SparePartStockController],
      providers: [
        SparePartsStockService,
        { provide: 'ISparePartStockRepository', useValue: repo },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    })
      .overrideProvider(SparePartsStockService)
      .useFactory({ factory: (r: any) => new SparePartsStockService(r), inject: ['ISparePartStockRepository'] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => {
        ctx.switchToHttp().getRequest().user = { sub: 'u1' }; return true;
      }})
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  it('AC1 — 201 Created on register', async () => {
    const res = await request(app.getHttpServer())
      .post('/spare-parts')
      .send({ partCode: 'PRT-NEW', name: 'New part', initialStockUnits: 5 });
    expect(res.status).toBe(201);
  });

  it('AC1 — 409 Conflict on duplicate partCode', async () => {
    const res = await request(app.getHttpServer())
      .post('/spare-parts')
      .send({ partCode: 'PRT-BRG-6204', name: 'Dup', initialStockUnits: 5 });
    expect(res.status).toBe(409);
  });

  it('AC2 — 422 on insufficient stock', async () => {
    const res = await request(app.getHttpServer())
      .post(`/spare-parts/${PART_UUID}/consume`)
      .send({ units: 20, reason: 'Too much' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Insufficient/);
  });

  it('AC3 — 200 OK on replenish', async () => {
    const res = await request(app.getHttpServer())
      .post(`/spare-parts/${PART_UUID}/replenish`)
      .send({ units: 5, reason: 'Restock' });
    expect(res.status).toBe(200);
    expect(res.body.stockUnits).toBe(15);
  });
});