var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');

var blockexplorer = require('blockchain.info/blockexplorer');
app.use(express.static('public'))
var port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

var data = {nodes:[], edges:[]};

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.post('/track', function(req, res) {
    var src = req.body.src
    var dest = req.body.dest
    bfs(src,dest);
});

app.get('/track', function(req, res) {
    res.send(data);
});

var bfs = async(src,dest) => {
    var queue = [];
    var visited = [];
    var calledBy = [];
    data = { nodes: [], edges: []};

    var new_node = {
        id: src,
        normal: { height:"40", shape: "diamond",fill:"green"},
        hovered: { height:"50", shape: "diamond",fill:"white"},
        selected: { height:"50", shape: "diamond",fill:"white"}
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

        for(t in transactions){

            var time = transactions[t].time;
            time = new Date(time * 1000);
            console.log(time);

            var receiver = true;
            for(i in transactions[t].inputs){
                if(address == transactions[t].inputs[i].prev_out.addr){
                    receiver = false;
                }
            }

            if(receiver){
                for(i in transactions[t].inputs){
                
                    var adr_in = transactions[t].inputs[i].prev_out.addr;
                    var value = transactions[t].inputs[i].prev_out.value/100000000;
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
                for(i in transactions[t].out){
                    var adr_out = transactions[t].out[i].addr;
                    var value = transactions[t].out[i].value/100000000;
                    if(adr_out && !visited[adr_out]){
                        calledBy[adr_out] = address;
    
                        var new_node = {"id":adr_out};
    
                        if(adr_out == dest){
                            found = true;

                            new_node = {
                                id: adr_out,
                                normal:{ height:"40", shape: "star5",fill:"red"},
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

    if(found){
        console.log("->",dest);
        while(calledBy[dest] &&  dest != src){
            dest = calledBy[dest];
            console.log("->",dest);
        }
    }
    else{
        console.log("no relation");
    }

    console.log(data);
}

app.listen(port, function(){
    console.log("Running on port",port);
});

