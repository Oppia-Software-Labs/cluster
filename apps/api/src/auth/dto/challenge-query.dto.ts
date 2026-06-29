import { IsString, Matches } from 'class-validator';

// Stellar ed25519 public keys: 'G' + 55 base32 chars.
const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

export class ChallengeQueryDto {
  @IsString()
  @Matches(STELLAR_PUBLIC_KEY, { message: 'publicKey must be a Stellar G... address' })
  publicKey!: string;
}
