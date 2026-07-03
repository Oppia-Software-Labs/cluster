import type { Request } from 'express';
import { ConfidentialController } from './confidential.controller';
import { ConfidentialService } from './confidential.service';

const ME = 'GMEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const req = { user: { publicKey: ME } } as Request & {
  user: { publicKey: string };
};

describe('ConfidentialController', () => {
  let controller: ConfidentialController;
  let service: jest.Mocked<
    Pick<
      ConfidentialService,
      | 'publishWrapKey'
      | 'getWrapKey'
      | 'putEnvelope'
      | 'listEnvelopes'
      | 'putOpening'
      | 'listOpenings'
      | 'createRegistration'
      | 'advanceRegistration'
      | 'getRegistration'
    >
  >;

  beforeEach(() => {
    service = {
      publishWrapKey: jest.fn(),
      getWrapKey: jest.fn(),
      putEnvelope: jest.fn(),
      listEnvelopes: jest.fn(),
      putOpening: jest.fn(),
      listOpenings: jest.fn(),
      createRegistration: jest.fn(),
      advanceRegistration: jest.fn(),
      getRegistration: jest.fn(),
    };
    controller = new ConfidentialController(
      service as unknown as ConfidentialService,
    );
  });

  it('publishWrapKey uses the session publicKey, never the body', () => {
    const dto = { wrapPublicKey: 'PUB' };
    controller.publishWrapKey(req, dto);
    expect(service.publishWrapKey).toHaveBeenCalledWith(ME, dto);
  });

  it('putOpening forwards the account ref and the blob', () => {
    const dto = { eventKey: 'led:1:0', ciphertext: 'C' };
    controller.putOpening('GACC', dto);
    expect(service.putOpening).toHaveBeenCalledWith('GACC', dto);
  });

  it('putEnvelope forwards the account ref and the envelope', () => {
    const dto = { memberPublicKey: 'GMEM', ciphertext: 'S' };
    controller.putEnvelope('GACC', dto);
    expect(service.putEnvelope).toHaveBeenCalledWith('GACC', dto);
  });

  it('advanceRegistration forwards ref and status', () => {
    controller.advanceRegistration('GACC', { status: 'registered' });
    expect(service.advanceRegistration).toHaveBeenCalledWith('GACC', {
      status: 'registered',
    });
  });
});
