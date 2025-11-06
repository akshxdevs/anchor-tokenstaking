import * as anchor from "@coral-xyz/anchor";  
import { Program } from "@coral-xyz/anchor";  
import { AnchorToken } from "../target/types/anchor_token";  // Adjust if types path differs  
import { getAssociatedTokenAddressSync, createMint, createAssociatedTokenAccountInstruction, mintTo } from "@solana/spl-token";  
import { expect } from "chai";  

describe("anchor_token", () => {  
  const provider = anchor.AnchorProvider.env();  
  anchor.setProvider(provider);  

  const program = anchor.workspace.AnchorToken as Program<AnchorToken>;  

  const user = provider.wallet.publicKey;  
  let mint: anchor.web3.PublicKey;  
  let userAta: anchor.web3.PublicKey;  
  let vaultPda: anchor.web3.PublicKey;  
  let vaultBump: number;  
  let vaultAta: anchor.web3.PublicKey;  
  const payerKeypair = provider.wallet.payer as anchor.web3.Keypair;
  before(async () => {  
    // Create mint (9 decimals)  
    mint = await createMint(  
      provider.connection,  
      payerKeypair,  
      user,  
      null,  
      9  
    );  

    // User ATA  
    userAta = getAssociatedTokenAddressSync(mint, user);  

    // Vault PDA  
    [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(  
      [Buffer.from("vault"), user.toBuffer()],  
      program.programId  
    );  

    // Vault ATA (owned by PDA)  
    vaultAta = getAssociatedTokenAddressSync(mint, vaultPda, true);  // Allow PDA owner  

    // Tx to create user ATA + mint ATA + mint 1000 tokens to user  
    const tx = new anchor.web3.Transaction();  
    tx.add(  
      createAssociatedTokenAccountInstruction(  
        provider.wallet.publicKey,  
        userAta,  
        user,  
        mint  
      ),  
      createAssociatedTokenAccountInstruction(  
        provider.wallet.publicKey,  
        vaultAta,  
        vaultPda,  
        mint  
      )  
    );  
    await provider.sendAndConfirm(tx);  

    // Mint 1000 tokens to user ATA  
    await mintTo(  
      provider.connection,  
      provider.wallet.payer as anchor.web3.Keypair,  
      mint,  
      userAta,  
      provider.wallet.payer as anchor.web3.Keypair,  
      1000 * 10**9
    );  
    const userTokenAccount = await provider.connection.getTokenAccountBalance(userAta); 
    console.log("Vault Details: ",userTokenAccount.value.amount);

    const vaultTokenAccount = await provider.connection.getTokenAccountBalance(vaultAta); 
    console.log("Vault Details: ",vaultTokenAccount.value.amount);
  });  


  it("Initializes the vault", async () => {
    try {
      [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(  
        [Buffer.from("vault"), user.toBuffer()],  
        program.programId  
      ); console.log("Vault Exist: ",vaultPda);

      const userTokenAccount = await provider.connection.getTokenAccountBalance(userAta); 
      console.log("Vault Details: ",userTokenAccount.value.amount);
    } catch (error) {
      await program.methods  
        .initialize(vaultBump)  
        .accounts({  
          vault: vaultPda,  
          user: user,  
          systemProgram: anchor.web3.SystemProgram.programId,  
        }as any)  
        .rpc();  

      const vaultAccount = await program.account.vault.fetch(vaultPda);
      const userTokenAccount = await provider.connection.getTokenAccountBalance(userAta); 
      console.log("Vault Details: ",userTokenAccount.value.amount);

      const vaultTokenAccount = await provider.connection.getTokenAccountBalance(vaultAta); 
      console.log("Vault Details: ",vaultTokenAccount.value.amount);
      expect(vaultAccount.owner.toBase58()).to.equal(user.toBase58());  
      expect(vaultAccount.bump).to.equal(vaultBump);  
      expect(vaultAccount.balance.toNumber()).to.equal(0);  
    }

  });  

  it("Deposits tokens", async () => {  
    const amount = new anchor.BN(500 * 10**9);  // 500 tokens  

    await program.methods  
      .deposit(amount)  
      .accounts({  
        vault: vaultPda,  
        user: user,  
        userAta: userAta,  
        vaultAta: vaultAta,  
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,  
      }as any)  
      .rpc();  

    const userTokenAccount = await provider.connection.getTokenAccountBalance(userAta); 
    console.log("Vault Details: ",userTokenAccount.value.amount);

    const vaultTokenAccount = await provider.connection.getTokenAccountBalance(vaultAta); 
    console.log("Vault Details: ",vaultTokenAccount.value.amount);     
    expect(Number(userTokenAccount.value.amount)).to.equal(Number(500 * 10**9));  
  });  

  it("Withdraws tokens", async () => {  
    const amount = new anchor.BN(200 * 10**9);  // 200 tokens  

    await program.methods  
      .withdraw(amount)  
      .accounts({  
        vault: vaultPda,  
        user: user,  
        userAta: userAta,  
        vaultAta: vaultAta,  
        vaultSigner: vaultPda,  
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,  
      }as any)  
      .rpc();  

    const userTokenAccount = await provider.connection.getTokenAccountBalance(userAta); 
    console.log("Vault Details: ",userTokenAccount.value.amount);

    const vaultTokenAccount = await provider.connection.getTokenAccountBalance(vaultAta); 
    console.log("Vault Details: ",vaultTokenAccount.value.amount);    
    expect(Number(userTokenAccount.value.amount)).to.equal(Number(700 * 10**9));  
  });  
});  