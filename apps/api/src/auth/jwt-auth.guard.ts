import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Missing session cookie');
    }
    let payload: { sub: string };
    try {
      payload = this.auth.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
    const user = await this.prisma.user.findUnique({ where: { publicKey: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    req.user = user;
    return true;
  }
}
