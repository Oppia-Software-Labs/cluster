import type { Request } from 'express';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import type { CreateMultisigAccountRequest } from '@cluster/shared';

const CREATOR = 'GCREATORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const req = { user: { publicKey: CREATOR } } as Request & { user: { publicKey: string } };

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: jest.Mocked<Pick<AccountsService, 'create' | 'listForUser' | 'getById' | 'getMembers'>>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      listForUser: jest.fn(),
      getById: jest.fn(),
      getMembers: jest.fn(),
    };
    controller = new AccountsController(service as unknown as AccountsService);
  });

  it('create() forwards the session publicKey (never the body) and the dto', () => {
    const dto = { name: 'T' } as unknown as CreateMultisigAccountRequest;
    controller.create(req, dto);
    expect(service.create).toHaveBeenCalledWith(CREATOR, dto);
  });

  it('list() scopes to the authenticated user', () => {
    controller.list(req);
    expect(service.listForUser).toHaveBeenCalledWith(CREATOR);
  });

  it('getOne() passes the account id and requester', () => {
    controller.getOne(req, 'acc_1');
    expect(service.getById).toHaveBeenCalledWith('acc_1', CREATOR);
  });

  it('getMembers() passes the account id and requester', () => {
    controller.getMembers(req, 'acc_1');
    expect(service.getMembers).toHaveBeenCalledWith('acc_1', CREATOR);
  });
});
