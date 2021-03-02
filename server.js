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

var exchange = require('blockchain.info/exchange');
const { Console } = require('console');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// let rawdata = fs.readFileSync('criminals.json');
// let criminals = JSON.parse(rawdata);
// console.log(criminals.med);

const mixing_threshold = 15; // can be modified

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function (socket) {
    console.log(socket.id, "connected.");

    socket.on('track', async(src,dest,iter) => {
        console.log("tracking...");
        let data = await bfs(src,dest,iter);
        console.log("sending graph to client");
        console.log("nodes:",data.nodes.length);
        console.log("edges:",data.edges.length);
        socket.emit('graph', data);
        
    });

    socket.on('disconnect', function () {
        console.log(socket.id,"disconnected");
    });
});

async function create_edge(from, to, value_SAT, time, is_input){

    let color, type;
    if(is_input){ color = "green"; type = "input"; }
    else{ color = "red"; type = "output"; }

    
    // BAD PERFORMANCE (TOO MANY API CALLS)
    try{
        var value_USD = await exchange.fromBTC(value_SAT, "USD", {time:time});
    }
    catch{
        var value_USD = "XCHG_ERR";
    }

    var new_edge = {
        from:from,
        to:to,
        valBTC:value_SAT/100000000,
        valUSD:value_USD,
        tip:type,
        normal:{stroke:{color:color, thickness:2}}
    };

    return new_edge;
}

async function create_adr(id, group, balance_SAT){

    if(balance_SAT != "?"){
        try{
            var balance_USD = await exchange.fromBTC(balance_SAT, "USD");
            // compute balance in usd with current exchange rate
        }
        catch{
            console.log(id, balance_SAT, "XCHG ERROR!");
            var balance_USD = "XCHG_ERR";
        }
    }
    else
        balance_USD = "?"

    var new_node = { 
        id: id, group:group, 
        balanceBTC:balance_SAT / 100000000, 
        balanceUSD:balance_USD
    };

    return new_node;
}

var bfs = async(src,dest,itermax) => {

    let iter = 0; // current api call count
    let queue = [];
    let visited = [];
    let apicalled = [];
    let data = {nodes:[], edges:[]};
    let cb_count = 0; // coinbase count
    let mixing_count = 0; // mixing count

    queue.push(src); 

    while(queue.length != 0 && iter<itermax){
        var address = queue.shift();

        if(apicalled[address]){continue;}
        apicalled[address] = true;

        let offset = 0;
        let tx_limit = 50;

        try{
            var adr = await blockexplorer.getAddress(address,{offset:offset}); // default limit = 50, max limit = 50
            var adr2 = adr;

            while(adr2.txs.length == 50 && adr.txs.length < tx_limit){        
                offset += 50;                                                   
                adr2 = await blockexplorer.getAddress(address,{offset:offset});  // if transactions are at max
                adr.txs = adr.txs.concat(adr2.txs);                            // make another api call to get the rest
            }

            console.log("adr:",adr.address,"n_tx:",adr.txs.length);
        }
        catch{
            console.log("API ERROR: ",address);
            continue;
        }

        let transactions = adr.txs;
        let balance_SAT = adr.final_balance;

        if(!visited[address]){ // first node
            new_node = await create_adr(address, "adr_me", balance_SAT);
            data.nodes.push(new_node);
            visited[address] = true;
        }
        else{   // if node already in data update it
            for(node of data.nodes){
                if(node.id == address)
                    node = await create_adr(address, "adr", balance_SAT);
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

            let tx_in_total = 0;
            let tx_out_total = 0;
            let adr_send_total = 0;
            let adr_receive_total = 0;

            let new_node,new_edge;
            let time = transaction.time * 1000;
            let date = new Date(time).toLocaleDateString();

            new_node = {id: thash, group:"tx", time: date};

            data.nodes.push(new_node);

            for(let input of transaction.inputs){
                if(input.prev_out && input.prev_out.addr){
                    if(input.prev_out.addr == address)
                        adr_send_total += input.prev_out.value;
                    tx_in_total += input.prev_out.value;
                }
            }

            for(output of transaction.out){
                if(output.addr){
                    if(output.addr == address)
                        adr_receive_total += output.value;
                    tx_out_total += output.value;
                }
            }

            if(adr_send_total > adr_receive_total){
                new_edge = await create_edge(address, thash,(adr_send_total - adr_receive_total), time, 1);
                data.edges.push(new_edge);
            }
            else{
                new_edge = await create_edge(thash, address,(adr_receive_total - adr_send_total), time, 0);
                data.edges.push(new_edge);
            }

            if(mixing_in){ // -------------------- mixing in --------------------

                let mixing_id = "MXIN" + mixing_count + "-" + transaction.vin_sz;
                new_node = await create_adr(mixing_id, "mix", tx_in_total);
                data.nodes.push(new_node);
                new_edge = await create_edge(thash, mixing_id, tx_in_total, time, 1);
                data.edges.push(new_edge);

                mixing_count++;
            }
            else
            for(let input of transaction.inputs){ //-------------------- inputs --------------------

                if(!input.prev_out){ //-------------------- is coinbase --------------------

                    let cb_id = "CB" + cb_count;
                    new_node = await create_adr(cb_id, "cb", "?");
                    data.nodes.push(new_node);
                    new_edge = await create_edge(cb_id, thash, "REWARD", time, 1);
                    data.edges.push(new_edge);

                    cb_count++;
                    continue;
                }

                let value = input.prev_out.value;
                if(input.prev_out.addr){ // 

                    if(input.prev_out.addr == address)
                        continue;

                    let adr_in = input.prev_out.addr;
                    let value = input.prev_out.value;

                    if(!visited[adr_in]){ // if node is not in data create one
                        visited[adr_in] = true;
                        new_node = await create_adr(adr_in, "adr", "?");
                        data.nodes.push(new_node);
                    }

                    new_edge = await create_edge(adr_in, thash, value, time, 1);
                    data.edges.push(new_edge);
                    queue.push(adr_in);
                }
                else{ //-------------------- P2WPKH --------------------

                    let script = input.prev_out.script;
                    if(!visited[script]){

                        visited[script] = true;
                        new_node = {
                            id: script, group:"adr", balance:"(?)",
                            normal:{ height:"15", shape: "circle",fill:"brown"},
                            hovered: { height:"15", shape: "circle",fill:"white"},
                            selected: { height:"15", shape: "circle",fill:"white"}
                        };

                        new_node = await create_adr(script, "scr", "?");

                        data.nodes.push(new_node);
                    }

                    new_edge = await create_edge(script, thash, value, time, 1);
                    data.edges.push(new_edge); 
                }
            }

            // -------------------- outputs --------------------
            if(mixing_out){ // -------------------- mixing out --------------------

                let mixing_id = "MXOUT" + mixing_count + "-" + transaction.vout_sz;
                new_node = await create_adr(mixing_id, "mix", tx_out_total);
                data.nodes.push(new_node);
                new_edge = await create_edge(thash, mixing_id, tx_out_total, time, 0);
                data.edges.push(new_edge);
                mixing_count++;
            }
            else
            for(output of transaction.out){

                let adr_out = output.addr;
                let value = output.value;

                if(adr_out == address) 
                    continue;
            
                if(!visited[adr_out]){ // if node not in data create one
                    visited[adr_out] = true;
                    if(!adr_out){   // -------------------- P2WPKY --------------------
                        adr_out = output.script;
                        new_node = await create_adr(adr_out, "bc", "?");
                    }
                    else if(adr_out[0] == '3'){ // -------------------- P2SH --------------------
                        new_node = await create_adr(adr_out, "adr3", "?");
                    }
                    else{ // -------------------- P2PKH --------------------
                        new_node = {id: adr_out, group:"adr", balance:"(?)"};
                    }
                    data.nodes.push(new_node);
                }

                new_edge = await create_edge(thash, adr_out, value, time, 0);
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
