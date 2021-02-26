const socket = io();

socket.on('connect', () => {
    console.log("connected");

    socket.on('graph', (data) => {

        document.getElementById("result").innerHTML = "";

        loading_div = document.getElementById("loading-div");
        loading_div.style.display = 'none';

        result = document.getElementById("result");
        result.style.display = 'block';


        var chart = anychart.graph(data);

        var txs = chart.group("tx");

        txs.normal().height(15);
        txs.normal().shape("diamond");
        txs.normal().fill("orange");

        txs.hovered().height(15);
        txs.hovered().shape("diamond");
        txs.hovered().fill("white");

        txs.selected().height(15);
        txs.selected().shape("diamond");
        txs.selected().fill("black");

        chart.edges().normal().stroke("#ffa000", 2, "5 0", "round");
        chart.edges().hovered().stroke("#ffa000", 4, "5 0", "round");
        chart.edges().selected().stroke("#ffa000", 4);

        chart.tooltip().format(function() {

            if(this.type == "edge"){
                return this.getData("tip") + "\n" + this.getData("val") + " BTC";
            }

            if (this.kc.yg.f.group == "adr") {

                return this.getData("id") + "\nbalance: " + this.getData("balance") + " BTC";
            } 
            else if((this.kc.yg.f.group == "tx")){

                return this.getData("id") + "\ntime: " + this.getData("time");
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
    result_div = document.getElementById("result");
    result_div.style.display = 'none';
}

