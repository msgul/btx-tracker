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

//let rawdata = fs.readFileSync('criminals.json');
//let criminals = JSON.parse(rawdata);
//console.log(criminals.med);

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function (socket) {
    console.log("connected.");

    socket.on('track', async(src,dest) => {
        console.log("tracking",src,dest);
        let data = await bfs(src,dest);
        console.log("sending data to client");
        socket.emit('graph', data);
    });
});

var bfs = async(src,dest) => {

    let iter = 0;
    let itermax = 1;
    let queue = [];
    let visited = [];
    let calledBy = [];
    let data = {nodes:[], edges:[]};

    queue.push(src); 

    while(queue.length != 0 && iter<itermax){
        var address = queue.shift();

        try{
            adr = await blockexplorer.getAddress(address);
        }
        catch{
            console.log("API ERROR: ",address);
            continue;
        }

        var cb_counter = 0;
        let transactions = adr.txs;
        let final_balance = adr.final_balance/100000000;
        if(!visited[address]){

            var new_node = {
                id: src, group:"adr", balance:final_balance,
                normal:{height:"40", shape:"circle", fill:"green"},
                hovered:{height:"50", shape:"circle", fill:"white"},
                selected:{height:"50", shape:"circle", fill:"white"}
            };

            data.nodes.push(new_node);
            visited[src] = true;
        }
        
        for(let transaction of transactions){

            let reciever = false;
            for(let input of transaction.inputs){
                if(input.prev_out && input.prev_out.addr == address);{    
                    reciever = true;
                    break;
                }
            }

            let new_node,new_edge;
            let thash = transaction.hash;
            let time = new Date(transaction.time * 1000).toLocaleString();

            if(visited[thash])
                continue;
            
            visited[thash] = true;

            new_node = {
                id: thash, group:"tx", time: time
            };

            data.nodes.push(new_node);

            

            for(let input of transaction.inputs){

                if(!input.prev_out){ // coinbase transaction
                    new_node = {
                            id: "coinbase" + cb_counter, group:"cb",
                            normal:{ height:"20", shape: "circle",fill:{ src: "bitcoin-mining.jpg" }},
                            hovered: { height:"20", shape: "circle",fill:"white"},
                            selected: { height:"20", shape: "circle",fill:"white"}
                    };
    
                    data.nodes.push(new_node);
                    new_edge = {"from":"coinbase" + cb_counter, "to":thash, "val":"REWARD" /*will modified*/, "time":time};
                    data.edges.push(new_edge);
    
                    cb_counter++;
                    continue;
                }
    
                let adr_in = input.prev_out.addr;
                let value = input.prev_out.value/100000000;


                if(!visited[adr_in]){
                    //calledBy[adr_in] = address;
                    visited[adr_in] = true;

                    new_node = {"id":adr_in, group:"adr", balance:"(?)"};

                    data.nodes.push(new_node);
                }
                
                new_edge = {"from":adr_in,"to":thash,"val":value,"time":time};
                data.edges.push(new_edge);

                queue.push(adr_in);

                
            }

            for(output of transaction.out){
                let adr_out = output.addr;
                let value = output.value/100000000;
                    
                if(!visited[adr_out]){

                    visited[adr_out] = true;
                    new_node = {id: adr_out, group:"adr", balance:"(?)"};
                
                    data.nodes.push(new_node);
                }
                
                if(!reciever || adr_out != address ){

                    new_edge = {"from":thash,"to":adr_out,"val":value,"time":time, format:"--{%id}--"};
                    data.edges.push(new_edge);

                    queue.push(adr_out);
                }
            }
        }

        iter++;
    }
    
    return data;
}

http.listen(port, function(){
    console.log("Running on port",port);
});
