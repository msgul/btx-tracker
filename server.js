var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var blockexplorer = require('blockchain.info/blockexplorer');
const fs = require('fs');
app.use(express.static('public'))
var port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// let rawdata = fs.readFileSync('criminals.json');
// let criminals = JSON.parse(rawdata);
// console.log(criminals.med);

const mixing_threshold = 30; // can be modified

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function (socket) {
    console.log(socket.id, "connected.");

    socket.on('track', async(src,dest,iter) => {
        console.log("tracking...");
        let data = await bfs(src,dest,iter);
        if(data != -1){
            console.log("sending graph to client");
            console.log("nodes:",data.nodes.length);
            console.log("edges:",data.edges.length);
            socket.emit('graph', data);
        }
        
    });

    socket.on('disconnect', function () {
        console.log(socket.id,"disconnected");
    });
});

var bfs = async(src,dest,itermax) => {

    let iter = 0; // current api call count
    let queue = [];
    let visited = [];
    let apicalled = [];
    let data = {nodes:[], edges:[]};
    let cb_id = 0; // coinbase count
    let mixing_id = 0; // mixing count

    queue.push(src); 

    while(queue.length != 0 && iter<itermax){
        var address = queue.shift();

        if(apicalled[address]){
            continue;
        }

        apicalled[address] = true;

        let ofst = 0;
        let tx_limit = 50;

        try{
            var adr = await blockexplorer.getAddress(address,{offset:ofst}); // default limit = 50, max limit = 50
            
            var adr2 = adr;

            while(adr2.txs.length == 50 && adr.txs.length < tx_limit){        
                ofst += 50;                                                   
                adr2 = await blockexplorer.getAddress(address,{offset:ofst});  // if transactions are at max
                adr.txs = adr.txs.concat(adr2.txs);                            // make another api call to get the rest
            }                                                                  
            
            
            console.log("adr:",adr.address,"n_tx:",adr.txs.length);
        }
        catch{
            console.log("API ERROR: ",address);
            continue;
        }

        let transactions = adr.txs;
        let final_balance = adr.final_balance/100000000;

        if(!visited[address]){ // if node isnt in data create one

            var new_node = {
                id: address, group:"adr", balance:final_balance,
                normal:{height:"20", shape:"circle", fill:"lime"},
                hovered:{height:"25", shape:"circle", fill:"white"},
                selected:{height:"25", shape:"circle", fill:"white"}
            };

            data.nodes.push(new_node);
            visited[src] = true;
        }
        else{   // if node already in data get balance
            for(node of data.nodes){
                if(node.id == address)
                    node.balance = final_balance;
            }
        }

        // -------------------- transactions --------------------
        for(let transaction of transactions){

            let thash = transaction.hash;

            if(visited[thash])
                continue;

            visited[thash] = true;

            let mixing_in = false;
            let mixing_out = false;

            if(transaction.vin_sz > mixing_threshold)
                mixing_in = true;

            if(transaction.vout_sz > mixing_threshold)
                mixing_out = true;

            let receiver = true;
            let new_node,new_edge;
            
            let time = new Date(transaction.time * 1000).toLocaleDateString();

            new_node = {id: thash, group:"tx", time: time};

            data.nodes.push(new_node);

            if(mixing_in){ // -------------------- mixing in --------------------
                new_node = {
                    id: "mixing_in" + mixing_id + "-" + transaction.vin_size, group:"adr",
                    normal:{ height:"30", shape: "circle",fill:"purple"},
                    hovered: { height:"30", shape: "circle",fill:"white"},
                    selected: { height:"30", shape: "circle",fill:"white"}
                };
                data.nodes.push(new_node);

                new_edge = {"from":thash,"to":"mixing_in" + mixing_id + "-" + transaction.vin_size, "val":"MIXVAL", tip:"output",
                    normal: {stroke:  {color: "red",thickness: 2}}};
                data.edges.push(new_edge);

                if(receiver){
                    new_edge = {"from":thash,"to":address, "val":"MIXVAL", tip:"output",
                        normal: {stroke:  {color: "red",thickness: 2}}};
                    data.edges.push(new_edge);
                }

                mixing_id++;
            }
            else
            
            for(let input of transaction.inputs){ //-------------------- inputs --------------------

                if(!input.prev_out){ //-------------------- is coinbase --------------------

                    new_node = {
                            id: "coinbase" + cb_id, group:"cb", balance:"(?)",
                            normal:{ height:"30", shape: "circle",fill:{ src: "bitcoin-mining.jpg" }},
                            hovered: { height:"30", shape: "circle",fill:"white"},
                            selected: { height:"30", shape: "circle",fill:"white"}
                    };

                    data.nodes.push(new_node);
                    new_edge = {
                        "from":"coinbase" + cb_id,
                        "to":thash,
                        "val":"REWARD",
                        "time":time, tip:"input",
                        normal: {stroke:  {color: "green",thickness: 3}}
                    };

                    data.edges.push(new_edge);

                    cb_id++;
                    continue;
                }

                // mixing input control will be added.

                if(input.prev_out.addr){ // 

                    let adr_in = input.prev_out.addr;

                    if(adr_in == address)
                        receiver = false;

                    let value = input.prev_out.value/100000000;
                    if(!visited[adr_in]){ // if node is not in data create one

                        visited[adr_in] = true;
                        new_node = {"id":adr_in, group:"adr", balance:"(?)"};

                        data.nodes.push(new_node);
                    }

                    new_edge = {"from":adr_in,"to":thash,"val":value, tip:"input",
                        normal: {stroke:  {color: "green",thickness: 2}
                    }};

                    data.edges.push(new_edge);

                    queue.push(adr_in);
                }
                else{ //-------------------- P2WPKH --------------------

                    let script = input.prev_out.script;
                    let value = input.prev_out.value/100000000;

                    if(!visited[script]){

                        visited[script] = true;
                        new_node = {
                            id: script, group:"adr", balance:"(?)",
                            normal:{ height:"15", shape: "circle",fill:"brown"},
                            hovered: { height:"15", shape: "circle",fill:"white"},
                            selected: { height:"15", shape: "circle",fill:"white"}
                        };

                        data.nodes.push(new_node);

                    }
                    
                    new_edge = {"from":script,"to":thash, "val":value, tip:"input",
                    normal: {stroke:  {color: "green",thickness: 3}}};
                    data.edges.push(new_edge);
                }
            }

            // -------------------- outputs --------------------


            if(mixing_out){ // -------------------- mixing out --------------------
                new_node = {
                    id: "mixing_out" + mixing_id, group:"adr",
                    normal:{ height:"30", shape: "circle",fill:"purple"},
                    hovered: { height:"30", shape: "circle",fill:"white"},
                    selected: { height:"30", shape: "circle",fill:"white"}
                };
                data.nodes.push(new_node);

                new_edge = {"from":thash,"to":"mixing_out" + mixing_id, "val":"MIXVAL", tip:"output",
                    normal: {stroke:  {color: "red",thickness: 2}}};
                data.edges.push(new_edge);

                if(receiver){
                    new_edge = {"from":thash,"to":address, "val":"MIXVAL", tip:"output",
                        normal: {stroke:  {color: "red",thickness: 2}}};
                    data.edges.push(new_edge);
                }

                mixing_id++;
            }
            else
            for(output of transaction.out){

                let adr_out = output.addr;
                let value = output.value/100000000;

                if(!receiver && adr_out == address) // self transaction
                    continue;

                // if found ...
                    
                if(!visited[adr_out]){ // if node not in data create one

                    visited[adr_out] = true;

                    if(!adr_out){   // -------------------- P2WPKY --------------------
                        adr_out = output.script;

                        new_node = {
                            id: adr_out, group:"adr", balance:"(?)",
                            normal:{ height:"15", shape: "circle",fill:"brown"},
                            hovered: { height:"15", shape: "circle",fill:"white"},
                            selected: { height:"15", shape: "circle",fill:"white"}
                        };

                    }
                    else if(adr_out[0] == '3') // -------------------- P2SH --------------------
                    {
                        new_node = {
                            id: adr_out, group:"adr", balance:"(?)",
                            normal:{ height:"15", shape:"circle", fill:"purple"},
                            hovered: { height:"15", shape:"circle", fill:"white"},
                            selected: { height:"15", shape:"circle", fill:"white"}    
                        };
                    }
                    else{ // -------------------- P2PKH --------------------
                        new_node = {id: adr_out, group:"adr", balance:"(?)"};
                    }

                    data.nodes.push(new_node);
                }

                new_edge = {"from":thash,"to":adr_out, "val":value, tip:"output",
                normal: {stroke:  {color: "red",thickness: 2}}};

                data.edges.push(new_edge);
                queue.push(adr_out);
            }
        }

        iter++;
    }
    
    return data;
}



http.listen(port, function(){
    console.log("Running on port",port);
});
