var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var blockexplorer = require('blockchain.info/blockexplorer');
const fs = require('fs');
const { exit } = require('process');
app.use(express.static('public'))
var port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// let rawdata = fs.readFileSync('criminals.json');
// let criminals = JSON.parse(rawdata);
// console.log(criminals.med);

const mixing_threshold = 20; // can be modified
// mixing edgeler birleştirilip çizgili olacak

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function (socket) {
    console.log(socket.id, "connected.");

    socket.on('track', async(src,dest) => {
        console.log("tracking...");
        let data = await bfs(src,dest);
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

var bfs = async(src,dest) => {

    let iter = 0; // current iteration count
    let itermax = 2; // maximum iteration count
    let queue = [];
    let visited = [];
    let apicalled = [];
    let data = {nodes:[], edges:[]};
    let cb_id = 0;
    let mixing_id = 0;

    queue.push(src); 

    while(queue.length != 0 && iter<itermax){
        var address = queue.shift();

        if(apicalled[address]){
            continue;
        }

        apicalled[address] = true;

        try{
            adr = await blockexplorer.getAddress(address);
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
                normal:{height:"40", shape:"circle", fill:"green"},
                hovered:{height:"50", shape:"circle", fill:"white"},
                selected:{height:"50", shape:"circle", fill:"white"}
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

            let mixing = false;
            if(transaction.out.length > mixing_threshold)
                mixing = true;

            let receiver = true;
            let new_node,new_edge;
            let thash = transaction.hash;
            let time = new Date(transaction.time * 1000).toLocaleDateString();

            if(visited[thash])
                continue;
            
            visited[thash] = true;

            new_node = {id: thash, group:"tx", time: time};

            data.nodes.push(new_node);

            //-------------------- inputs --------------------
            for(let input of transaction.inputs){
                
                if(!input.prev_out){ // coinbase transaction

                    new_node = {
                            id: "coinbase" + cb_id, group:"cb",
                            normal:{ height:"20", shape: "circle",fill:{ src: "bitcoin-mining.jpg" }},
                            hovered: { height:"20", shape: "circle",fill:"white"},
                            selected: { height:"20", shape: "circle",fill:"white"}
                    };

                    data.nodes.push(new_node);
                    new_edge = {
                        "from":"coinbase" + cb_id,
                        "to":thash,
                        "val":"REWARD",
                        "time":time, tip:"input",
                        normal: {stroke:  {color: "green"}}
                    };

                    data.edges.push(new_edge);

                    cb_id++;
                    continue;
                }
                if(input.prev_out.addr){

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
                        normal: {stroke:  {color: "green"}
                    }};

                    data.edges.push(new_edge);

                    queue.push(adr_in);
                }
                else{
                    let script = input.prev_out.script;

                    if(!visited[script]){

                        visited[script] = true;
                        new_node = {
                            id: script, group:"adr",
                            normal:{ height:"20", shape: "circle",fill:"brown"},
                            hovered: { height:"20", shape: "circle",fill:"white"},
                            selected: { height:"20", shape: "circle",fill:"white"}
                        };

                        data.nodes.push(new_node);

                    }
                    
                    new_edge = {"from":script,"to":thash, "val":"MIXVAL", tip:"output",
                    normal: {stroke:  {color: "red"}}};
                    data.edges.push(new_edge);
                }
            }

            // -------------------- outputs --------------------
            if(mixing){
                new_node = {
                    id: "mixing" + mixing_id, group:"adr",
                    normal:{ height:"40", shape: "circle",fill:"purple"},
                    hovered: { height:"40", shape: "circle",fill:"white"},
                    selected: { height:"40", shape: "circle",fill:"white"}
                };
                data.nodes.push(new_node);

                new_edge = {"from":thash,"to":"mixing" + mixing_id, "val":"MIXVAL", tip:"output",
                normal: {stroke:  {color: "red"}}};
                data.edges.push(new_edge);
                mixing_id++;
            }
            else
            for(output of transaction.out){

                let adr_out = output.addr;
                let value = output.value/100000000;

                if(!receiver && adr_out == address) // self transaction
                    continue;
                    
                if(!visited[adr_out]){ // if node not in data create one

                    visited[adr_out] = true;
                    new_node = {id: adr_out, group:"adr", balance:"(?)"};
                    data.nodes.push(new_node);
                }

                new_edge = {"from":thash,"to":adr_out, "val":value, tip:"output",
                normal: {stroke:  {color: "red"}}};

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
