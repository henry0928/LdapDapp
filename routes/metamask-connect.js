var express = require('express');
var router = express.Router();
var fs = require('fs')
var Web3 = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const admin_address = '0x56B1817fFa1Ff86ebB922400155CD3bE3F734419'; // org0
const contract_address = "0x8f674F58e0a58dC10B232aEE3e4005BB4A513109";

router.get('/', function(req, res) {
    console.log("web3 versin", web3.version);
    res.render('metamask-connect', { title: 'Metamask connection',
                                     address: contract_address});
});

router.get('/org.json', function(req, res) {
    let contract = JSON.parse(fs.readFileSync('./build/contracts/OrganizationManager.json', 'utf-8'));
    res.json(contract);
});

router.post('/addUser', async function(req, res, next) {
    console.log("web3 versin", web3.version);
    let contract = JSON.parse(fs.readFileSync('./build/contracts/OrganizationManager.json', 'utf-8'));    
    let contractInstance = new web3.eth.Contract(contract.abi, contract_address);
    let balance = 0;
    
    // await web3.eth.getBalance(admin_address).then(function(result) {
    //     balance = result;
    // })

    // await web3.eth.getBalance(admin_address, (err, res) => {
    //     balance = res;
    // });

    // TODO: check unique id format 
    // ...

    // TODO: check whether exist, or update list
    // ...

    // TODO: getOrg
    // await contractInstance.methods.getOrg(req.body.uid).call({
    //     from: admin_address
    // }, function(err, res) {
    //     if (err) {
    //         console.log(err);
    //     }
    //     else {
    //         console.log(res);
    //     }
    // });

    // TODO: addUser
    let userId = req.body.uid;
    await contractInstance.methods.addUser(userId).send({
        from: admin_address
    }, function(error, transactionHash) {
        if (error) {
            console.log("err", error);
        }
        else {
            console.log("Transaction hash:", transactionHash);
        }
    })

    // TODO: checkOrg
    // await contractInstance.methods.checkOrgs(req.body.uid).call({
    //     from: admin_address
    // }, function(err, res) {
    //     if (err) {
    //         console.log(err);
    //     }
    //     else {
    //         console.log(res);
    //     }
    // });

    console.log(req.body.uid);
    res.send({msg: req.body.uid+"-backend-return-"+balance});
});

router.post('/bindAccount', async function(req, res, next) {
    let contract = JSON.parse(fs.readFileSync('./build/contracts/OrganizationManager.json', 'utf-8'));    
    let contractInstance = new web3.eth.Contract(contract.abi, contract_address);

    let userId = req.body.uid;
    let userAddress = req.body.address;
    let txHash = 0;
    console.log("id", userId);
    console.log("address", userAddress);

    await contractInstance.methods.bindAccount(userId, userAddress).send({
        from: admin_address
    }, function(error, transactionHash) {
        if (error) {
            console.log("err", error);
        }
        else {
            txHash = transactionHash;
            console.log("Transaction hash:", transactionHash);
        }
    })



    res.send({msg: "OK, i got it, this is your transaction hash:" + txHash});
});

module.exports = router;