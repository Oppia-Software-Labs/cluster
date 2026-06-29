import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;
  const auth = {
    createChallenge: jest.fn().mockReturnValue({ message: 'm', nonce: 'n' }),
    verifyChallenge: jest.fn(),
    upsertUser: jest.fn().mockResolvedValue({ publicKey: 'GABC' }),
    issueToken: jest.fn().mockReturnValue('jwt'),
    setSessionCookie: jest.fn(),
    clearSessionCookie: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        // JwtAuthGuard (bound via @UseGuards on `me`) depends on PrismaService;
        // supply a stub so the controller test module resolves.
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
      ],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('challenge returns message+nonce', () => {
    expect(controller.challenge('GABC')).toEqual({ message: 'm', nonce: 'n' });
  });

  it('verify rejects a bad signature', async () => {
    auth.verifyChallenge.mockReturnValue(false);
    const res = { cookie: jest.fn() } as any;
    await expect(
      controller.verify({ publicKey: 'GABC', signature: 's', nonce: 'n' } as any, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verify sets the cookie and returns the user on success', async () => {
    auth.verifyChallenge.mockReturnValue(true);
    const res = { cookie: jest.fn() } as any;
    const out = await controller.verify({ publicKey: 'GABC', signature: 's', nonce: 'n' } as any, res);
    expect(auth.setSessionCookie).toHaveBeenCalledWith(res, 'jwt');
    expect(out).toEqual({ publicKey: 'GABC' });
  });

  it('logout clears the cookie', () => {
    const res = { clearCookie: jest.fn() } as any;
    controller.logout(res);
    expect(auth.clearSessionCookie).toHaveBeenCalledWith(res);
  });

  it('me returns req.user', () => {
    expect(controller.me({ user: { publicKey: 'GABC' } } as any)).toEqual({ publicKey: 'GABC' });
  });
});
