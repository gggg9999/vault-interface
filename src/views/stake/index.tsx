import { FC, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import idl from "../../idl.json";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { notify } from "../../utils/notifications";

const STAKE_PROGRAM_ID = new anchor.web3.PublicKey(
  "AtjBMK1fjoXw3sBiMBJkyStuPT1S87DU1mMvmGanN3hq"
);
// const configPda = "AGF7Snks1pFCdFTaBsaxpxEjgHkGBoLonihiGVTd5tEu"
const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  STAKE_PROGRAM_ID
);

interface ConfigInfo {
  owner: string;
  assets: anchor.web3.PublicKey[];
}

export const StakeView: FC = ({}) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [amount, setAmount] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [staked, setStaked] = useState<number>(0);
  const [mints, setMints] = useState<anchor.web3.PublicKey[]>([]);
  const [mintAccount, setMintAccount] = useState<
    anchor.web3.PublicKey | undefined
  >();
  const [index, setIndex] = useState<number>(0);
  const [refresh, setRefresh] = useState<number>(0);

  let mint = mints[index];

  const program = useMemo(() => {
    const provider = new anchor.AnchorProvider(connection, wallet, {
      preflightCommitment: "processed",
    });

    const program = new Program(idl as anchor.Idl, STAKE_PROGRAM_ID, provider);
    return program;
  }, [wallet, connection]);

  useEffect(() => {
    console.log("init");
    setInterval(() => {
      setRefresh((val) => val + 1);
    }, 5000);
  }, []);

  const updateMints = async () => {
    const res = (await program.account.config.fetchNullable(configPda)) as any;
    if (!res) {
      return;
    }
    setMints(res.assets);
  };

  useEffect(() => {
    updateMints();
  }, []);

  useEffect(() => {
    if (!mint) {
      return;
    }

    if (!wallet) {
      return;
    }

    // console.log("wallet", wallet.publicKey.toBase58());
    const updateStaked = async () => {
      if (!mint) {
        return;
      }
      const [userKey, userBump] =
        await anchor.web3.PublicKey.findProgramAddress(
          [mint.toBuffer(), wallet.publicKey.toBuffer()],
          STAKE_PROGRAM_ID
        );
      const res = await program.account.userInfo.fetchNullable(userKey);
      if (!res) {
        setStaked(0);
        return;
      }
      const b = (res.balance as anchor.BN).toNumber();
      // console.log("res", b);
      setStaked(b);
    };
    updateStaked();
    const tokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
    connection
      .getTokenAccountBalance(tokenAccount)
      .then((res) => {
        // console.log("token balance", res)
        if (res && res.value) {
          setBalance(parseInt(res.value.amount));
        }
      })
      .catch(() => 1);
    // connection.getBlockHeight().then((res)=>console.log("block height", res))
  }, [program, wallet, mint, refresh, connection]);

  const onStake = async () => {
    if (!mint) {
      return;
    }

    console.log("amount", amount, balance);
    if (!amount || amount > balance) {
      return;
    }
    const { SystemProgram } = anchor.web3;
    const [userKey, userBump] = await anchor.web3.PublicKey.findProgramAddress(
      [mint.toBuffer(), wallet.publicKey.toBuffer()],
      STAKE_PROGRAM_ID
    );
    console.log("userKey", userKey.toBase58());
    const userTokenAccount = getAssociatedTokenAddressSync(
      mint,
      wallet.publicKey
    );
    const [vaultAccount, vaultBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [mint.toBuffer()],
        STAKE_PROGRAM_ID
      );
    const accounts = {
      config: configPda,
      user: userKey,
      payer: wallet.publicKey,
      mintAccount: mint,
      vaultAccount,
      userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
    console.log("accounts", accounts, amount);
    await program.rpc.deposit(new anchor.BN(amount), {
      accounts,
      // signers: [wallet],
    });
  };

  const onUnstake = async () => {
    if (!mint) {
      return;
    }

    console.log("amount", amount, staked);
    if (!amount || amount > staked) {
      return;
    }
    const { SystemProgram } = anchor.web3;
    const [userKey, userBump] = await anchor.web3.PublicKey.findProgramAddress(
      [mint.toBuffer(), wallet.publicKey.toBuffer()],
      STAKE_PROGRAM_ID
    );
    console.log("userKey", userKey.toBase58());
    const userTokenAccount = getAssociatedTokenAddressSync(
      mint,
      wallet.publicKey
    );
    const [vaultAccount, vaultBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [mint.toBuffer()],
        STAKE_PROGRAM_ID
      );
    const accounts = {
      config: configPda,
      user: userKey,
      payer: wallet.publicKey,
      mintAccount: mint,
      vaultAccount,
      userTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
    console.log("accounts", accounts, amount);
    await program.rpc.withdraw(new anchor.BN(amount), {
      accounts,
      // signers: [wallet],
    });
  };

  const onAddAsset = async () => {
    if (!mintAccount) {
      return;
    }
    const configInfo = (await program.account.config.fetchNullable(
      configPda
    )) as any;
    if (configInfo.owner.toBase58() != wallet.publicKey.toBase58()) {
      notify({ type: "error", message: `Not the owner` });
      return;
    }
    const { SystemProgram } = anchor.web3;
    const [vaultAccount, vaultBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [mintAccount.toBuffer()],
        STAKE_PROGRAM_ID
      );
    const res = await program.rpc.addAsset({
      accounts: {
        config: configPda,
        mintAccount,
        owner: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        vaultAccount,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    });
  };
  return (
    <div className="min-w-96 p-4">
      <div className="flex flex-col">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mt-10 mb-8">
          Stake
        </h1>
        {/* CONTENT GOES HERE */}
        <div className="">
          <p>Mint List</p>
          <select
            className="select select-bordered w-full max-w-xs"
            onChange={(e) => setIndex(parseInt(e.target.value))}
          >
            {mints.map((elm, idx) => (
              <option key={idx} value={idx}>
                {elm.toBase58()}
              </option>
            ))}
          </select>

          <label className="form-control w-full max-w-xs">
            <div className="label">
              {/* <span className="label-text">What is your name?</span> */}
              <span className="label-text-alt">Balance: {balance}</span>
            </div>
            <input
              type="number"
              onChange={(e) => setAmount(parseInt(e.target.value))}
              placeholder="Amount to stake or unstake"
              className="input input-bordered w-full max-w-xs"
            />
            <div className="label">
              {/* <span className="label-text-alt">Bottom Left label</span> */}
              <span className="label-text-alt">Staked: {staked}</span>
            </div>
          </label>

          <div className="flex flex-row content-between">
            <button className="btn btn-info" onClick={onStake}>
              Stake
            </button>
            <button className="btn btn-success" onClick={onUnstake}>
              Unstake
            </button>
          </div>
          <div>
            <div className="label">
              {/* <span className="label-text">What is your name?</span> */}
              <span className="label-text-alt">Mint account</span>
            </div>
            <input
              type="text"
              placeholder="Please input mint account"
              className="input input-bordered w-full max-w-xs"
              // value={mint?.toBase58()}
              onChange={(e) => {
                try {
                  const m = new anchor.web3.PublicKey(e.target.value);
                  setMintAccount(m);
                } catch (e) {}
              }}
            />
          </div>
          <div className="flex flex-row content-between mt-4">
            <button className="btn btn-info" onClick={onAddAsset}>
              Add Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
