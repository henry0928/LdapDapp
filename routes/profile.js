const express = require('express');
const router = express.Router();
const fs = require('fs')
const Web3 = require('web3');
const ldap = require('ldapjs');
const util = require('util');
const Queue = require('bull');
const user = require("../controllers/user.controller.js");

const config = JSON.parse(fs.readFileSync('./server-config.json', 'utf-8'));    
const web3 = new Web3(new Web3.providers.WebsocketProvider(config.web3_provider));
const admin_address = config.admin_address; // org0
const contract_address = config.contracts.organizationManagerAddress;
const client = ldap.createClient(config.ldap.server);

let subscribeQueue = new Queue('event subscribe');
function listenEventByHash(txHash, dn, ms) {
    return new Promise((resolve) => {
    //   setTimeout(resolve, ms);
        let i = 0, limitCount = 5; // wait 100 
        let log;
        let s = setInterval(async () => {
            i++;
            console.log(`try ${i}.`);

            log = await web3.eth.getTransactionReceipt(txHash);

            if (i == limitCount || log !== null) {
                resolve({
                    status: (log === null) ? false : true,
                    log: log,
                    dn: dn
                });
                clearInterval(s);
            }
        }, ms);
    });
  }  
subscribeQueue.process(async (job) => {
    try {
        const { txHash, dn } = job.data;
        let result = await listenEventByHash(txHash, dn, 1000);
        return Promise.resolve(result);
    } catch (err) {
        Promise.reject(err);
    }
});

subscribeQueue.on('completed', (job, result) => {
    let receipt = result.log;
    const {status, dn} = result;
    console.log(dn);
    if (status) {
        let arrayData = [];
        for (let i = 0; i < receipt.logs.length; ++i) {
            console.log(i);
            if (receipt.logs[i].data !== "0x") {
                let start = 2; // "0x"
                while(start < receipt.logs[i].data.length) {
                    arrayData.push(receipt.logs[i].data.substring(start, start+64));    
                    start += 64;
                }
            }
        }
        console.log(arrayData);
        if (arrayData.length === 3) {
            // update user start
            let change = {
                operation: 'replace',
                modification: {
                    hashed: `0x${arrayData[2]}`,
                    idStatus: 1
                }
            };
            
            client.modify(dn, change, function(err) {
                if (err) console.log("error", err);
            });
            // update user end
        }
        else {
            console.log("logs is wrong.");
        }
    }
    
    console.log(`Done, subsrcibe status:${status}, jobId:${job.id}`);
});



var isAuthenticated = function (req,res,next){
    if (req.isAuthenticated()) {
        next();
    }
    else {
        // alert("Login first");
        req.flash('info', 'Login first.');
        res.redirect('/');
        // res.status(401).json({"message": 'User not authenticated.'});
    }
};

router.get('/', isAuthenticated, async function(req, res) {
    let opts = {
        filter: util.format('(cn=%s)', req.user.cn),
        scope: 'sub'
    };
    let data = await user.userSearch(opts, 'ou=location2,dc=jenhao,dc=com');
    let userObject = JSON.parse(data[0]);
    delete userObject['userpassword'];
    res.render('profile', { title: 'Profile ', user: userObject, address: contract_address});
});

router.get('/org.json', function(req, res) {
    let contract = JSON.parse(fs.readFileSync('./build/contracts/OrganizationManager.json', 'utf-8'));
    res.json(contract);
});

router.post('/bindAccount', isAuthenticated, async function(req, res, next) {
    let contract = JSON.parse(fs.readFileSync('./build/contracts/OrganizationManager.json', 'utf-8'));    
    let contractInstance = new web3.eth.Contract(contract.abi, contract_address);
    
    let userId = req.body.uid;
    let userAddress = req.body.address;
    let msg = "", hash = "";
    let status = false;
    console.log("profile id", userId);
    console.log("profile address", userAddress);
    
    await contractInstance.methods.bindAccount(userId, userAddress).send({
        from: admin_address,
        gas: 1000000
    })
    .then( (result) => {
        msg = `OK, i got it, this is your transaction hash: ${result.transactionHash}`;
        hash = result.transactionHash;
        status = true;
        console.log(result);
    })
    .catch( (err) => {
        console.log(err);
        msg = `${err}`;
    })

    if (status) {
        // create job for polling status of block mined
        let job = await subscribeQueue.add({
            txHash: hash,
            dn: req.user.dn    
        });
        console.log(`Create a job, jodId: ${job.id}`);
    }
    
    res.send({msg: msg, status: status, txHash: hash});
});

module.exports = router;
