import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE } from './auth.service';

function ctxWith(cookies: Record<string, string>): ExecutionContext {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const authMock = {
    verifyToken: jest.fn(),
    prismaFindUser: jest.fn(),
  };
  const prismaMock = { user: { findUnique: jest.fn() } };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(authMock as any, prismaMock as any);
  });

  it('rejects a request with no session cookie', async () => {
    await expect(guard.canActivate(ctxWith({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a request with an invalid token', async () => {
    authMock.verifyToken.mockImplementation(() => {
      throw new Error('bad');
    });
    await expect(
      guard.canActivate(ctxWith({ [SESSION_COOKIE]: 'garbage' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the user no longer exists', async () => {
    authMock.verifyToken.mockReturnValue({ sub: 'GABC' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctxWith({ [SESSION_COOKIE]: 'valid' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and populates req.user', async () => {
    const user = { publicKey: 'GABC', createdAt: new Date() };
    authMock.verifyToken.mockReturnValue({ sub: 'GABC' });
    prismaMock.user.findUnique.mockResolvedValue(user);
    const ctx = ctxWith({ [SESSION_COOKIE]: 'valid' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().user).toEqual(user);
  });
});
