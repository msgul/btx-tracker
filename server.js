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

//let rawdata = fs.readFileSync('criminals.json');
//let criminals = JSON.parse(rawdata);
//console.log(criminals.med);

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

io.on('connection', function (socket) {
    console.log("connected.");

    socket.on('track', async(src,dest) => {
        console.log(src,dest);
        let data = await bfs(src,dest);
        socket.emit('new data', data);
    });
});

var bfs = async(src,dest) => {
    let queue = [];
    let visited = [];
    let calledBy = [];
    let data = {nodes:[], edges:[]};

    var new_node = {
        id: src,
        normal:{height:"40", shape:"diamond", fill:"green"},
        hovered:{height:"50", shape:"diamond", fill:"white"},
        selected:{height:"50", shape:"diamond", fill:"white"}
    };

    data.nodes.push(new_node);

    queue.push(src); 
    var found = false;

    while(queue.length != 0 && !found){
        var address = queue.shift();

        if(visited[address])
            continue;
        
        visited[address] = true;

        try{
            adr = await blockexplorer.getAddress(address);
        }
        catch{
            console.log("API ERROR: ",address);
            continue;
        }

        var transactions = adr.txs;

        for(let transaction of transactions){

            let time = transaction.time;
            time = new Date(time * 1000).toLocaleString();
            var receiver = true;

            for(let input of transaction.inputs){
                if(address == input.prev_out.addr){
                    receiver = false;
                }
            }

            if(receiver){
                for(let input of transaction.inputs){

                    let adr_in = input.prev_out.addr;
                    let value = input.prev_out.value/100000000;
                    /* value will be modified */
                    if(adr_in && !visited[adr_in]){
                        calledBy[adr_in] = address;
    
                        var new_node = {"id":adr_in};
    
                        if(adr_in == dest){
                            found = true;
                            
                            new_node = {
                                id: adr_in,
                                normal:{ height:"40", shape: "diamond",fill:"red"},
                                hovered: { height:"50", shape: "diamond",fill:"white"},
                                selected: { height:"50", shape: "diamond",fill:"white"}
                            };
                        }
                        
                        data.nodes.push(new_node);
                        var new_edge = {"from":adr_in,"to":address,"val":value,"time":time};
                        data.edges.push(new_edge);
                        queue.push(adr_in);
                    }
                }
            }
            else{
                for(output of transaction.out){
                    let adr_out = output.addr;
                    let value = output.value/100000000;
                    if(adr_out && !visited[adr_out]){
                        calledBy[adr_out] = address;
    
                        var new_node = {"id":adr_out};
    
                        if(adr_out == dest){
                            found = true;

                            new_node = {
                                id: adr_out,
                                normal:{ height:"40", shape: "diamond",fill:"red"},
                                hovered: { height:"40", shape: "diamond",fill:"white"},
                                selected: { height:"40", shape: "diamond",fill:"white"}
                            };
                        }

                        data.nodes.push(new_node);
                        var new_edge = {"from":address,"to":adr_out,"val":value,"time":time};
                        data.edges.push(new_edge);

                        queue.push(adr_out);
                    }
                }
            }
        }
    }
/*
    if(!found)
        data = -1;
*/
    return data;
}

http.listen(port, function(){
    console.log("Running on port",port);
});
