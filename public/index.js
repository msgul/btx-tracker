const socket = io();

socket.on('connect', () => {
    console.log("connected");

    socket.on('graph', (data) => {
        console.log(data);
        document.getElementById("result").innerHTML = "";

        loading_div = document.getElementById("loading-div");
        loading_div.style.display = 'none';

        result = document.getElementById("result");
        result.style.display = 'block';


        var chart = anychart.graph(data);


        // default addresses
        var adrs = chart.group("adr");
        if(adrs){
            adrs.hovered().fill("white");
            adrs.selected().fill("black");
        }

        // transactions
        var txs = chart.group("tx");
        if(txs){
            txs.normal().height(15);
            txs.normal().shape("diamond");
            txs.normal().fill("orange");

            txs.hovered().height(15);
            txs.hovered().shape("diamond");
            txs.hovered().fill("white");

            txs.selected().height(15);
            txs.selected().shape("diamond");
            txs.selected().fill("black");
        }

        
        // tracking address
        var adrmes = chart.group("adr_me");
        if(adrmes){
            adrmes.normal().height(20);
            adrmes.normal().shape("circle");
            adrmes.normal().fill("lime");

            adrmes.hovered().height(20);
            adrmes.hovered().shape("circle");
            adrmes.hovered().fill("white");

            adrmes.selected().height(20);
            adrmes.selected().shape("circle");
            adrmes.selected().fill("black");
        }
        

        // mixing
        var mixs = chart.group("mix");

        if(mixs){
            mixs.normal().height(20);
            mixs.normal().shape("circle");
            mixs.normal().fill("purple");
    
            mixs.hovered().height(20);
            mixs.hovered().shape("circle");
            mixs.hovered().fill("white");
    
            mixs.selected().height(20);
            mixs.selected().shape("circle");
            mixs.selected().fill("black");
        }

        // coinbase
        var cbs = chart.group("cb");
        if(cbs){
            cbs.normal().height(20);
            cbs.normal().fill("yellow");
            cbs.hovered().height(20);
            cbs.hovered().fill("white");
            cbs.selected().height(20);
            cbs.selected().fill("black");
        }

        // P2WPKY
        var bcs = chart.group("bc");
        if(bcs){
            bcs.normal().height(20);
            bcs.normal().fill("brown");
            bcs.hovered().height(20);
            bcs.hovered().fill("white");
            bcs.selected().height(20);
            bcs.selected().fill("black");
        }

        // P2SH (ADDRESSES THAT START WITH 3)
        var scrs = chart.group("scr");
        if(scrs){
            scrs.normal().height(20);
            scrs.normal().fill("yellow");
            scrs.hovered().height(20);
            scrs.hovered().fill("white");
            scrs.selected().height(20);
            scrs.selected().fill("black");
        }

        // edges
        chart.edges().normal().stroke("#ffa000", 2, "5 0", "round");
        chart.edges().hovered().stroke("#ffa000", 4, "5 0", "round");
        chart.edges().selected().stroke("#ffa000", 4);



        //chart.tooltip().selectable(true);
        chart.tooltip().format(function() {

            if(this.type == "edge"){
                return this.getData("tip") + "\n" + this.getData("valBTC") + " BTC - " + this.getData("valUSD") + " USD";
            }
            else
            switch(this.kc.yg.f.group){
                case "tx":
                    return this.getData("id") + "\ntime: " + this.getData("time");
                default:
                    return this.getData("id") + "\nbalance: " + this.getData("balanceBTC") + " BTC - " + this.getData("balanceUSD") + " USD";
            }
        });

        // set the title
        chart.title("Tx Graph");
        // draw the chart
        chart.container("result").draw();
    });

});

function track(track_mode){

    loading_div = document.getElementById("loading-div");
    loading_div.style.display = 'block';

    result = document.getElementById("result");
    result.style.display = 'none';

    var src,dest;

    if(track_mode == "tx_track"){
        src = document.getElementById("src").value;
        dest = document.getElementById("dest").value;
        iter = document.getElementById("iter").value;
    }
    else{
        src = document.getElementById("adr").value;
        dest = 0;
        iter = document.getElementById("iter").value;
    }

    socket.emit("track",src,dest,iter);
}

function hide(){
    loading_div = document.getElementById("loading-div");
    loading_div.style.display = 'none';
}

