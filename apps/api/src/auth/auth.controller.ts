import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ZodBody } from '../common/decorators/zod-body.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  stellarPublicKeySchema,
  verifyAuthSchema,
  type VerifyAuthDto,
} from './dto/auth.schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('challenge')
  challenge(
    @Query('publicKey', new ZodValidationPipe(stellarPublicKeySchema)) publicKey: string,
  ): { message: string; nonce: string } {
    return this.auth.createChallenge(publicKey);
  }

  @Post('verify')
  async verify(
    @ZodBody(verifyAuthSchema) dto: VerifyAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ok = this.auth.verifyChallenge(dto.publicKey, dto.signature, dto.nonce);
    if (!ok) {
      throw new UnauthorizedException('Signature verification failed');
    }
    const user = await this.auth.upsertUser(dto.publicKey);
    const token = this.auth.issueToken(dto.publicKey);
    this.auth.setSessionCookie(res, token);
    return user;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    this.auth.clearSessionCookie(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: unknown }) {
    return req.user;
  }
}
