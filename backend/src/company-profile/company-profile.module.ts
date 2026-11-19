import { Body, Controller, Get, Module, Patch } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { CompanyOffersModule } from '../company-offers/company-offers.module.js';
import { CompanyProfileService } from './company-profile.service.js';
import { UpdateCompanyProfileDto } from './update-company-profile.dto.js';

@Roles('COMPANY')
@Controller('companies/me/profile')
class CompanyProfileController {
  constructor(private readonly profiles: CompanyProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyProfileDto) {
    return this.profiles.update(user.id, dto);
  }
}

@Module({
  imports: [CompanyOffersModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
})
export class CompanyProfileModule {}
