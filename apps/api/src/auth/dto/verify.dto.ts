import { IsString, Matches, MinLength } from 'class-validator';

const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

export class VerifyAuthDto {
  @IsString()
  @Matches(STELLAR_PUBLIC_KEY, { message: 'publicKey must be a Stellar G... address' })
  publicKey!: string;

  @IsString()
  @MinLength(1)
  signature!: string; // base64 ed25519 signature returned by the wallet

  @IsString()
  @MinLength(1)
  nonce!: string;
}
