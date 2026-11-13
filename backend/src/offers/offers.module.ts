import { Module } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';

@Module({
  controllers: [OffersController],
  providers: [OffersService, ClockService],
})
export class OffersModule {}
