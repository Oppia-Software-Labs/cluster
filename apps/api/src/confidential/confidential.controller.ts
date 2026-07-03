import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  advanceRegistrationSchema,
  confidentialRegistrationSchema,
  keyEnvelopeSchema,
  openingBlobSchema,
  wrapKeySchema,
  type AdvanceRegistrationDto,
  type ConfidentialRegistrationDto,
  type KeyEnvelopeDto,
  type OpeningBlobDto,
  type WrapKeyDto,
} from '@cluster/shared';
import { ZodBody } from '../common/decorators/zod-body.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfidentialService } from './confidential.service';

type AuthedRequest = Request & { user: { publicKey: string } };

@UseGuards(JwtAuthGuard)
@Controller('confidential')
export class ConfidentialController {
  constructor(private readonly confidential: ConfidentialService) {}

  // ── Wrap keys (per authenticated user) ─────────────────────────────────
  @Put('wrap-key')
  publishWrapKey(
    @Req() req: AuthedRequest,
    @ZodBody(wrapKeySchema) dto: WrapKeyDto,
  ) {
    return this.confidential.publishWrapKey(req.user.publicKey, dto);
  }

  @Get('wrap-key/:userPublicKey')
  getWrapKey(@Param('userPublicKey') userPublicKey: string) {
    return this.confidential.getWrapKey(userPublicKey);
  }

  // ── Key envelopes ──────────────────────────────────────────────────────
  @Put('accounts/:id/envelopes')
  putEnvelope(
    @Param('id') id: string,
    @ZodBody(keyEnvelopeSchema) dto: KeyEnvelopeDto,
  ) {
    return this.confidential.putEnvelope(id, dto);
  }

  @Get('accounts/:id/envelopes')
  listEnvelopes(@Param('id') id: string) {
    return this.confidential.listEnvelopes(id);
  }

  // ── Openings ───────────────────────────────────────────────────────────
  @Put('accounts/:id/openings')
  putOpening(
    @Param('id') id: string,
    @ZodBody(openingBlobSchema) dto: OpeningBlobDto,
  ) {
    return this.confidential.putOpening(id, dto);
  }

  @Get('accounts/:id/openings')
  listOpenings(@Param('id') id: string) {
    return this.confidential.listOpenings(id);
  }

  // ── Registration ───────────────────────────────────────────────────────
  @Post('accounts/:id/registration')
  createRegistration(
    @Param('id') id: string,
    @ZodBody(confidentialRegistrationSchema) dto: ConfidentialRegistrationDto,
  ) {
    return this.confidential.createRegistration(id, dto);
  }

  @Patch('accounts/:id/registration')
  advanceRegistration(
    @Param('id') id: string,
    @ZodBody(advanceRegistrationSchema) dto: AdvanceRegistrationDto,
  ) {
    return this.confidential.advanceRegistration(id, dto);
  }

  @Get('accounts/:id/registration')
  getRegistration(@Param('id') id: string) {
    return this.confidential.getRegistration(id);
  }
}
