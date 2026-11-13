import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Module global : PrismaService est disponible dans tous les modules
 * sans avoir à importer PrismaModule à chaque fois.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
