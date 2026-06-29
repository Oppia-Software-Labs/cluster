import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChallengeQueryDto } from './dto/challenge-query.dto';
import { VerifyAuthDto } from './dto/verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('challenge')
  challenge(@Query() query: ChallengeQueryDto): { message: string; nonce: string } {
    return this.auth.createChallenge(query.publicKey);
  }

  @Post('verify')
  async verify(@Body() dto: VerifyAuthDto, @Res({ passthrough: true }) res: Response) {
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
  me(@Req() req: any) {
    return req.user;
  }
}
