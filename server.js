var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');

var blockexplorer = require('blockchain.info/blockexplorer');
const { address } = require('blockchain.info/blockexplorer/endpoints');
app.use(express.static('public'))
var port = process.env.PORT || 8080;

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

visited = []

app.post('/deneme', function(req, res) {
    var src = req.body.source
    var dest = req.body.destination

    bfs(src,dest);
});

app.get('/update', function(req, res) {

});

var queue = [];
var visited = [];
var calledBy = [];

var bfs = async(src,dest) => {

    queue.push(src); 
    var found = false;

    while(queue.length != 0 && !found){
        //console.log(queue);
        var address = queue.shift();

        if(visited[address])
            continue;
        
        //console.log("visiting",address);
        visited[address] = true;

        try{
            adr = await blockexplorer.getAddress(address);
        }
        catch{
            console.log("API ERROR: ",address);
            continue;
        }

        transactions = adr.txs;

        for(t in transactions){

            // inputs
            for(i in transactions[t].inputs){
                var adr_in = transactions[t].inputs[i].prev_out.addr;
                

                if(adr_in && !visited[adr_in]){

                    calledBy[adr_in] = address;

                    if(adr_in == dest){
                        
                        //console.log("found",adr_in);
                        found = true;
                        break;
                    }

                    //console.log(adr_in);
                    queue.push(adr_in);
                }
            }

            if(found)
                break;

           
            // outputs
            for(i in transactions[t].out){
                var adr_out = transactions[t].out[i].addr;
                
                
                
                if(adr_out && !visited[adr_out]){

                    calledBy[adr_out] = address;

                    if(adr_out == dest){
                        //console.log("found",adr_out);
                        found = true;
                        break;
                    }

                    //console.log(adr_out);
                    queue.push(adr_out);
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

    
}

var adr1 = "1NtdUY29S7GWpSmue9aG2NRUojtajFuhah";
var adr2 = "1vFZ8dDHjkVaYSuno68WQeCjjBhyKyD6E";

bfs(adr1,adr2);


//app.listen(port);