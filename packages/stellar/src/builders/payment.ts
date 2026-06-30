import {
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import type {
  BuiltTransaction,
  TransactionBuilder as ITransactionBuilder,
} from "@cluster/shared";
import { getNetworkPassphrase } from "../network.js";
import { getRpcServer } from "../rpc.js";

export type PaymentInput = {
  source: string;
  destination: string;
  asset: "native" | { code: string; issuer: string };
  amount: string;
  memo?: string;
};

export class PaymentBuilder implements ITransactionBuilder<PaymentInput> {
  async build(input: PaymentInput): Promise<BuiltTransaction> {
    const server = getRpcServer();
    const account = await server.getAccount(input.source);

    const asset =
      input.asset === "native"
        ? Asset.native()
        : new Asset(input.asset.code, input.asset.issuer);

    let builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: getNetworkPassphrase(),
    }).addOperation(
      Operation.payment({
        destination: input.destination,
        asset,
        amount: input.amount,
      }),
    );

    if (input.memo) {
      builder = builder.addMemo(Memo.text(input.memo));
    }

    const tx = builder.setTimeout(180).build();

    return {
      xdr: tx.toXDR(),
      type: "payment",
      thresholdLevel: "medium",
    };
  }
}
