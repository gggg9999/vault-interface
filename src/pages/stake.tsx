import type { NextPage } from "next";
import Head from "next/head";
import { StakeView } from "../views";

const Basics: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Solana Scaffold</title>
        <meta
          name="description"
          content="Stake Functionality"
        />
      </Head>
      <StakeView />
    </div>
  );
};

export default Basics;
